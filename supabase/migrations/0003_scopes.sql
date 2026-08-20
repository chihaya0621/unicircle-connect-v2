-- =============================================================================
-- 可視範囲・参加資格のスコープを3段階に拡張する
-- =============================================================================
-- 背景:
--   従来はサークルが単一大学に属し、イベントは internal / public の2値だった。
--   しかし「インカレサークル」や「特定大学との合同練習試合」は、この2値では
--   表現できない。全公開にすると無関係な大学が入り込み、学内限定にすると
--   相手大学が参加できないため。
--
-- 方針:
--   サークルとイベントで同じ3段階に揃える。
--     university … 主管大学のみ
--     scoped     … 指定した大学のみ（中間テーブルで列挙）
--     public     … どの大学からでも可
--
--   対象大学は配列ではなく中間テーブルで持つ。第3正規形を保ち、
--   外部キー制約で存在しない大学を弾けるようにするため。
--
--   circles.university_id は「主管大学」として残す。職員の承認スコープ
--   （自大学のサークルのみ承認可）がこれに依存しているため。
-- =============================================================================


-- -----------------------------------------------------------------------------
-- サークルのスコープ
-- -----------------------------------------------------------------------------

ALTER TABLE circles
  ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'university'
    CHECK (scope IN ('university', 'scoped', 'public'));

COMMENT ON COLUMN circles.scope IS
  'university=主管大学のみ / scoped=circle_universities に列挙した大学 / public=全大学（インカレ）';

CREATE TABLE IF NOT EXISTS circle_universities (
  circle_id     UUID NOT NULL REFERENCES circles(id)      ON DELETE CASCADE,
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  PRIMARY KEY (circle_id, university_id)
);

CREATE INDEX IF NOT EXISTS idx_circle_universities_university
  ON circle_universities(university_id);


-- -----------------------------------------------------------------------------
-- イベントのスコープ
-- -----------------------------------------------------------------------------
-- 既存の visibility は 'internal' / 'public' の2値。'scoped' を追加する。
-- 既存データを壊さないため 'internal' はそのまま活かす
-- （意味は「主管大学のみ」で変わらない）。
-- -----------------------------------------------------------------------------

ALTER TABLE events DROP CONSTRAINT IF EXISTS events_visibility_check;

ALTER TABLE events
  ADD CONSTRAINT events_visibility_check
    CHECK (visibility IN ('internal', 'scoped', 'public'));

COMMENT ON COLUMN events.visibility IS
  'internal=主管大学のみ / scoped=event_universities に列挙した大学 / public=全公開';

CREATE TABLE IF NOT EXISTS event_universities (
  event_id      UUID NOT NULL REFERENCES events(id)       ON DELETE CASCADE,
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  PRIMARY KEY (event_id, university_id)
);

CREATE INDEX IF NOT EXISTS idx_event_universities_university
  ON event_universities(university_id);


-- -----------------------------------------------------------------------------
-- RLS（開発環境用・既存テーブルと同じ全許可ポリシー）
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['circle_universities', 'event_universities'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t
        AND policyname = 'dev_allow_all_' || t
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL USING (true) WITH CHECK (true)',
        'dev_allow_all_' || t, t
      );
    END IF;
  END LOOP;
END $$;


