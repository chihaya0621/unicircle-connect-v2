-- =============================================================================
-- サークル機能: 設立と参加の RPC
-- =============================================================================
-- 設立は「circles の作成」と「作成者を管理者メンバーとして登録」の2操作から
-- なる。アプリ側で2回 INSERT すると、片方が失敗したときに
-- 「管理者が誰もいないサークル」が残ってしまうため、DB関数で
-- 1トランザクションにまとめる。
--
-- 認可判定も DB 側に置く。RLS が全許可の現状ではアプリ側チェックだけだと
-- PostgREST を直接叩かれて回避できるが、RPC 内の判定は迂回できない。
-- =============================================================================


-- -----------------------------------------------------------------------------
-- サークル設立
-- -----------------------------------------------------------------------------
-- - 学生のみ実行可能（職員・一般は不可）
-- - 所属大学は student_profiles から導出する。引数で受け取ると
--   他大学のサークルを勝手に作れてしまうため。
-- - status は 'pending'。職員が承認するまで一覧には出ない。
-- - 作成者は自動的に 'admin' / 'active' のメンバーになる。
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_circle(
  p_name        TEXT,
  p_description TEXT DEFAULT NULL
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
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'ログインが必要です';
  END IF;

  v_name := nullif(btrim(coalesce(p_name, '')), '');
  IF v_name IS NULL THEN
    RAISE EXCEPTION 'サークル名を入力してください';
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

  INSERT INTO public.circles (university_id, name, description, status)
  VALUES (v_university_id, v_name, nullif(btrim(coalesce(p_description, '')), ''), 'pending')
  RETURNING id INTO v_circle_id;

  -- 設立者は承認待ちを経ずに管理者として参加させる
  INSERT INTO public.circle_members (circle_id, user_id, role, status)
  VALUES (v_circle_id, v_uid, 'admin', 'active');

  RETURN v_circle_id;
END;
$$;


-- -----------------------------------------------------------------------------
-- 参加申請
-- -----------------------------------------------------------------------------
-- - 学生のみ。一般ユーザーはサークルに参加できない（要件定義書3章）。
-- - 承認済みサークルにのみ申請できる。
-- - 既に申請/参加している場合は何もしない（UNIQUE 制約に任せず明示的に扱う）。
-- - 過去に rejected された場合は再申請できるよう pending に戻す。
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
-- メンバーの承認 / 却下（サークル管理者のみ）
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.decide_circle_member(
  p_circle_id UUID,
  p_user_id   UUID,
  p_approve   BOOLEAN
)
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

  IF NOT EXISTS (
    SELECT 1 FROM public.circle_members
    WHERE circle_id = p_circle_id AND user_id = v_uid
      AND role = 'admin' AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'このサークルの管理者のみ操作できます';
  END IF;

  -- 管理者が自分自身を却下して管理者不在になるのを防ぐ
  IF p_user_id = v_uid AND NOT p_approve THEN
    RAISE EXCEPTION '自分自身を却下することはできません';
  END IF;

  UPDATE public.circle_members
  SET status = CASE WHEN p_approve THEN 'active' ELSE 'rejected' END
  WHERE circle_id = p_circle_id AND user_id = p_user_id;
END;
$$;


-- -----------------------------------------------------------------------------
-- サークル設立の承認 / 却下（大学職員のみ）
-- -----------------------------------------------------------------------------
-- 職員は自分の所属大学のサークルのみ承認できる。
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.decide_circle(
  p_circle_id UUID,
  p_approve   BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid           UUID := auth.uid();
  v_role          TEXT;
  v_staff_univ    UUID;
  v_circle_univ   UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'ログインが必要です';
  END IF;

  SELECT role INTO v_role FROM public.users WHERE id = v_uid;
  IF v_role IS DISTINCT FROM 'staff' THEN
    RAISE EXCEPTION 'サークルの承認は大学職員のみ行えます';
  END IF;

  SELECT university_id INTO v_staff_univ
  FROM public.staff_profiles WHERE user_id = v_uid;

  SELECT university_id INTO v_circle_univ
  FROM public.circles WHERE id = p_circle_id;

  IF v_circle_univ IS NULL THEN
    RAISE EXCEPTION 'サークルが見つかりません';
  END IF;

  IF v_staff_univ IS DISTINCT FROM v_circle_univ THEN
    RAISE EXCEPTION '所属大学のサークルのみ承認できます';
  END IF;

  UPDATE public.circles
  SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END
  WHERE id = p_circle_id;
END;
$$;
