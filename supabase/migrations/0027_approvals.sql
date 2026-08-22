-- =============================================================================
-- 承認の記録と、複数人による承認
-- =============================================================================
-- 紙の運用では、設立のような重い決裁に複数人の印鑑が要る。
-- 誰が押したかも残る。いまの実装は「職員が1人押せば通る・記録は残らない」
-- なので、そこを合わせる。
--
-- 何人必要かは大学ごとに違うので、大学の属性として持つ。
-- 施設の利用は日々の運用なので1人のままにする（既定値が1）。
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. 承認の記録
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS approvals (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type TEXT NOT NULL CHECK (target_type IN (
    'circle',          -- サークルの設立
    'circle_closure',  -- サークルの廃止
    'reservation'      -- 施設の予約
  )),
  target_id   UUID NOT NULL,
  approver_id UUID REFERENCES users(id) ON DELETE SET NULL,
  /** 記録した時点の氏名。退職などで行が消えても誰が押したか残す */
  approver_name TEXT NOT NULL,
  decision    TEXT NOT NULL CHECK (decision IN ('approved', 'rejected')),
  comment     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- 同じ人が同じ案件に二度は押せない
  UNIQUE (target_type, target_id, approver_id)
);

CREATE INDEX IF NOT EXISTS idx_approvals_target
  ON approvals(target_type, target_id, created_at);

COMMENT ON TABLE approvals IS
  '誰がいつ何を承認・却下したかの記録。取り消しはせず、積み上げる。';

ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;

-- 対象そのものが読めるなら、その承認履歴も読める。
-- EXISTS の中で対象テーブルの RLS が効くので、可視範囲は自動で揃う。
DROP POLICY IF EXISTS approvals_select ON approvals;
CREATE POLICY approvals_select ON approvals
  FOR SELECT TO authenticated USING (
    CASE target_type
      WHEN 'reservation' THEN EXISTS (
        SELECT 1 FROM facility_reservations r WHERE r.id = target_id)
      ELSE EXISTS (
        SELECT 1 FROM circles c WHERE c.id = target_id)
    END
  );

REVOKE ALL ON approvals FROM anon;
GRANT SELECT ON approvals TO authenticated;


-- -----------------------------------------------------------------------------
-- 2. 何人の承認が要るか
-- -----------------------------------------------------------------------------
-- 既定は1。いまの挙動を変えずに移行できる。
-- 職員が2人以上いる大学は、必要に応じて引き上げる。

ALTER TABLE universities
  ADD COLUMN IF NOT EXISTS required_circle_approvals INT NOT NULL DEFAULT 1;

ALTER TABLE universities
  DROP CONSTRAINT IF EXISTS universities_required_circle_approvals_check;
ALTER TABLE universities
  ADD CONSTRAINT universities_required_circle_approvals_check
  CHECK (required_circle_approvals BETWEEN 1 AND 5);

COMMENT ON COLUMN universities.required_circle_approvals IS
  'サークルの設立・廃止に必要な承認者数。施設の予約には使わない。';

/** 承認に必要な人数を変える。その大学の職員のみ。 */
CREATE OR REPLACE FUNCTION public.set_required_circle_approvals(p_count INT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_university UUID := public.app_university_id();
  v_staff      INT;
BEGIN
  IF public.app_role() IS DISTINCT FROM 'staff' OR v_university IS NULL THEN
    RAISE EXCEPTION '設定できるのは大学職員のみです';
  END IF;
  IF p_count IS NULL OR p_count < 1 OR p_count > 5 THEN
    RAISE EXCEPTION '承認者数は1〜5人で指定してください';
  END IF;

  -- 職員の人数を超えると、誰も承認を完了できない状態になる
  SELECT count(*) INTO v_staff
    FROM public.staff_profiles WHERE university_id = v_university;

  IF p_count > v_staff THEN
    RAISE EXCEPTION
      '職員が%人しか登録されていないため、%人の承認は設定できません', v_staff, p_count;
  END IF;

  UPDATE public.universities
     SET required_circle_approvals = p_count
   WHERE id = v_university;
END;
$$;


-- -----------------------------------------------------------------------------
-- 3. 廃止の申請
-- -----------------------------------------------------------------------------
-- 申請中も活動は続くので status は動かさない。承認が揃った時点で closed。
-- status を途中で変えると、可視範囲の判定（circles_select）まで
-- 巻き込むことになる。

ALTER TABLE circles
  ADD COLUMN IF NOT EXISTS closure_requested_at TIMESTAMPTZ;

ALTER TABLE circles DROP CONSTRAINT IF EXISTS circles_status_check;
ALTER TABLE circles ADD CONSTRAINT circles_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'closed'));

COMMENT ON COLUMN circles.closure_requested_at IS
  '廃止を申請した日時。承認が揃うまでは活動を続けるので status は変えない。';

