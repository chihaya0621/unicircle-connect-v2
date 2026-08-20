-- =============================================================================
-- 施設・備品の編集と削除
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 施設・備品の編集（大学職員のみ、自大学に限る）
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_facility(
  p_facility_id UUID,
  p_name        TEXT,
  p_category    TEXT
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
  v_name       TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'ログインが必要です';
  END IF;

  SELECT role INTO v_role FROM public.users WHERE id = v_uid;
  IF v_role IS DISTINCT FROM 'staff' THEN
    RAISE EXCEPTION '施設の管理は大学職員のみ行えます';
  END IF;

  v_name := nullif(btrim(coalesce(p_name, '')), '');
  IF v_name IS NULL THEN
    RAISE EXCEPTION '名称を入力してください';
  END IF;

  IF p_category NOT IN ('facility', 'equipment') THEN
    RAISE EXCEPTION '区分の指定が不正です';
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

  UPDATE public.facilities
  SET name = v_name, category = p_category
  WHERE id = p_facility_id;
END;
$$;


-- -----------------------------------------------------------------------------
-- 施設・備品の削除（大学職員のみ、自大学に限る）
-- -----------------------------------------------------------------------------
-- 【重要】facility_reservations は facility_id に ON DELETE CASCADE が
-- 付いているため、施設を削除すると紐づく予約もすべて消える。
--
-- そのため、これから先の有効な予約が残っている場合は削除を拒否する。
-- 利用者の予約が予告なく消えるのを防ぐのが目的。
-- 一時的に使わせたくないだけなら set_facility_availability で
-- 利用停止にすればよい。
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.delete_facility(p_facility_id UUID)
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
  v_active     INT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'ログインが必要です';
  END IF;

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

  SELECT count(*) INTO v_active
  FROM public.facility_reservations
  WHERE facility_id = p_facility_id
    AND status <> 'rejected'
    AND end_time >= now();

  IF v_active > 0 THEN
    RAISE EXCEPTION
      '今後の予約が%件残っているため削除できません。予約の完了を待つか、利用停止に切り替えてください',
      v_active;
  END IF;

  DELETE FROM public.facilities WHERE id = p_facility_id;
END;
$$;
