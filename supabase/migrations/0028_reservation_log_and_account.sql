-- =============================================================================
-- 施設予約の承認記録と、アカウントの削除
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. 施設予約の承認も記録する
-- -----------------------------------------------------------------------------
-- 予約は1人の承認で通す運用のままにする（日々の運用なので）。
-- 記録だけを残す。
--
-- 承認の判定そのものはサークルと違って人数を数えないので、
-- RPC ではなくトリガーで拾う。状態の変化を捉える方が、
-- 後から書き込み経路が増えても取りこぼさない（通知と同じ考え方）。

CREATE OR REPLACE FUNCTION public.log_reservation_decision()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_name TEXT;
BEGIN
  IF NEW.status = OLD.status OR NEW.status NOT IN ('approved', 'rejected') THEN
    RETURN NEW;
  END IF;

  -- 誰の操作か分からないとき（定期処理など）は記録しない
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_name FROM public.users WHERE id = auth.uid();

  INSERT INTO public.approvals
    (target_type, target_id, approver_id, approver_name, decision)
  VALUES ('reservation', NEW.id, auth.uid(), coalesce(v_name, '不明'), NEW.status)
  ON CONFLICT (target_type, target_id, approver_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_reservation_decision ON facility_reservations;
CREATE TRIGGER trg_log_reservation_decision
  AFTER UPDATE OF status ON facility_reservations
  FOR EACH ROW EXECUTE FUNCTION public.log_reservation_decision();


-- -----------------------------------------------------------------------------
-- 2. アカウントの削除
-- -----------------------------------------------------------------------------
-- 一般アカウントのみ。学生と職員は大学が管理する立場なので、
-- 本人の操作で消せると在籍管理や承認の履歴が壊れる。
-- 消したいときは大学側の手続きに乗せる。
--
-- auth.users を消すと public.users へ ON DELETE CASCADE が伝わり、
-- 気になる大学・気になるサークル・通知まで一緒に消える。
-- 承認の記録（approvals）だけは approver_id が NULL になって残る。
-- 誰が押したかは approver_name に控えてあるので、履歴は途切れない。

CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp, auth
AS $$
DECLARE
  v_role TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'ログインが必要です';
  END IF;

  SELECT role INTO v_role FROM public.users WHERE id = auth.uid();

  IF v_role IS DISTINCT FROM 'general' THEN
    RAISE EXCEPTION
      '学生・職員アカウントはご自身では削除できません。大学の担当窓口にお問い合わせください';
  END IF;

  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_my_account() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;
