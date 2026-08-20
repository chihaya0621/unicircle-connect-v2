-- =============================================================================
-- 施設予約
-- =============================================================================
-- 最重要の論点は二重予約の防止。
--
-- 「予約前に空きを SELECT して、空いていれば INSERT する」方式は競合に弱い。
-- 2人が同時に確認すると両方とも空きと判断し、両方 INSERT が通ってしまう。
-- アプリ側のチェックだけでは原理的に塞げないため、排他制約で DB に守らせる。
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 時間帯の重複を禁止する排他制約
-- -----------------------------------------------------------------------------
-- GiST インデックスで「同じ施設 (=) かつ 時間帯が重なる (&&)」行の共存を禁じる。
-- facility_id は UUID の等価比較なので、GiST で扱うには btree_gist が要る。
--
-- 却下済み (rejected) の予約は枠を占有しないので対象外にする。
-- pending は対象に含める（先に申請した人が枠を押さえる）。含めないと
-- 職員が承認する時点で重複が発覚し、承認作業が破綻するため。
-- -----------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE facility_reservations
  DROP CONSTRAINT IF EXISTS no_overlapping_reservations;

ALTER TABLE facility_reservations
  ADD CONSTRAINT no_overlapping_reservations
  EXCLUDE USING gist (
    facility_id WITH =,
    tstzrange(start_time, end_time) WITH &&
  )
  WHERE (status <> 'rejected');

COMMENT ON CONSTRAINT no_overlapping_reservations ON facility_reservations IS
  '同一施設で時間帯が重なる予約を禁止する。却下済みは枠を解放する。';


-- -----------------------------------------------------------------------------
-- 予約申請
-- -----------------------------------------------------------------------------
-- 予約主体の排他的関連:
--   個人予約     → booked_by_user_id のみ
--   サークル予約 → group_circle_id のみ
-- どちらか一方だけが NOT NULL になるよう、この関数で振り分ける。
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_reservation(
  p_facility_id UUID,
  p_start       TIMESTAMPTZ,
  p_end         TIMESTAMPTZ,
  p_purpose     TEXT DEFAULT NULL,
  p_circle_id   UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid            UUID := auth.uid();
  v_role           TEXT;
  v_university_id  UUID;
  v_fac_university UUID;
  v_fac_available  BOOLEAN;
  v_reservation_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'ログインが必要です';
  END IF;

  SELECT role INTO v_role FROM public.users WHERE id = v_uid;
  IF v_role IS DISTINCT FROM 'student' THEN
    RAISE EXCEPTION '施設を予約できるのは学生のみです';
  END IF;

  IF p_start IS NULL OR p_end IS NULL THEN
    RAISE EXCEPTION '開始時刻と終了時刻を入力してください';
  END IF;
  IF p_end <= p_start THEN
    RAISE EXCEPTION '終了時刻は開始時刻より後にしてください';
  END IF;
  IF p_start < now() THEN
    RAISE EXCEPTION '過去の日時は予約できません';
  END IF;

  SELECT university_id, is_available
    INTO v_fac_university, v_fac_available
  FROM public.facilities WHERE id = p_facility_id;

  IF v_fac_university IS NULL THEN
    RAISE EXCEPTION '施設が見つかりません';
  END IF;
  IF NOT v_fac_available THEN
    RAISE EXCEPTION 'この施設は現在利用できません';
  END IF;

  SELECT university_id INTO v_university_id
  FROM public.student_profiles WHERE user_id = v_uid;

  -- 施設は大学の資産なので、他大学の学生には貸さない。
  -- インカレサークルであっても、施設の所属大学の学生が予約する必要がある。
  IF v_university_id IS DISTINCT FROM v_fac_university THEN
    RAISE EXCEPTION '所属大学の施設のみ予約できます';
  END IF;

  IF p_circle_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.circle_members cm
      JOIN public.circles c ON c.id = cm.circle_id
      WHERE cm.circle_id = p_circle_id
        AND cm.user_id = v_uid
        AND cm.status = 'active'
        AND c.status = 'approved'
    ) THEN
      RAISE EXCEPTION '参加中の承認済みサークルのみ選択できます';
    END IF;

    INSERT INTO public.facility_reservations
      (facility_id, group_circle_id, start_time, end_time, purpose, status)
    VALUES (p_facility_id, p_circle_id, p_start, p_end,
            nullif(btrim(coalesce(p_purpose, '')), ''), 'pending')
    RETURNING id INTO v_reservation_id;
  ELSE
    INSERT INTO public.facility_reservations
      (facility_id, booked_by_user_id, start_time, end_time, purpose, status)
    VALUES (p_facility_id, v_uid, p_start, p_end,
            nullif(btrim(coalesce(p_purpose, '')), ''), 'pending')
    RETURNING id INTO v_reservation_id;
  END IF;

  RETURN v_reservation_id;

EXCEPTION
  -- 排他制約に当たった場合はユーザーに伝わる文言へ翻訳する
  WHEN exclusion_violation THEN
    RAISE EXCEPTION 'その時間帯はすでに予約されています';
