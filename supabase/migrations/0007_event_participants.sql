-- =============================================================================
-- イベント参加登録
-- =============================================================================
-- カレンダーの既定表示に「参加確定しているイベント」を含めるために必要。
--
-- 要件定義書には無いテーブルなので、既存の設計方針に合わせている:
--   - 参加主体は個人（users）のみ。サークル単位の参加という概念は持たない
--   - UNIQUE(event_id, user_id) で二重登録を防ぐ
--   - status は circle_members と同じ語彙を避け、出欠の意味で 'going' / 'cancelled'
-- =============================================================================

CREATE TABLE IF NOT EXISTS event_participants (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  status     TEXT NOT NULL DEFAULT 'going' CHECK (status IN ('going', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_event_participants_user  ON event_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_event_participants_event ON event_participants(event_id);

DO $$
BEGIN
  EXECUTE 'ALTER TABLE public.event_participants ENABLE ROW LEVEL SECURITY';
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'event_participants'
      AND policyname = 'dev_allow_all_event_participants'
  ) THEN
    EXECUTE 'CREATE POLICY dev_allow_all_event_participants
             ON public.event_participants FOR ALL USING (true) WITH CHECK (true)';
  END IF;
END $$;


-- -----------------------------------------------------------------------------
-- イベントが閲覧者に見えるか（SQL 側の可視判定）
-- -----------------------------------------------------------------------------
-- lib/events.ts の eventVisibleTo() と同じ規則。
-- サークル主催の internal / scoped は、主催サークルの所属大学を
-- 主催大学とみなす。
--
-- 参加登録の可否判定に使う。見えないイベントに参加できてしまうと、
-- URL さえ知っていれば他大学の学内限定イベントに紛れ込めるため。
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.event_visible_to_university(
  p_event_id      UUID,
  p_university_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE e.visibility
    WHEN 'public' THEN TRUE
    WHEN 'internal' THEN
      coalesce(e.host_university_id, c.university_id) = p_university_id
    WHEN 'scoped' THEN
      coalesce(e.host_university_id, c.university_id) = p_university_id
      OR EXISTS (
        SELECT 1 FROM event_universities eu
        WHERE eu.event_id = e.id AND eu.university_id = p_university_id
      )
    ELSE FALSE
  END
  FROM events e
  LEFT JOIN circles c ON c.id = e.host_circle_id
  WHERE e.id = p_event_id;
$$;


-- -----------------------------------------------------------------------------
-- 参加登録 / 取り消し
-- -----------------------------------------------------------------------------
-- 一般ユーザーも公開イベントには参加できる（要件定義書3章では閲覧のみと
-- されているが、閲覧できるイベントへの出欠表明は閲覧の延長とみなす）。
-- 見えないイベントには参加できない。
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.join_event(p_event_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid   UUID := auth.uid();
  v_role  TEXT;
  v_univ  UUID;
  v_date  TIMESTAMPTZ;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'ログインが必要です';
  END IF;

  SELECT event_date INTO v_date FROM public.events WHERE id = p_event_id;
  IF v_date IS NULL THEN
    RAISE EXCEPTION 'イベントが見つかりません';
  END IF;
  IF v_date < now() THEN
    RAISE EXCEPTION '終了したイベントには参加登録できません';
  END IF;

  SELECT role INTO v_role FROM public.users WHERE id = v_uid;

  SELECT CASE v_role
    WHEN 'student' THEN (SELECT university_id FROM public.student_profiles WHERE user_id = v_uid)
    WHEN 'staff'   THEN (SELECT university_id FROM public.staff_profiles   WHERE user_id = v_uid)
    ELSE NULL
  END INTO v_univ;

  IF NOT public.event_visible_to_university(p_event_id, v_univ) THEN
    RAISE EXCEPTION 'このイベントには参加できません';
  END IF;

  INSERT INTO public.event_participants (event_id, user_id, status)
  VALUES (p_event_id, v_uid, 'going')
  ON CONFLICT (event_id, user_id)
  DO UPDATE SET status = 'going';

  RETURN 'going';
END;
$$;


CREATE OR REPLACE FUNCTION public.leave_event(p_event_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'ログインが必要です';
  END IF;

  UPDATE public.event_participants
  SET status = 'cancelled'
  WHERE event_id = p_event_id AND user_id = v_uid;
END;
$$;
