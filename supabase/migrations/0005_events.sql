-- =============================================================================
-- イベントの作成・削除
-- =============================================================================
-- 排他的関連 (Exclusive Arc):
--   events_host_check により host_university_id と host_circle_id は
--   ちょうど片方だけが NOT NULL。呼び出し側に両方渡させると制約違反を
--   踏みやすいので、この関数では「サークルIDが指定されたか否か」だけを
--   受け取り、振り分けは関数内で行う。
--
-- 作成権限:
--   大学主催   … 職員のみ。主催大学は staff_profiles から導出する
--   サークル主催 … そのサークルの管理者 (admin/active) のみ、かつ承認済み
-- =============================================================================


CREATE OR REPLACE FUNCTION public.create_event(
  p_title          TEXT,
  p_event_date     TIMESTAMPTZ,
  p_description    TEXT   DEFAULT NULL,
  p_visibility     TEXT   DEFAULT 'internal',
  p_circle_id      UUID   DEFAULT NULL,
  p_target_grades  TEXT[] DEFAULT NULL,
  p_university_ids UUID[] DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid        UUID := auth.uid();
  v_role       TEXT;
  v_title      TEXT;
  v_visibility TEXT;
  v_univ       UUID;
  v_event_id   UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'ログインが必要です';
  END IF;

  v_title := nullif(btrim(coalesce(p_title, '')), '');
  IF v_title IS NULL THEN
    RAISE EXCEPTION 'イベント名を入力してください';
  END IF;

  IF p_event_date IS NULL THEN
    RAISE EXCEPTION '開催日時を入力してください';
  END IF;
  IF p_event_date < now() THEN
    RAISE EXCEPTION '過去の日時にはイベントを作成できません';
  END IF;

  v_visibility := coalesce(p_visibility, 'internal');
  IF v_visibility NOT IN ('internal', 'scoped', 'public') THEN
    RAISE EXCEPTION '公開範囲の指定が不正です';
  END IF;
  IF v_visibility = 'scoped'
     AND (p_university_ids IS NULL OR array_length(p_university_ids, 1) IS NULL) THEN
    RAISE EXCEPTION '範囲を指定する場合は対象大学を1つ以上選んでください';
  END IF;

  SELECT role INTO v_role FROM public.users WHERE id = v_uid;

  IF p_circle_id IS NOT NULL THEN
    ----------------------------------------------------------------- サークル主催
    IF NOT EXISTS (
      SELECT 1 FROM public.circle_members cm
      JOIN public.circles c ON c.id = cm.circle_id
      WHERE cm.circle_id = p_circle_id
        AND cm.user_id = v_uid
        AND cm.role = 'admin'
        AND cm.status = 'active'
        AND c.status = 'approved'
    ) THEN
      RAISE EXCEPTION '承認済みサークルの管理者のみイベントを作成できます';
    END IF;

    INSERT INTO public.events
      (host_university_id, host_circle_id, title, description,
       event_date, visibility, target_grades)
    VALUES
      (NULL, p_circle_id, v_title,
       nullif(btrim(coalesce(p_description, '')), ''),
       p_event_date, v_visibility, p_target_grades)
    RETURNING id INTO v_event_id;
  ELSE
    ----------------------------------------------------------------- 大学主催
    IF v_role IS DISTINCT FROM 'staff' THEN
      RAISE EXCEPTION '大学公式イベントを作成できるのは職員のみです';
    END IF;

    SELECT university_id INTO v_univ
    FROM public.staff_profiles WHERE user_id = v_uid;

    IF v_univ IS NULL THEN
      RAISE EXCEPTION '所属大学が未設定です';
    END IF;

    INSERT INTO public.events
      (host_university_id, host_circle_id, title, description,
       event_date, visibility, target_grades)
    VALUES
      (v_univ, NULL, v_title,
       nullif(btrim(coalesce(p_description, '')), ''),
       p_event_date, v_visibility, p_target_grades)
    RETURNING id INTO v_event_id;
  END IF;

  IF v_visibility = 'scoped' THEN
    INSERT INTO public.event_universities (event_id, university_id)
    SELECT v_event_id, u
    FROM unnest(p_university_ids) AS u
    WHERE EXISTS (SELECT 1 FROM public.universities WHERE id = u)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN v_event_id;
END;
$$;


-- -----------------------------------------------------------------------------
-- イベントの削除
-- -----------------------------------------------------------------------------
-- 主催者本人のみ。大学主催なら同じ大学の職員、サークル主催ならそのサークルの
-- 管理者が削除できる。event_universities は ON DELETE CASCADE で消える。
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.delete_event(p_event_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid         UUID := auth.uid();
  v_host_univ   UUID;
  v_host_circle UUID;
  v_staff_univ  UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'ログインが必要です';
  END IF;

  SELECT host_university_id, host_circle_id
    INTO v_host_univ, v_host_circle
  FROM public.events WHERE id = p_event_id;

  IF v_host_univ IS NULL AND v_host_circle IS NULL THEN
    RAISE EXCEPTION 'イベントが見つかりません';
  END IF;

  IF v_host_circle IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.circle_members
      WHERE circle_id = v_host_circle AND user_id = v_uid
        AND role = 'admin' AND status = 'active'
    ) THEN
      RAISE EXCEPTION 'このイベントを削除する権限がありません';
    END IF;
  ELSE
    SELECT sp.university_id INTO v_staff_univ
    FROM public.staff_profiles sp
    JOIN public.users u ON u.id = sp.user_id
    WHERE sp.user_id = v_uid AND u.role = 'staff';

    IF v_staff_univ IS DISTINCT FROM v_host_univ THEN
      RAISE EXCEPTION 'このイベントを削除する権限がありません';
    END IF;
  END IF;

  DELETE FROM public.events WHERE id = p_event_id;
END;
$$;