/** 廃止を申請する。サークル管理者のみ。取り下げは NULL を渡す。 */
CREATE OR REPLACE FUNCTION public.request_circle_closure(
  p_circle_id UUID,
  p_cancel    BOOLEAN DEFAULT false
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.app_is_circle_admin(p_circle_id) THEN
    RAISE EXCEPTION 'このサークルの管理者のみ申請できます';
  END IF;

  IF p_cancel THEN
    UPDATE public.circles SET closure_requested_at = NULL WHERE id = p_circle_id;
    -- 取り下げたら、集まりかけていた承認も無かったことにする
    DELETE FROM public.approvals
     WHERE target_type = 'circle_closure' AND target_id = p_circle_id;
    RETURN;
  END IF;

  UPDATE public.circles
     SET closure_requested_at = now()
   WHERE id = p_circle_id AND status = 'approved';

  IF NOT FOUND THEN
    RAISE EXCEPTION '承認済みのサークルのみ廃止を申請できます';
  END IF;
END;
$$;


-- -----------------------------------------------------------------------------
-- 4. 承認そのもの
-- -----------------------------------------------------------------------------

/**
 * 承認・却下を1件記録し、揃ったかどうかを判定する共通処理。
 *
 * 却下は1人で成立させる。紙の決裁と同じで、誰か1人が判を押さないと
 * そこで止まる。承認だけが人数を要する。
 *
 * 戻り値は 'pending'（まだ足りない）/ 'approved' / 'rejected'。
 */
CREATE OR REPLACE FUNCTION public.app_record_approval(
  p_target_type TEXT,
  p_target_id   UUID,
  p_approve     BOOLEAN,
  p_required    INT,
  p_comment     TEXT
)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_name  TEXT;
  v_count INT;
BEGIN
  SELECT name INTO v_name FROM public.users WHERE id = auth.uid();

  INSERT INTO public.approvals
    (target_type, target_id, approver_id, approver_name, decision, comment)
  VALUES (
    p_target_type, p_target_id, auth.uid(), coalesce(v_name, '不明'),
    CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
    nullif(btrim(coalesce(p_comment, '')), '')
  )
  ON CONFLICT (target_type, target_id, approver_id) DO NOTHING;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'すでにこの案件を処理しています';
  END IF;

  IF NOT p_approve THEN
    RETURN 'rejected';
  END IF;

  SELECT count(*) INTO v_count
    FROM public.approvals
   WHERE target_type = p_target_type
     AND target_id = p_target_id
     AND decision = 'approved';

  RETURN CASE WHEN v_count >= p_required THEN 'approved' ELSE 'pending' END;
END;
$$;


DROP FUNCTION IF EXISTS public.decide_circle(UUID, BOOLEAN);

/**
 * サークル設立の承認・却下。
 *
 * 大学が定めた人数ぶんの承認が集まって初めて approved になる。
 * それまでは pending のまま、承認の記録だけが積み上がる。
 */
CREATE OR REPLACE FUNCTION public.decide_circle(
  p_circle_id UUID,
  p_approve   BOOLEAN,
  p_comment   TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_circle_univ UUID;
  v_required    INT;
  v_result      TEXT;
BEGIN
  IF public.app_role() IS DISTINCT FROM 'staff' THEN
    RAISE EXCEPTION 'サークルの承認は大学職員のみ行えます';
  END IF;

  SELECT university_id INTO v_circle_univ
    FROM public.circles WHERE id = p_circle_id AND status = 'pending';

  IF v_circle_univ IS NULL THEN
    RAISE EXCEPTION '承認待ちのサークルが見つかりません';
  END IF;

  IF public.app_university_id() IS DISTINCT FROM v_circle_univ THEN
    RAISE EXCEPTION '所属大学のサークルのみ承認できます';
  END IF;

  SELECT required_circle_approvals INTO v_required
    FROM public.universities WHERE id = v_circle_univ;

  v_result := public.app_record_approval(
    'circle', p_circle_id, p_approve, coalesce(v_required, 1), p_comment);

  IF v_result <> 'pending' THEN
    UPDATE public.circles SET status = v_result WHERE id = p_circle_id;
  END IF;

  RETURN v_result;
END;
$$;


/** サークル廃止の承認・却下。必要人数は設立と同じ。 */
CREATE OR REPLACE FUNCTION public.decide_circle_closure(
  p_circle_id UUID,
  p_approve   BOOLEAN,
  p_comment   TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_circle_univ UUID;
  v_required    INT;
  v_result      TEXT;
BEGIN
  IF public.app_role() IS DISTINCT FROM 'staff' THEN
    RAISE EXCEPTION 'サークルの廃止は大学職員のみ判断できます';
  END IF;

  SELECT university_id INTO v_circle_univ
    FROM public.circles
   WHERE id = p_circle_id AND closure_requested_at IS NOT NULL;

  IF v_circle_univ IS NULL THEN
    RAISE EXCEPTION '廃止の申請が出ているサークルが見つかりません';
  END IF;

  IF public.app_university_id() IS DISTINCT FROM v_circle_univ THEN
    RAISE EXCEPTION '所属大学のサークルのみ判断できます';
  END IF;

  SELECT required_circle_approvals INTO v_required
    FROM public.universities WHERE id = v_circle_univ;

  v_result := public.app_record_approval(
    'circle_closure', p_circle_id, p_approve, coalesce(v_required, 1), p_comment);

  IF v_result = 'approved' THEN
    UPDATE public.circles
       SET status = 'closed', closure_requested_at = NULL
     WHERE id = p_circle_id;
  ELSIF v_result = 'rejected' THEN
    -- 却下されたら申請を取り下げた状態に戻す。活動はそのまま続く
    UPDATE public.circles
       SET closure_requested_at = NULL
     WHERE id = p_circle_id;
  END IF;

  RETURN v_result;
END;
$$;


-- -----------------------------------------------------------------------------
-- 5. 権限
-- -----------------------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION public.app_record_approval(TEXT, UUID, BOOLEAN, INT, TEXT)
  FROM public, anon, authenticated;

DO $$
DECLARE f TEXT;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'set_required_circle_approvals(integer)',
    'request_circle_closure(uuid,boolean)',
    'decide_circle(uuid,boolean,text)',
    'decide_circle_closure(uuid,boolean,text)'
  ] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM public, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END;
$$;