-- -----------------------------------------------------------------------------
-- 判定用ヘルパー: ある大学がサークル / イベントの対象範囲に入っているか
-- -----------------------------------------------------------------------------
-- アプリ側のクエリと RPC の両方から使うため関数にまとめる。
-- p_university_id が NULL（所属大学未設定）の場合、public のみ真。
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.circle_allows_university(
  p_circle_id     UUID,
  p_university_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE c.scope
    WHEN 'public'     THEN TRUE
    WHEN 'university' THEN c.university_id = p_university_id
    WHEN 'scoped'     THEN EXISTS (
      SELECT 1 FROM circle_universities cu
      WHERE cu.circle_id = c.id AND cu.university_id = p_university_id
    ) OR c.university_id = p_university_id
    ELSE FALSE
  END
  FROM circles c
  WHERE c.id = p_circle_id;
$$;

COMMENT ON FUNCTION public.circle_allows_university IS
  'scoped の場合、主管大学も暗黙で対象に含める（列挙し忘れて設立者が弾かれるのを防ぐ）';


-- -----------------------------------------------------------------------------
-- 参加申請に大学スコープの判定を追加する
-- -----------------------------------------------------------------------------
-- 0002 では役割と承認状態しか見ておらず、他大学の学生が自由に参加できた。
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.request_join_circle(p_circle_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid            UUID := auth.uid();
  v_role           TEXT;
  v_university_id  UUID;
  v_circle_status  TEXT;
  v_current_status TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'ログインが必要です';
  END IF;

  SELECT role INTO v_role FROM public.users WHERE id = v_uid;
  IF v_role IS DISTINCT FROM 'student' THEN
    RAISE EXCEPTION 'サークルに参加できるのは学生のみです';
  END IF;

  SELECT status INTO v_circle_status FROM public.circles WHERE id = p_circle_id;
  IF v_circle_status IS NULL THEN
    RAISE EXCEPTION 'サークルが見つかりません';
  END IF;
  IF v_circle_status <> 'approved' THEN
    RAISE EXCEPTION '承認されていないサークルには参加申請できません';
  END IF;

  SELECT university_id INTO v_university_id
  FROM public.student_profiles WHERE user_id = v_uid;

  IF NOT public.circle_allows_university(p_circle_id, v_university_id) THEN
    RAISE EXCEPTION 'このサークルはあなたの所属大学からは参加できません';
  END IF;

  SELECT status INTO v_current_status
  FROM public.circle_members WHERE circle_id = p_circle_id AND user_id = v_uid;

  IF v_current_status = 'active' THEN
    RETURN 'already_member';
  ELSIF v_current_status = 'pending' THEN
    RETURN 'already_requested';
  ELSIF v_current_status = 'rejected' THEN
    UPDATE public.circle_members SET status = 'pending'
    WHERE circle_id = p_circle_id AND user_id = v_uid;
    RETURN 'requested';
  END IF;

  INSERT INTO public.circle_members (circle_id, user_id, role, status)
  VALUES (p_circle_id, v_uid, 'member', 'pending');

  RETURN 'requested';
END;
$$;


-- -----------------------------------------------------------------------------
-- 設立時にスコープを指定できるようにする
-- -----------------------------------------------------------------------------
-- 【重要】先に 0002 で作った2引数版を削除する。
-- CREATE OR REPLACE は引数リストが変わると「置き換え」ではなく
-- 「オーバーロードの追加」になるため、両方が共存してしまう。
-- その状態で create_circle('名前') を呼ぶと
-- 「function create_circle(unknown) is not unique」で失敗する。
-- -----------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.create_circle(TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.create_circle(
  p_name           TEXT,
  p_description    TEXT   DEFAULT NULL,
  p_scope          TEXT   DEFAULT 'university',
  p_university_ids UUID[] DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid           UUID := auth.uid();
  v_role          TEXT;
  v_university_id UUID;
  v_circle_id     UUID;
  v_name          TEXT;
  v_scope         TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'ログインが必要です';
  END IF;

  v_name := nullif(btrim(coalesce(p_name, '')), '');
  IF v_name IS NULL THEN
    RAISE EXCEPTION 'サークル名を入力してください';
  END IF;

  v_scope := coalesce(p_scope, 'university');
  IF v_scope NOT IN ('university', 'scoped', 'public') THEN
    RAISE EXCEPTION '公開範囲の指定が不正です';
  END IF;

  SELECT role INTO v_role FROM public.users WHERE id = v_uid;
  IF v_role IS DISTINCT FROM 'student' THEN
    RAISE EXCEPTION 'サークルを設立できるのは学生のみです';
  END IF;

  SELECT university_id INTO v_university_id
  FROM public.student_profiles WHERE user_id = v_uid;

  IF v_university_id IS NULL THEN
    RAISE EXCEPTION '所属大学が未設定です。プロフィールを設定してください';
  END IF;

  IF v_scope = 'scoped'
     AND (p_university_ids IS NULL OR array_length(p_university_ids, 1) IS NULL) THEN
    RAISE EXCEPTION '範囲を指定する場合は対象大学を1つ以上選んでください';
  END IF;

  INSERT INTO public.circles (university_id, name, description, status, scope)
  VALUES (
    v_university_id, v_name,
    nullif(btrim(coalesce(p_description, '')), ''),
    'pending', v_scope
  )
  RETURNING id INTO v_circle_id;

  IF v_scope = 'scoped' THEN
    INSERT INTO public.circle_universities (circle_id, university_id)
    SELECT v_circle_id, u
    FROM unnest(p_university_ids) AS u
    WHERE EXISTS (SELECT 1 FROM public.universities WHERE id = u)
    ON CONFLICT DO NOTHING;
  END IF;

  INSERT INTO public.circle_members (circle_id, user_id, role, status)
  VALUES (v_circle_id, v_uid, 'admin', 'active');

  RETURN v_circle_id;
END;
$$;
