-- =============================================================================
-- 退会・除名と、サークル／イベントの編集
-- =============================================================================
-- 入る導線はあるのに出る導線が無く、作った後に直す手段も無かった。
-- 打ち間違えたら作り直すしかなく、作り直すとメンバーも掲示板も消える。
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. サークルを抜ける
-- -----------------------------------------------------------------------------

/**
 * 自分でサークルを抜ける。
 *
 * 管理者が自分ひとりのときは抜けられない。抜けられると、
 * 誰も承認・編集・掲示ができないサークルが残る。
 * 先に他のメンバーを管理者にしてもらう。
 */
CREATE OR REPLACE FUNCTION public.leave_circle(p_circle_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role   TEXT;
  v_admins INT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'ログインが必要です';
  END IF;

  SELECT role INTO v_role
    FROM public.circle_members
   WHERE circle_id = p_circle_id AND user_id = auth.uid();

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'このサークルに所属していません';
  END IF;

  IF v_role = 'admin' THEN
    SELECT count(*) INTO v_admins
      FROM public.circle_members
     WHERE circle_id = p_circle_id AND role = 'admin' AND status = 'active';

    IF v_admins <= 1 THEN
      RAISE EXCEPTION
        '管理者が自分だけのため退会できません。先に他のメンバーを管理者にしてください';
    END IF;
  END IF;

  DELETE FROM public.circle_members
   WHERE circle_id = p_circle_id AND user_id = auth.uid();
END;
$$;


/**
 * メンバーを外す。サークル管理者のみ。
 *
 * 自分自身は外せない（leave_circle を使う）。最後の管理者も外せない。
 */
CREATE OR REPLACE FUNCTION public.remove_circle_member(
  p_circle_id UUID,
  p_user_id   UUID
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role   TEXT;
  v_admins INT;
BEGIN
  IF NOT public.app_is_circle_admin(p_circle_id) THEN
    RAISE EXCEPTION 'このサークルの管理者のみ操作できます';
  END IF;

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION '自分を外すことはできません。退会を使ってください';
  END IF;

  SELECT role INTO v_role
    FROM public.circle_members
   WHERE circle_id = p_circle_id AND user_id = p_user_id;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'そのメンバーは見つかりません';
  END IF;

  IF v_role = 'admin' THEN
    SELECT count(*) INTO v_admins
      FROM public.circle_members
     WHERE circle_id = p_circle_id AND role = 'admin' AND status = 'active';

    IF v_admins <= 1 THEN
      RAISE EXCEPTION '最後の管理者は外せません';
    END IF;
  END IF;

  DELETE FROM public.circle_members
   WHERE circle_id = p_circle_id AND user_id = p_user_id;
END;
$$;


/**
 * メンバーを管理者にする／外す。サークル管理者のみ。
 *
 * 退会の前提として必要になる。管理者がひとりしか居ないサークルで、
 * その人が抜けたいときに引き継ぐ手段が無いと詰む。
 */
CREATE OR REPLACE FUNCTION public.set_circle_member_role(
  p_circle_id UUID,
  p_user_id   UUID,
  p_admin     BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admins INT;
BEGIN
  IF NOT public.app_is_circle_admin(p_circle_id) THEN
    RAISE EXCEPTION 'このサークルの管理者のみ操作できます';
  END IF;

  IF NOT p_admin THEN
    SELECT count(*) INTO v_admins
      FROM public.circle_members
     WHERE circle_id = p_circle_id AND role = 'admin' AND status = 'active';

    IF v_admins <= 1 THEN
      RAISE EXCEPTION '管理者が居なくなるため外せません';
    END IF;
  END IF;

  UPDATE public.circle_members
     SET role = CASE WHEN p_admin THEN 'admin' ELSE 'member' END
   WHERE circle_id = p_circle_id
     AND user_id = p_user_id
     AND status = 'active';
END;
$$;


-- -----------------------------------------------------------------------------
-- 2. サークル情報の編集
-- -----------------------------------------------------------------------------

/**
 * 名前・説明・参加できる範囲を直す。サークル管理者のみ。
 *
 * 所属大学と承認状態はここでは変えない。前者を変えると
 * 施設や職員の担当が丸ごとずれ、後者は職員の承認を迂回できてしまう。
 */
CREATE OR REPLACE FUNCTION public.update_circle(
  p_circle_id      UUID,
  p_name           TEXT,
  p_description    TEXT DEFAULT NULL,
  p_scope          TEXT DEFAULT NULL,
  p_university_ids UUID[] DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_name  TEXT := nullif(btrim(coalesce(p_name, '')), '');
  v_scope TEXT;
BEGIN
  IF NOT public.app_is_circle_admin(p_circle_id) THEN
    RAISE EXCEPTION 'このサークルの管理者のみ編集できます';
  END IF;

  IF v_name IS NULL THEN
    RAISE EXCEPTION 'サークル名を入力してください';
  END IF;
  IF char_length(v_name) > 60 THEN
    RAISE EXCEPTION 'サークル名は60文字までです';
  END IF;
  IF char_length(coalesce(p_description, '')) > 1000 THEN
    RAISE EXCEPTION '説明は1000文字までです';
  END IF;

  SELECT coalesce(p_scope, scope) INTO v_scope
    FROM public.circles WHERE id = p_circle_id;

  IF v_scope NOT IN ('university', 'scoped', 'public') THEN
    RAISE EXCEPTION '参加できる範囲の指定が不正です';
  END IF;
  IF v_scope = 'scoped'
     AND (p_university_ids IS NULL OR array_length(p_university_ids, 1) IS NULL) THEN
    RAISE EXCEPTION '範囲を指定する場合は対象大学を1つ以上選んでください';
  END IF;

  UPDATE public.circles
     SET name        = v_name,
         description = nullif(btrim(coalesce(p_description, '')), ''),
         scope       = v_scope
   WHERE id = p_circle_id;

  -- 対象大学は総入れ替え。差分にすると、範囲を狭めたときに
  -- 古い指定が残って「外したはずの大学から参加できる」状態になる。
  DELETE FROM public.circle_universities WHERE circle_id = p_circle_id;

  IF v_scope = 'scoped' THEN
    INSERT INTO public.circle_universities (circle_id, university_id)
    SELECT p_circle_id, u
      FROM unnest(p_university_ids) AS u
     WHERE EXISTS (SELECT 1 FROM public.universities WHERE id = u)
    ON CONFLICT DO NOTHING;
  END IF;
END;
$$;


-- -----------------------------------------------------------------------------
-- 3. イベントの編集
-- -----------------------------------------------------------------------------

/**
 * イベントを直す。主催者のみ（app_can_manage_event と同じ判定）。
 *
 * 主催（大学かサークルか）は変えない。変えられると、
 * 誰が管理してよいかの判定そのものが動いてしまう。
 *
 * 日時を動かしたらリマインドの送信済みを解除する。
 * 「3時間前」に送った後で開催が1週間ずれたら、その通知は
 * もう役に立たないので、新しい日時で送り直す。
 */
CREATE OR REPLACE FUNCTION public.update_event(
  p_event_id       UUID,
  p_title          TEXT,
  p_event_date     TIMESTAMPTZ,
  p_description    TEXT DEFAULT NULL,
  p_visibility     TEXT DEFAULT NULL,
  p_target_grades  TEXT[] DEFAULT NULL,
  p_university_ids UUID[] DEFAULT NULL,
  p_public_listed  BOOLEAN DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_title      TEXT := nullif(btrim(coalesce(p_title, '')), '');
  v_visibility TEXT;
  v_listed     BOOLEAN;
  v_old_date   TIMESTAMPTZ;
BEGIN
  IF NOT public.app_can_manage_event(p_event_id) THEN
    RAISE EXCEPTION 'このイベントの主催者のみ編集できます';
  END IF;

  IF v_title IS NULL THEN
    RAISE EXCEPTION 'イベント名を入力してください';
  END IF;
  IF p_event_date IS NULL THEN
    RAISE EXCEPTION '開催日時を入力してください';
  END IF;

  SELECT event_date,
         coalesce(p_visibility, visibility),
         coalesce(p_public_listed, public_listed)
    INTO v_old_date, v_visibility, v_listed
    FROM public.events WHERE id = p_event_id;

  IF v_old_date IS NULL THEN
    RAISE EXCEPTION 'イベントが見つかりません';
  END IF;

  IF v_visibility NOT IN ('internal', 'scoped', 'public') THEN
    RAISE EXCEPTION '公開範囲の指定が不正です';
  END IF;
  IF v_visibility = 'scoped'
     AND (p_university_ids IS NULL OR array_length(p_university_ids, 1) IS NULL) THEN
    RAISE EXCEPTION '範囲を指定する場合は対象大学を1つ以上選んでください';
  END IF;

  -- 学内限定のものを学外に案内することはできない（0025 と同じ規則）
  v_listed := v_listed AND v_visibility = 'public';

  UPDATE public.events
     SET title         = v_title,
         description   = nullif(btrim(coalesce(p_description, '')), ''),
         event_date    = p_event_date,
         visibility    = v_visibility,
         target_grades = p_target_grades,
         public_listed = v_listed
   WHERE id = p_event_id;

  DELETE FROM public.event_universities WHERE event_id = p_event_id;

  IF v_visibility = 'scoped' THEN
    INSERT INTO public.event_universities (event_id, university_id)
    SELECT p_event_id, u
      FROM unnest(p_university_ids) AS u
     WHERE EXISTS (SELECT 1 FROM public.universities WHERE id = u)
    ON CONFLICT DO NOTHING;
  END IF;

  IF p_event_date IS DISTINCT FROM v_old_date THEN
    UPDATE public.event_reminders
       SET notified_at = NULL
     WHERE event_id = p_event_id;
  END IF;
END;
$$;


-- -----------------------------------------------------------------------------
-- 4. 権限
-- -----------------------------------------------------------------------------

DO $$
DECLARE f TEXT;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'leave_circle(uuid)',
    'remove_circle_member(uuid,uuid)',
    'set_circle_member_role(uuid,uuid,boolean)',
    'update_circle(uuid,text,text,text,uuid[])',
    'update_event(uuid,text,timestamptz,text,text,text[],uuid[],boolean)'
  ] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM public, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END;
$$;
