-- =============================================================================
-- 参加登録できる人を学生に限る
-- =============================================================================
-- 一般ユーザー（高校生・企業）は公開イベントを「見に来る」立場であって、
-- 参加者名簿に載る立場ではない。職員も同じで、画面上も参加導線は無い。
--
-- これまで join_event は役割を見ていなかった。公開イベントであれば
-- 誰でも登録が通る状態で、画面に出していなかっただけだった。
-- 名簿は出欠管理に使われるので、ここは画面ではなく DB で塞ぐ。
--
-- 退会（leave_event）は塞がない。すでに登録が残っている人が
-- 自分で取り消せなくなると、名簿から降りる手段が無くなるため。
--
-- 【CREATE OR REPLACE の注意】
-- 0008_rls.sql が join_event を SECURITY DEFINER に変えている。
-- 書き込みポリシーは存在せず、この関数が唯一の書き込み経路なので、
-- 作り直すときに SECURITY DEFINER を書き忘れると INVOKER に戻り、
-- 学生も含めて誰も参加登録できなくなる。
-- =============================================================================

CREATE OR REPLACE FUNCTION public.join_event(p_event_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
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

  IF v_role IS DISTINCT FROM 'student' THEN
    RAISE EXCEPTION '参加登録できるのは学生のみです';
  END IF;

  v_univ := (SELECT university_id FROM public.student_profiles WHERE user_id = v_uid);

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

REVOKE EXECUTE ON FUNCTION public.join_event(UUID) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.join_event(UUID) TO authenticated;
