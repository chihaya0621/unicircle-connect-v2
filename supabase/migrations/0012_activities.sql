-- =============================================================================
-- 活動記録と出欠管理
-- =============================================================================
-- 「いつ活動して、誰が来たか」を残す。
--
-- イベント (events) とは目的が違うので別テーブルにする。
--   events              … 対外的な告知。可視範囲があり、他大学にも見せる
--   circle_activities   … 内部の活動記録。メンバーしか見ない
-- 週2回の練習をイベントとして毎回告知するのは実態に合わない。
--
-- 【出欠の考え方】
--   本人が事前に「出席／欠席」を登録し、管理者が実績として上書きもできる。
--   欄を分けず1つの状態にまとめているのは、二重管理を避けるため。
--   誰が最後に記録したかは recorded_by で分かる。
-- =============================================================================

CREATE TABLE IF NOT EXISTS circle_activities (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id     UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  title         TEXT NOT NULL CHECK (btrim(title) <> ''),
  activity_date TIMESTAMPTZ NOT NULL,
  location      TEXT,
  note          TEXT,
  created_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_circle_activities_circle
  ON circle_activities(circle_id, activity_date DESC);

CREATE TABLE IF NOT EXISTS activity_attendances (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID NOT NULL REFERENCES circle_activities(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status      TEXT NOT NULL CHECK (status IN ('present', 'absent')),
  -- 本人が登録したのか管理者が記録したのかを残す
  recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (activity_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_activity_attendances_activity
  ON activity_attendances(activity_id);
CREATE INDEX IF NOT EXISTS idx_activity_attendances_user
  ON activity_attendances(user_id);

ALTER TABLE circle_activities    ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_attendances ENABLE ROW LEVEL SECURITY;

-- 読み取りのみ。書き込みは RPC 経由に限る（0008 の方針）。
DROP POLICY IF EXISTS circle_activities_select ON circle_activities;
CREATE POLICY circle_activities_select ON circle_activities
  FOR SELECT TO authenticated USING (public.app_is_circle_member(circle_id));

-- 出欠は同じサークルのメンバー同士で見える。
-- 「誰が来ているか」が分からないと出欠管理として機能しないため。
DROP POLICY IF EXISTS activity_attendances_select ON activity_attendances;
CREATE POLICY activity_attendances_select ON activity_attendances
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM circle_activities a
      WHERE a.id = activity_id AND public.app_is_circle_member(a.circle_id)
    )
  );


-- -----------------------------------------------------------------------------
-- 活動の登録・削除（管理者のみ）
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_activity(
  p_circle_id     UUID,
  p_title         TEXT,
  p_activity_date TIMESTAMPTZ,
  p_location      TEXT DEFAULT NULL,
  p_note          TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid   UUID := auth.uid();
  v_title TEXT;
  v_id    UUID;
BEGIN
  IF NOT public.app_is_circle_admin(p_circle_id) THEN
    RAISE EXCEPTION '活動を登録できるのはサークル管理者のみです';
  END IF;

  v_title := nullif(btrim(coalesce(p_title, '')), '');
  IF v_title IS NULL THEN
    RAISE EXCEPTION '活動名を入力してください';
  END IF;
  IF p_activity_date IS NULL THEN
    RAISE EXCEPTION '活動日時を入力してください';
  END IF;

  INSERT INTO public.circle_activities
    (circle_id, title, activity_date, location, note, created_by)
  VALUES (
    p_circle_id, v_title, p_activity_date,
    nullif(btrim(coalesce(p_location, '')), ''),
    nullif(btrim(coalesce(p_note, '')), ''),
    v_uid
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;


CREATE OR REPLACE FUNCTION public.delete_activity(p_activity_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_circle UUID;
BEGIN
  SELECT circle_id INTO v_circle
  FROM public.circle_activities WHERE id = p_activity_id;

  IF v_circle IS NULL THEN
    RAISE EXCEPTION '活動が見つかりません';
  END IF;
  IF NOT public.app_is_circle_admin(v_circle) THEN
    RAISE EXCEPTION '活動を削除できるのはサークル管理者のみです';
  END IF;

  DELETE FROM public.circle_activities WHERE id = p_activity_id;
END;
$$;


-- -----------------------------------------------------------------------------
-- 出欠の登録
-- -----------------------------------------------------------------------------
-- 本人は自分の出欠のみ。管理者は同じサークルの誰の出欠でも記録できる。
-- 対象ユーザーを省略すると自分自身になる。
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_attendance(
  p_activity_id UUID,
  p_status      TEXT,
  p_user_id     UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid    UUID := auth.uid();
  v_target UUID := coalesce(p_user_id, auth.uid());
  v_circle UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'ログインが必要です';
  END IF;

  IF p_status NOT IN ('present', 'absent') THEN
    RAISE EXCEPTION '出欠の指定が不正です';
  END IF;

  SELECT circle_id INTO v_circle
  FROM public.circle_activities WHERE id = p_activity_id;
  IF v_circle IS NULL THEN
    RAISE EXCEPTION '活動が見つかりません';
  END IF;

  -- 他人の出欠を記録できるのは管理者だけ
  IF v_target <> v_uid AND NOT public.app_is_circle_admin(v_circle) THEN
    RAISE EXCEPTION '他のメンバーの出欠を記録できるのは管理者のみです';
  END IF;

  -- 対象が実際にそのサークルのメンバーであること
  IF NOT EXISTS (
    SELECT 1 FROM public.circle_members
    WHERE circle_id = v_circle AND user_id = v_target AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'そのサークルのメンバーではありません';
  END IF;

  INSERT INTO public.activity_attendances
    (activity_id, user_id, status, recorded_by, recorded_at)
  VALUES (p_activity_id, v_target, p_status, v_uid, NOW())
  ON CONFLICT (activity_id, user_id) DO UPDATE
    SET status      = excluded.status,
        recorded_by = excluded.recorded_by,
        recorded_at = excluded.recorded_at;
END;
$$;
