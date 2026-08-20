-- =============================================================================
-- 学生情報の登録を職員の管理下に置く
-- =============================================================================
-- これまではサインアップ時に role='student' と氏名・所属大学を自己申告できた。
-- しかし氏名は大学が把握する公式情報であり、本人が自由に変えられると
-- ふざけた名前での活動やなりすましを招く。
--
-- 【新しい流れ】
--   1. 本人がメールとパスワードで「一般ユーザー」として登録する
--   2. 職員がメールアドレスで探し、氏名・入学年度を登録して学生に切り替える
--   3. 以降、氏名・所属大学・入学年度は職員のみが変更できる
--      学生が編集できるのは自己紹介とスキルだけ
--
-- staff と同じく、権限と公式情報の付与は必ず職員を経由する形に統一する。
-- =============================================================================


-- -----------------------------------------------------------------------------
-- サインアップで作れるのは一般ユーザーだけにする
-- -----------------------------------------------------------------------------
-- 0001 では 'student' と 'general' を許可していた。raw_user_meta_data は
-- クライアントの制御下にあるため、'student' を許すと氏名・所属大学まで
-- 自己申告できてしまう。ここで 'general' のみに絞る。
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_name TEXT;
BEGIN
  -- 表示名は暫定値。正式な氏名は職員が register_student で登録する。
  v_name := nullif(btrim(coalesce(v_meta ->> 'name', '')), '');
  IF v_name IS NULL THEN
    v_name := split_part(coalesce(new.email, 'user'), '@', 1);
  END IF;

  INSERT INTO public.users (id, role, name)
  VALUES (new.id, 'general', v_name)
  ON CONFLICT (id) DO NOTHING;

  RETURN new;
END;
$$;


