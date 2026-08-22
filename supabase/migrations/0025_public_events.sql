-- =============================================================================
-- 学外の方に案内するイベント
-- =============================================================================
-- 未ログインのイベント一覧には、公開設定の大学主催イベントが全部並ぶ。
-- 大学が増えれば何万件にもなるうえ、防災訓練や図書館ガイダンスのような
-- 学内向けの行事まで混ざる。学外の人が探しているのは
-- オープンキャンパスや学園祭であって、それらではない。
--
-- visibility は「誰が見てよいか」の軸で、「学外の方に案内する行事か」とは別。
-- 掲載可否を独立した列に分ける（サークルの public_listed と同じ考え方）。
--
-- 既定は false。サークルと違い、イベントは学内向けのものが大半なので、
-- 黙って外に出る側の既定にはしない。
-- =============================================================================

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS public_listed BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN events.public_listed IS
  '学外の方向けの案内に載せるか。オープンキャンパスや学園祭を想定。'
  'visibility（誰が見てよいか）とは別の軸。';

-- 未ログインの一覧はこの3条件で引く
CREATE INDEX IF NOT EXISTS idx_events_public_listed
  ON events(event_date)
  WHERE public_listed AND host_university_id IS NOT NULL;


-- -----------------------------------------------------------------------------
-- 作成時に指定できるようにする
-- -----------------------------------------------------------------------------
-- 引数が増えるので、多重定義にならないよう古い版を先に落とす。
--
-- 【SECURITY DEFINER の注意】
-- 0005 では INVOKER で定義しているが、0008 が DEFINER に変えている。
-- events には INSERT ポリシーが無く、この関数が唯一の書き込み経路なので、
-- 作り直すときに DEFINER を書き忘れると誰もイベントを作れなくなる。

DROP FUNCTION IF EXISTS public.create_event(
  TEXT, TIMESTAMPTZ, TEXT, TEXT, UUID, TEXT[], UUID[]
);

CREATE OR REPLACE FUNCTION public.create_event(
  p_title          TEXT,
  p_event_date     TIMESTAMPTZ,
  p_description    TEXT   DEFAULT NULL,
  p_visibility     TEXT   DEFAULT 'internal',
  p_circle_id      UUID   DEFAULT NULL,
  p_target_grades  TEXT[] DEFAULT NULL,
  p_university_ids UUID[] DEFAULT NULL,
  p_public_listed  BOOLEAN DEFAULT false
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid        UUID := auth.uid();
  v_role       TEXT;
  v_title      TEXT;
  v_visibility TEXT;
  v_univ       UUID;
  v_event_id   UUID;
  v_listed     BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'ログインが必要です';
  END IF;

  v_title := nullif(btrim(coalesce(p_title, '')), '');
  IF v_title IS NULL THEN
    RAISE EXCEPTION 'イベント名を入力してください';
  END IF;

  IF p_event_date IS NULL THEN
    RAISE EXCEPTION '開催日時を入力してください';
  END IF;
  IF p_event_date < now() THEN
    RAISE EXCEPTION '過去の日時にはイベントを作成できません';
  END IF;

  v_visibility := coalesce(p_visibility, 'internal');
  IF v_visibility NOT IN ('internal', 'scoped', 'public') THEN
    RAISE EXCEPTION '公開範囲の指定が不正です';
  END IF;
  IF v_visibility = 'scoped'
     AND (p_university_ids IS NULL OR array_length(p_university_ids, 1) IS NULL) THEN
    RAISE EXCEPTION '範囲を指定する場合は対象大学を1つ以上選んでください';
  END IF;

  -- 学内限定のものを学外に案内することはできない
  v_listed := coalesce(p_public_listed, false) AND v_visibility = 'public';

  SELECT role INTO v_role FROM public.users WHERE id = v_uid;

  IF p_circle_id IS NOT NULL THEN
    ----------------------------------------------------------------- サークル主催
    IF NOT EXISTS (
      SELECT 1 FROM public.circle_members cm
      JOIN public.circles c ON c.id = cm.circle_id
      WHERE cm.circle_id = p_circle_id
        AND cm.user_id = v_uid
        AND cm.role = 'admin'
        AND cm.status = 'active'
        AND c.status = 'approved'
    ) THEN
      RAISE EXCEPTION '承認済みサークルの管理者のみイベントを作成できます';
    END IF;

    INSERT INTO public.events
      (host_university_id, host_circle_id, title, description,
       event_date, visibility, target_grades, public_listed)
    VALUES
      (NULL, p_circle_id, v_title,
       nullif(btrim(coalesce(p_description, '')), ''),
       p_event_date, v_visibility, p_target_grades, v_listed)
    RETURNING id INTO v_event_id;
  ELSE
    ----------------------------------------------------------------- 大学主催
    IF v_role IS DISTINCT FROM 'staff' THEN
      RAISE EXCEPTION '大学公式イベントを作成できるのは職員のみです';
    END IF;

    SELECT university_id INTO v_univ
    FROM public.staff_profiles WHERE user_id = v_uid;

    IF v_univ IS NULL THEN
      RAISE EXCEPTION '所属大学が未設定です';
    END IF;

    INSERT INTO public.events
      (host_university_id, host_circle_id, title, description,
       event_date, visibility, target_grades, public_listed)
    VALUES
      (v_univ, NULL, v_title,
       nullif(btrim(coalesce(p_description, '')), ''),
       p_event_date, v_visibility, p_target_grades, v_listed)
    RETURNING id INTO v_event_id;
  END IF;

  IF v_visibility = 'scoped' THEN
    INSERT INTO public.event_universities (event_id, university_id)
    SELECT v_event_id, u
    FROM unnest(p_university_ids) AS u
    WHERE EXISTS (SELECT 1 FROM public.universities WHERE id = u)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN v_event_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_event(
  TEXT, TIMESTAMPTZ, TEXT, TEXT, UUID, TEXT[], UUID[], BOOLEAN) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_event(
  TEXT, TIMESTAMPTZ, TEXT, TEXT, UUID, TEXT[], UUID[], BOOLEAN) TO authenticated;


-- -----------------------------------------------------------------------------
-- 既存データの補完
-- -----------------------------------------------------------------------------
-- デモの大学主催イベントのうち、名前から学外向けと分かるものだけ立てる。
-- 防災訓練・図書館ガイダンス・履修登録のような学内向けは対象にしない。

UPDATE events
   SET public_listed = true
 WHERE visibility = 'public'
   AND host_university_id IS NOT NULL
   AND public_listed = false
   AND (title LIKE '%オープンキャンパス%'
     OR title LIKE '%学園祭%'
     OR title LIKE '%大学祭%'
     OR title LIKE '%見学会%'
     OR title LIKE '%公開講座%');
