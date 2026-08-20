-- =============================================================================
-- プロフィール更新
-- =============================================================================
-- 0008 で直接の UPDATE を全面的に塞いだため、本人がプロフィールを
-- 編集する経路として RPC を用意する。
--
-- 要件定義書のスキーマにありながら未使用だった student_profiles の
-- bio / skills を、ここで初めて活用する。
--
-- 更新できるのは常に自分自身の行のみ。対象ユーザーを引数で受け取らず
-- auth.uid() を使うので、他人のプロフィールを書き換える余地がない。
-- =============================================================================

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

  v_name := nullif(btrim(coalesce(p_name, '')), '');
  IF v_name IS NULL THEN
    RAISE EXCEPTION '氏名を入力してください';
  END IF;
  IF length(v_name) > 50 THEN
    RAISE EXCEPTION '氏名は50文字以内で入力してください';
  END IF;

  SELECT role INTO v_role FROM public.users WHERE id = v_uid;
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'ユーザーが見つかりません';
  END IF;

  UPDATE public.users SET name = v_name WHERE id = v_uid;

  -- 学生のみサブプロフィールを持つ。職員・一般は氏名のみ更新する。
  IF v_role = 'student' THEN
    IF p_enrollment_year IS NOT NULL
       AND (p_enrollment_year < 1900 OR p_enrollment_year > 2100) THEN
      RAISE EXCEPTION '入学年度の指定が不正です';
    END IF;

    -- 空文字を除き、前後の空白を落とし、重複を取り除く
    SELECT array_agg(DISTINCT s) INTO v_skills
    FROM unnest(coalesce(p_skills, ARRAY[]::TEXT[])) AS t(raw)
    CROSS JOIN LATERAL (SELECT nullif(btrim(raw), '') AS s) x
    WHERE x.s IS NOT NULL;

    UPDATE public.student_profiles
    SET bio             = nullif(btrim(coalesce(p_bio, '')), ''),
        skills          = v_skills,
        enrollment_year = p_enrollment_year
    WHERE user_id = v_uid;
  END IF;
END;
$$;