-- -----------------------------------------------------------------------------
-- 職員が学生を登録する
-- -----------------------------------------------------------------------------
-- メールアドレスで対象を特定する。auth.users は API から直接読めないため、
-- SECURITY DEFINER のこの関数が唯一の照会経路になる。
--
-- 所属大学は引数で受け取らず、実行した職員の所属大学を使う。
-- 他大学の学生を勝手に登録できないようにするため。
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.register_student(
  p_email           TEXT,
  p_name            TEXT,
  p_enrollment_year INT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid         UUID := auth.uid();
  v_role        TEXT;
  v_staff_univ  UUID;
  v_target      UUID;
  v_target_role TEXT;
  v_name        TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'ログインが必要です';
  END IF;

  SELECT role INTO v_role FROM public.users WHERE id = v_uid;
  IF v_role IS DISTINCT FROM 'staff' THEN
    RAISE EXCEPTION '学生を登録できるのは大学職員のみです';
  END IF;

  SELECT university_id INTO v_staff_univ
  FROM public.staff_profiles WHERE user_id = v_uid;
  IF v_staff_univ IS NULL THEN
    RAISE EXCEPTION '所属大学が未設定です';
  END IF;

  v_name := nullif(btrim(coalesce(p_name, '')), '');
  IF v_name IS NULL THEN
    RAISE EXCEPTION '氏名を入力してください';
  END IF;
  IF length(v_name) > 50 THEN
    RAISE EXCEPTION '氏名は50文字以内で入力してください';
  END IF;

  IF p_enrollment_year IS NOT NULL
     AND (p_enrollment_year < 1900 OR p_enrollment_year > 2100) THEN
    RAISE EXCEPTION '入学年度の指定が不正です';
  END IF;

  SELECT id INTO v_target
  FROM auth.users WHERE lower(email) = lower(btrim(p_email));

  IF v_target IS NULL THEN
    RAISE EXCEPTION 'そのメールアドレスのアカウントが見つかりません。本人に新規登録を案内してください';
  END IF;

  SELECT role INTO v_target_role FROM public.users WHERE id = v_target;
  IF v_target_role IS NULL THEN
    RAISE EXCEPTION 'アカウントの初期化が完了していません';
  END IF;
  IF v_target_role = 'staff' THEN
    RAISE EXCEPTION '職員アカウントを学生に変更することはできません';
  END IF;

  -- 既に他大学の学生として登録されている場合は横取りしない
  IF v_target_role = 'student'
     AND EXISTS (
       SELECT 1 FROM public.student_profiles
       WHERE user_id = v_target
         AND university_id IS DISTINCT FROM v_staff_univ
     ) THEN
    RAISE EXCEPTION '他大学の学生として登録されています';
  END IF;

  UPDATE public.users SET role = 'student', name = v_name WHERE id = v_target;

  INSERT INTO public.student_profiles (user_id, university_id, enrollment_year)
  VALUES (v_target, v_staff_univ, p_enrollment_year)
  ON CONFLICT (user_id) DO UPDATE
    SET university_id   = excluded.university_id,
        enrollment_year = excluded.enrollment_year;

  RETURN CASE WHEN v_target_role = 'student' THEN 'updated' ELSE 'registered' END;
END;
$$;


-- -----------------------------------------------------------------------------
-- 職員が登録済みの学生情報を修正する
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_student_info(
  p_user_id         UUID,
  p_name            TEXT,
  p_enrollment_year INT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid        UUID := auth.uid();
  v_role       TEXT;
  v_staff_univ UUID;
  v_name       TEXT;
BEGIN
  SELECT role INTO v_role FROM public.users WHERE id = v_uid;
  IF v_role IS DISTINCT FROM 'staff' THEN
    RAISE EXCEPTION '学生情報を編集できるのは大学職員のみです';
  END IF;

  SELECT university_id INTO v_staff_univ
  FROM public.staff_profiles WHERE user_id = v_uid;

  IF NOT EXISTS (
    SELECT 1 FROM public.student_profiles
    WHERE user_id = p_user_id AND university_id = v_staff_univ
  ) THEN
    RAISE EXCEPTION '所属大学の学生のみ編集できます';
  END IF;

  v_name := nullif(btrim(coalesce(p_name, '')), '');
  IF v_name IS NULL THEN
    RAISE EXCEPTION '氏名を入力してください';
  END IF;
  IF length(v_name) > 50 THEN
    RAISE EXCEPTION '氏名は50文字以内で入力してください';
  END IF;
  IF p_enrollment_year IS NOT NULL
     AND (p_enrollment_year < 1900 OR p_enrollment_year > 2100) THEN
    RAISE EXCEPTION '入学年度の指定が不正です';
  END IF;

  UPDATE public.users SET name = v_name WHERE id = p_user_id;
  UPDATE public.student_profiles
  SET enrollment_year = p_enrollment_year
  WHERE user_id = p_user_id;
END;
$$;


-- -----------------------------------------------------------------------------
-- 本人によるプロフィール更新から、氏名と入学年度を外す
-- -----------------------------------------------------------------------------
-- 学生が編集できるのは自己紹介とスキルのみ。
-- 職員と一般ユーザーは公式情報を持たないので、引き続き氏名を変更できる。
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_my_profile(
  p_name            TEXT,
  p_bio             TEXT    DEFAULT NULL,
  p_skills          TEXT[]  DEFAULT NULL,
  p_enrollment_year INT     DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid    UUID := auth.uid();
  v_role   TEXT;
  v_name   TEXT;
  v_skills TEXT[];
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'ログインが必要です';
  END IF;

  SELECT role INTO v_role FROM public.users WHERE id = v_uid;
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'ユーザーが見つかりません';
  END IF;

  IF v_role = 'student' THEN
    -- 氏名・入学年度は大学が管理する公式情報。引数で渡されても無視する。
    SELECT array_agg(DISTINCT s) INTO v_skills
    FROM unnest(coalesce(p_skills, ARRAY[]::TEXT[])) AS t(raw)
    CROSS JOIN LATERAL (SELECT nullif(btrim(raw), '') AS s) x
    WHERE x.s IS NOT NULL;

    UPDATE public.student_profiles
    SET bio    = nullif(btrim(coalesce(p_bio, '')), ''),
        skills = v_skills
    WHERE user_id = v_uid;
  ELSE
    v_name := nullif(btrim(coalesce(p_name, '')), '');
    IF v_name IS NULL THEN
      RAISE EXCEPTION '氏名を入力してください';
    END IF;
    IF length(v_name) > 50 THEN
      RAISE EXCEPTION '氏名は50文字以内で入力してください';
    END IF;

    UPDATE public.users SET name = v_name WHERE id = v_uid;
  END IF;
END;
$$;


-- -----------------------------------------------------------------------------
-- 職員が自大学の学生を一覧するためのビュー用関数
-- -----------------------------------------------------------------------------
-- メールアドレスは auth.users にあり API から読めないため、
-- 職員が本人を特定できるよう、この関数だけが返す。
-- -----------------------------------------------------------------------------

-- CREATE OR REPLACE は RETURNS TABLE の列名を変更できないため、先に落とす。
DROP FUNCTION IF EXISTS public.list_university_students();

-- 【注意】RETURNS TABLE の列名は関数内で変数として扱われる。
-- 本体のクエリに同名の列があると「変数か列か」が曖昧になりエラーになるため、
-- 戻り値の列には student_ 接頭辞を付けて衝突を避けている。
CREATE OR REPLACE FUNCTION public.list_university_students()
RETURNS TABLE (
  student_id         UUID,
  student_name       TEXT,
  student_email      TEXT,
  student_enrollment INT,
  student_created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid        UUID := auth.uid();
  v_role       TEXT;
  v_staff_univ UUID;
BEGIN
  SELECT u.role INTO v_role FROM public.users u WHERE u.id = v_uid;
  IF v_role IS DISTINCT FROM 'staff' THEN
    RAISE EXCEPTION '学生一覧を閲覧できるのは大学職員のみです';
  END IF;

  SELECT sp.university_id INTO v_staff_univ
  FROM public.staff_profiles sp WHERE sp.user_id = v_uid;

  RETURN QUERY
  SELECT u.id, u.name, au.email::TEXT, sp.enrollment_year, u.created_at
  FROM public.users u
  JOIN public.student_profiles sp ON sp.user_id = u.id
  LEFT JOIN auth.users au ON au.id = u.id
  WHERE sp.university_id = v_staff_univ
  ORDER BY u.name;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.list_university_students() FROM public, anon;
