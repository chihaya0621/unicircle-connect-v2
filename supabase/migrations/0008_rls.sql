-- =============================================================================
-- RLS ポリシーの実装
-- =============================================================================
-- これまで全テーブルのポリシーは `true`（全許可）で、anon キーがあれば
-- 誰でも全データを読み書きできる状態だった。本番前に必須の対応。
--
-- 【設計方針】
--   書き込み … RPC を唯一の経路とする。全 RPC を SECURITY DEFINER に変え、
--              テーブルには INSERT / UPDATE / DELETE ポリシーを一切作らない。
--              直接テーブルを叩く書き込みはすべて拒否される。
--              各 RPC は既に自前で権限判定を行っている（検証済み）。
--
--   読み取り … SELECT ポリシーで可視範囲を表現する。アプリ側のクエリと
--              同じ規則を DB にも持たせ、REST を直接叩かれても漏れないようにする。
--
-- 【なぜ RPC を SECURITY DEFINER にするか】
--   SECURITY INVOKER のままだと、RPC 内部の INSERT も呼び出し元の RLS に
--   従う。書き込みを許すポリシーを別途書くことになり、権限判定が
--   「RPC 内の IF 文」と「RLS ポリシー」の二重管理になる。
--   RPC を唯一の窓口にすれば判定は1か所で済む。
--
-- 【再帰への注意】
--   ポリシーの中から同じテーブルを SELECT する関数を呼ぶと無限再帰になる。
--   判定用ヘルパーはすべて SECURITY DEFINER にして RLS を迂回させている。
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 判定用ヘルパー
-- -----------------------------------------------------------------------------
-- すべて SECURITY DEFINER。ポリシーから呼ばれるため、内部の SELECT が
-- 再び RLS に捕まらないようにする必要がある。
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.app_role()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$ SELECT role FROM public.users WHERE id = auth.uid() $$;

CREATE OR REPLACE FUNCTION public.app_university_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    (SELECT university_id FROM public.student_profiles WHERE user_id = auth.uid()),
    (SELECT university_id FROM public.staff_profiles   WHERE user_id = auth.uid())
  )
$$;

CREATE OR REPLACE FUNCTION public.app_is_circle_member(p_circle_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.circle_members
    WHERE circle_id = p_circle_id AND user_id = auth.uid() AND status = 'active'
  )
$$;

CREATE OR REPLACE FUNCTION public.app_is_circle_admin(p_circle_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.circle_members
    WHERE circle_id = p_circle_id AND user_id = auth.uid()
      AND role = 'admin' AND status = 'active'
  )
$$;

/** 閲覧者が、指定大学の職員か */
CREATE OR REPLACE FUNCTION public.app_is_staff_of(p_university_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p_university_id IS NOT NULL
     AND public.app_role() = 'staff'
     AND public.app_university_id() = p_university_id
$$;

/** 閲覧者と対象ユーザーが、同じサークルに所属しているか */
CREATE OR REPLACE FUNCTION public.app_shares_circle_with(p_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.circle_members a
    JOIN public.circle_members b ON b.circle_id = a.circle_id
    WHERE a.user_id = auth.uid() AND a.status = 'active'
      AND b.user_id = p_user_id  AND b.status = 'active'
  )
$$;

/** 閲覧者が、そのイベントの主催者側か（大学職員 or サークル管理者） */
CREATE OR REPLACE FUNCTION public.app_can_manage_event(p_event_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = p_event_id
      AND (
        public.app_is_staff_of(e.host_university_id)
        OR (e.host_circle_id IS NOT NULL
            AND public.app_is_circle_admin(e.host_circle_id))
      )
  )
$$;

-- 可視判定は events を参照するため、events のポリシーから呼ぶと再帰する。
-- SECURITY DEFINER に変えて RLS を迂回させる。
CREATE OR REPLACE FUNCTION public.event_visible_to_university(
  p_event_id      UUID,
  p_university_id UUID
)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT CASE e.visibility
    WHEN 'public' THEN TRUE
    WHEN 'internal' THEN
      coalesce(e.host_university_id, c.university_id) = p_university_id
    WHEN 'scoped' THEN
      coalesce(e.host_university_id, c.university_id) = p_university_id
      OR EXISTS (
        SELECT 1 FROM event_universities eu
        WHERE eu.event_id = e.id AND eu.university_id = p_university_id
      )
    ELSE FALSE
  END
  FROM events e
  LEFT JOIN circles c ON c.id = e.host_circle_id
  WHERE e.id = p_event_id;
$$;

-- circle_allows_university も同様（circles を参照する）
CREATE OR REPLACE FUNCTION public.circle_allows_university(
  p_circle_id     UUID,
  p_university_id UUID
)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT CASE c.scope
    WHEN 'public'     THEN TRUE
    WHEN 'university' THEN c.university_id = p_university_id
    WHEN 'scoped'     THEN EXISTS (
      SELECT 1 FROM circle_universities cu
      WHERE cu.circle_id = c.id AND cu.university_id = p_university_id
    ) OR c.university_id = p_university_id
    ELSE FALSE
  END
  FROM circles c
  WHERE c.id = p_circle_id;
$$;


-- -----------------------------------------------------------------------------
-- 既存の全許可ポリシーを撤去
-- -----------------------------------------------------------------------------

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'universities','users','student_profiles','staff_profiles',
    'circles','circle_members','circle_universities',
    'events','event_universities','event_participants',
    'facilities','facility_reservations'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'dev_allow_all_' || t, t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;


-- -----------------------------------------------------------------------------
-- SELECT ポリシー
-- -----------------------------------------------------------------------------
-- INSERT / UPDATE / DELETE のポリシーは意図的に作らない。
-- 直接の書き込みはすべて拒否され、RPC 経由のみになる。
-- -----------------------------------------------------------------------------

-- 大学: 誰でも読める。未ログインでもサインアップ画面の選択肢に必要。
CREATE POLICY universities_select ON universities
  FOR SELECT USING (true);

-- ユーザー: ログイン済みなら読める。メンバー一覧などで氏名を表示するため。
-- 保持しているのは id / role / name / created_at のみで、機微な情報は無い。
CREATE POLICY users_select ON users
  FOR SELECT TO authenticated USING (true);

-- 学生プロフィール: 自己紹介やスキルを含むので範囲を絞る。
-- 本人、同じサークルの仲間、所属大学の職員のみ。
CREATE POLICY student_profiles_select ON student_profiles
  FOR SELECT TO authenticated USING (
    user_id = auth.uid()
    OR public.app_shares_circle_with(user_id)
    OR public.app_is_staff_of(university_id)
  );

CREATE POLICY staff_profiles_select ON staff_profiles
  FOR SELECT TO authenticated USING (
    user_id = auth.uid()
    OR public.app_is_staff_of(university_id)
  );

-- サークル: 承認済みは誰でも読める（未ログインのイベント一覧で主催者名を
-- 表示するのに必要）。承認待ち・却下は関係者のみ。
CREATE POLICY circles_select ON circles
  FOR SELECT USING (
    status = 'approved'
    OR public.app_is_circle_member(id)
    OR public.app_is_staff_of(university_id)
  );

-- サークルの対象大学: サークル自体が読めるかに従う
CREATE POLICY circle_universities_select ON circle_universities
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM circles c WHERE c.id = circle_id)
  );