END;
$$;


-- -----------------------------------------------------------------------------
-- 予約の承認 / 却下（大学職員のみ、自大学の施設に限る）
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.decide_reservation(
  p_reservation_id UUID,
  p_approve        BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid         UUID := auth.uid();
  v_role        TEXT;
  v_staff_univ  UUID;
  v_fac_univ    UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'ログインが必要です';
  END IF;

  SELECT role INTO v_role FROM public.users WHERE id = v_uid;
  IF v_role IS DISTINCT FROM 'staff' THEN
    RAISE EXCEPTION '予約の承認は大学職員のみ行えます';
  END IF;

  SELECT sp.university_id INTO v_staff_univ
  FROM public.staff_profiles sp WHERE sp.user_id = v_uid;

  SELECT f.university_id INTO v_fac_univ
  FROM public.facility_reservations r
  JOIN public.facilities f ON f.id = r.facility_id
  WHERE r.id = p_reservation_id;

  IF v_fac_univ IS NULL THEN
    RAISE EXCEPTION '予約が見つかりません';
  END IF;
  IF v_staff_univ IS DISTINCT FROM v_fac_univ THEN
    RAISE EXCEPTION '所属大学の施設の予約のみ操作できます';
  END IF;

  UPDATE public.facility_reservations
  SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END
  WHERE id = p_reservation_id;
END;
$$;


-- -----------------------------------------------------------------------------
-- 予約の取り消し（申請者本人、または当該サークルの管理者）
-- -----------------------------------------------------------------------------
-- 取り消しは削除ではなく rejected にする。排他制約の WHERE 句により
-- 枠が解放され、他の人が同じ時間帯を予約できるようになる。
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.cancel_reservation(p_reservation_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid     UUID := auth.uid();
  v_booker  UUID;
  v_circle  UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'ログインが必要です';
  END IF;

  SELECT booked_by_user_id, group_circle_id INTO v_booker, v_circle
  FROM public.facility_reservations WHERE id = p_reservation_id;

  IF v_booker IS NULL AND v_circle IS NULL THEN
    RAISE EXCEPTION '予約が見つかりません';
  END IF;

  IF v_booker IS DISTINCT FROM v_uid
     AND NOT EXISTS (
       SELECT 1 FROM public.circle_members
       WHERE circle_id = v_circle AND user_id = v_uid
         AND role = 'admin' AND status = 'active'
     ) THEN
    RAISE EXCEPTION 'この予約を取り消す権限がありません';
  END IF;

  UPDATE public.facility_reservations
  SET status = 'rejected' WHERE id = p_reservation_id;
END;
$$;


-- -----------------------------------------------------------------------------
-- 施設マスタの登録（大学職員のみ）
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_facility(
  p_name     TEXT,
  p_category TEXT DEFAULT 'facility'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid        UUID := auth.uid();
  v_role       TEXT;
  v_staff_univ UUID;
  v_name       TEXT;
  v_id         UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'ログインが必要です';
  END IF;

  SELECT role INTO v_role FROM public.users WHERE id = v_uid;
  IF v_role IS DISTINCT FROM 'staff' THEN
    RAISE EXCEPTION '施設を登録できるのは大学職員のみです';
  END IF;

  v_name := nullif(btrim(coalesce(p_name, '')), '');
  IF v_name IS NULL THEN
    RAISE EXCEPTION '施設名を入力してください';
  END IF;

  IF p_category NOT IN ('facility', 'equipment') THEN
    RAISE EXCEPTION '区分の指定が不正です';
  END IF;

  SELECT university_id INTO v_staff_univ
  FROM public.staff_profiles WHERE user_id = v_uid;

  IF v_staff_univ IS NULL THEN
    RAISE EXCEPTION '所属大学が未設定です';
  END IF;

  INSERT INTO public.facilities (university_id, name, category, is_available)
  VALUES (v_staff_univ, v_name, p_category, true)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;


-- -----------------------------------------------------------------------------
-- 施設の利用可否の切り替え（大学職員のみ、自大学の施設に限る）
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_facility_availability(
  p_facility_id UUID,
  p_available   BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid        UUID := auth.uid();
  v_role       TEXT;
  v_staff_univ UUID;
  v_fac_univ   UUID;
BEGIN
  SELECT role INTO v_role FROM public.users WHERE id = v_uid;
  IF v_role IS DISTINCT FROM 'staff' THEN
    RAISE EXCEPTION '施設の管理は大学職員のみ行えます';
  END IF;

  SELECT university_id INTO v_staff_univ
  FROM public.staff_profiles WHERE user_id = v_uid;
  SELECT university_id INTO v_fac_univ
  FROM public.facilities WHERE id = p_facility_id;

  IF v_fac_univ IS NULL THEN
    RAISE EXCEPTION '施設が見つかりません';
  END IF;
  IF v_staff_univ IS DISTINCT FROM v_fac_univ THEN
    RAISE EXCEPTION '所属大学の施設のみ管理できます';
  END IF;

  UPDATE public.facilities SET is_available = p_available
  WHERE id = p_facility_id;
END;
$$;
