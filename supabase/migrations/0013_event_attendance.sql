-- =============================================================================
-- イベントの出欠記録
-- =============================================================================
-- 流れ:
--   1. メンバーがイベントに参加登録する（既存の event_participants）
--   2. 当日、主催者が参加名簿を開いて出席/欠席を記録する
--
-- 0012 で circle_activities / activity_attendances を作ったが、
-- 出欠の対象はイベントそのものであるべきだった。同じ「出欠」の概念を
-- 2箇所に持つと記録が分散するため、0012 の仕組みは撤去する。
-- （必要になれば git 履歴から戻せる）
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 0012 の撤去
-- -----------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.set_attendance(UUID, TEXT, UUID);
DROP FUNCTION IF EXISTS public.create_activity(UUID, TEXT, TIMESTAMPTZ, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.delete_activity(UUID);
DROP TABLE IF EXISTS public.activity_attendances CASCADE;
DROP TABLE IF EXISTS public.circle_activities    CASCADE;


-- -----------------------------------------------------------------------------
-- 参加登録に出欠を持たせる
-- -----------------------------------------------------------------------------
-- attended は3状態を表す:
--   NULL  … まだ記録していない
--   true  … 出席
--   false … 欠席（登録したが来なかった）
--
-- 「未記録」と「欠席」を区別できるようにしている。区別が無いと、
-- 記録を取り忘れた回で全員が欠席扱いになってしまう。
-- -----------------------------------------------------------------------------

ALTER TABLE event_participants
  ADD COLUMN IF NOT EXISTS attended BOOLEAN,
  ADD COLUMN IF NOT EXISTS attendance_recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS attendance_recorded_at TIMESTAMPTZ;

COMMENT ON COLUMN event_participants.attended IS
  'NULL=未記録 / true=出席 / false=欠席。主催者が当日に記録する';


-- -----------------------------------------------------------------------------
-- 出欠の記録（主催者のみ）
-- -----------------------------------------------------------------------------
-- 主催者の判定は app_can_manage_event() を使う。
-- 大学主催なら同じ大学の職員、サークル主催ならそのサークルの管理者。
-- イベントの削除権限と同じ基準に揃えている。
--
-- p_attended に NULL を渡すと「未記録」に戻せる。押し間違いの取り消し用。
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.record_event_attendance(
  p_event_id UUID,
  p_user_id  UUID,
  p_attended BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'ログインが必要です';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.events WHERE id = p_event_id) THEN
    RAISE EXCEPTION 'イベントが見つかりません';
  END IF;

  IF NOT public.app_can_manage_event(p_event_id) THEN
    RAISE EXCEPTION '出欠を記録できるのはイベントの主催者のみです';
  END IF;

  -- 参加登録している人だけが名簿に載る
  IF NOT EXISTS (
    SELECT 1 FROM public.event_participants
    WHERE event_id = p_event_id AND user_id = p_user_id AND status = 'going'
  ) THEN
    RAISE EXCEPTION 'このイベントに参加登録していません';
  END IF;

  UPDATE public.event_participants
  SET attended               = p_attended,
      attendance_recorded_by = CASE WHEN p_attended IS NULL THEN NULL ELSE v_uid END,
      attendance_recorded_at = CASE WHEN p_attended IS NULL THEN NULL ELSE NOW() END
  WHERE event_id = p_event_id AND user_id = p_user_id;
END;
$$;


-- -----------------------------------------------------------------------------
-- 参加名簿（主催者のみ）
-- -----------------------------------------------------------------------------
-- 参加者の氏名は users から引けるが、主催者かどうかの判定を1か所に
-- まとめたいのと、未記録を含めた名簿を安定した順序で返したいので関数にする。
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.list_event_roster(p_event_id UUID)
RETURNS TABLE (
  roster_user_id  UUID,
  roster_name     TEXT,
  roster_attended BOOLEAN,
  roster_joined_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.app_can_manage_event(p_event_id) THEN
    RAISE EXCEPTION '参加名簿を見られるのはイベントの主催者のみです';
  END IF;

  RETURN QUERY
  SELECT ep.user_id, u.name, ep.attended, ep.created_at
  FROM public.event_participants ep
  JOIN public.users u ON u.id = ep.user_id
  WHERE ep.event_id = p_event_id AND ep.status = 'going'
  ORDER BY u.name;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.list_event_roster(UUID) FROM public, anon;