-- サークルメンバー: 本人、同じサークルの仲間、その大学の職員のみ。
-- 誰がどこに所属しているかは個人情報として扱う。
CREATE POLICY circle_members_select ON circle_members
  FOR SELECT TO authenticated USING (
    user_id = auth.uid()
    OR public.app_is_circle_member(circle_id)
    OR EXISTS (
      SELECT 1 FROM circles c
      WHERE c.id = circle_id AND public.app_is_staff_of(c.university_id)
    )
  );

-- イベント: 可視範囲の判定をそのままポリシーにする。
-- 未ログインは public のみ。
CREATE POLICY events_select ON events
  FOR SELECT USING (
    visibility = 'public'
    OR public.event_visible_to_university(id, public.app_university_id())
  );

CREATE POLICY event_universities_select ON event_universities
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM events e WHERE e.id = event_id)
  );

-- 参加登録: 本人の登録と、主催者から見た参加者一覧のみ。
-- 誰がどのイベントに参加したかは行動履歴なので、他人からは見えない。
CREATE POLICY event_participants_select ON event_participants
  FOR SELECT TO authenticated USING (
    user_id = auth.uid()
    OR public.app_can_manage_event(event_id)
  );

-- 施設: 自大学のもののみ。他大学の設備構成は見せない。
CREATE POLICY facilities_select ON facilities
  FOR SELECT TO authenticated USING (
    university_id = public.app_university_id()
  );

-- 施設予約: 本人の予約、サークル予約はそのメンバー、施設の大学の職員。
CREATE POLICY facility_reservations_select ON facility_reservations
  FOR SELECT TO authenticated USING (
    booked_by_user_id = auth.uid()
    OR (group_circle_id IS NOT NULL
        AND public.app_is_circle_member(group_circle_id))
    OR EXISTS (
      SELECT 1 FROM facilities f
      WHERE f.id = facility_id AND public.app_is_staff_of(f.university_id)
    )
  );


-- -----------------------------------------------------------------------------
-- 全 RPC を SECURITY DEFINER に切り替える
-- -----------------------------------------------------------------------------
-- 関数本体は変えず、権限モードだけを変更する。
-- 各関数は冒頭で auth.uid() とロールを検証しているため、
-- 定義者権限で動いても認可は維持される。
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  f TEXT;
  fns TEXT[] := ARRAY[
    'create_circle(text,text,text,uuid[])',
    'request_join_circle(uuid)',
    'decide_circle_member(uuid,uuid,boolean)',
    'decide_circle(uuid,boolean)',
    'create_reservation(uuid,timestamptz,timestamptz,text,uuid)',
    'decide_reservation(uuid,boolean)',
    'cancel_reservation(uuid)',
    'create_facility(text,text)',
    'set_facility_availability(uuid,boolean)',
    'update_facility(uuid,text,text)',
    'delete_facility(uuid)',
    'create_event(text,timestamptz,text,text,uuid,text[],uuid[])',
    'delete_event(uuid)',
    'join_event(uuid)',
    'leave_event(uuid)'
  ];
BEGIN
  FOREACH f IN ARRAY fns LOOP
    EXECUTE format('ALTER FUNCTION public.%s SECURITY DEFINER', f);
  END LOOP;
END $$;
