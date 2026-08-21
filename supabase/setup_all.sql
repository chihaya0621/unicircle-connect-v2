-- =============================================================================
-- UniCircle Connect セットアップ一括実行ファイル（自動生成）
-- =============================================================================
--
-- このファイルは以下を連結した生成物です。直接編集しないでください。
--   1. migrations/0000_initial_schema.sql
--   2. migrations/0001_handle_new_user.sql
--   3. migrations/0002_circles.sql
--   4. migrations/0003_scopes.sql
--   5. migrations/0004_facilities.sql
--   6. migrations/0005_events.sql
--   7. migrations/0006_facility_management.sql
--   8. migrations/0007_event_participants.sql
--   9. migrations/0008_rls.sql
--  10. migrations/0009_profile.sql
--  11. migrations/0010_student_registration.sql
--  12. migrations/0011_circle_posts.sql
--  13. migrations/0012_activities.sql
--  14. migrations/0013_event_attendance.sql
--  15. migrations/0014_notifications.sql
--  16. migrations/0015_images.sql
--  17. migrations/0016_theme.sql
--  18. migrations/0017_theme_variants.sql
--  19. migrations/0018_circle_event_stats.sql
--  20. migrations/0019_public_discovery.sql
--  21. migrations/0020_event_participation_roles.sql
--  22. migrations/0021_circle_public_profile.sql
--  23. migrations/0022_event_reminders.sql
--  24. migrations/0023_university_details.sql
--  25. migrations/0024_campus_location.sql
--  26. seed.sql
--
-- 再生成: npm run db:bundle
--
-- 前提: public スキーマが空であること。
--       既存データがある場合は先に reset_full.sql を実行してください。
--
-- 成功すると最後に universities=3 / circles=4 / events=5 / facilities=5
-- が表示されます。
-- =============================================================================


-- ▼▼▼ migrations/0000_initial_schema.sql ▼▼▼

-- =============================================================================
-- UniCircle Connect 基本スキーマ
-- =============================================================================
-- 実行順:
--   1. (作り直す場合のみ) supabase/reset_full.sql
--   2. このファイル
--   3. supabase/migrations/0001_handle_new_user.sql
--   4. (任意) supabase/seed.sql
-- =============================================================================


-- 1. 組織: 大学
CREATE TABLE universities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 人: ユーザー基本情報
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('student', 'staff', 'general')),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 人: 学生プロフィール（サブタイプ）
CREATE TABLE student_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  university_id UUID REFERENCES universities(id) ON DELETE SET NULL,
  enrollment_year INT,
  bio TEXT,
  skills TEXT[]
);

-- 2. 人: 職員プロフィール（サブタイプ）
CREATE TABLE staff_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  university_id UUID REFERENCES universities(id) ON DELETE SET NULL
);

-- 3. 組織: サークル
CREATE TABLE circles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID REFERENCES universities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 組織: サークルメンバー
CREATE TABLE circle_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id UUID REFERENCES circles(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(circle_id, user_id)
);

-- 4. 活動: イベント
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_university_id UUID REFERENCES universities(id) ON DELETE CASCADE,
  host_circle_id UUID REFERENCES circles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  event_date TIMESTAMPTZ NOT NULL,
  visibility TEXT DEFAULT 'internal' CHECK (visibility IN ('internal', 'public')),
  target_grades TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- 排他的関連 (Exclusive Arc): 主催者はどちらか一方のみ
  CONSTRAINT events_host_check CHECK (
    (host_university_id IS NOT NULL AND host_circle_id IS NULL) OR
    (host_university_id IS NULL AND host_circle_id IS NOT NULL)
  )
);

-- 4. 活動: 施設マスタ
CREATE TABLE facilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID REFERENCES universities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT CHECK (category IN ('facility', 'equipment')),
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 活動: 施設予約
CREATE TABLE facility_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID REFERENCES facilities(id) ON DELETE CASCADE,
  booked_by_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  group_circle_id UUID REFERENCES circles(id) ON DELETE CASCADE,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  purpose TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- 【要件定義書からの追加】
  -- 本文には「予約主体は CHECK 制約により保証している」とあったが、
  -- 添付SQLに該当の制約が無かったため、ここで補っている。
  CONSTRAINT reservations_booker_check CHECK (
    (booked_by_user_id IS NOT NULL AND group_circle_id IS NULL) OR
    (booked_by_user_id IS NULL AND group_circle_id IS NOT NULL)
  ),
  -- 終了時刻は開始時刻より後
  CONSTRAINT reservations_time_check CHECK (end_time > start_time)
);


-- -----------------------------------------------------------------------------
-- インデックス
-- -----------------------------------------------------------------------------
-- PostgreSQL は外部キーに自動でインデックスを張らないため、
-- 結合と絞り込みで使う列に明示的に作成する。
-- -----------------------------------------------------------------------------

CREATE INDEX idx_student_profiles_university ON student_profiles(university_id);
CREATE INDEX idx_staff_profiles_university   ON staff_profiles(university_id);
CREATE INDEX idx_circles_university          ON circles(university_id);
CREATE INDEX idx_circle_members_circle       ON circle_members(circle_id);
CREATE INDEX idx_circle_members_user         ON circle_members(user_id);
CREATE INDEX idx_events_host_university      ON events(host_university_id);
CREATE INDEX idx_events_host_circle          ON events(host_circle_id);
CREATE INDEX idx_facilities_university       ON facilities(university_id);
CREATE INDEX idx_reservations_facility       ON facility_reservations(facility_id);
CREATE INDEX idx_reservations_user           ON facility_reservations(booked_by_user_id);
CREATE INDEX idx_reservations_circle         ON facility_reservations(group_circle_id);

-- イベント一覧は「今日以降を日付順」で引くのでこの複合インデックスが効く
CREATE INDEX idx_events_date_visibility ON events(event_date, visibility);


-- -----------------------------------------------------------------------------
-- RLS（開発環境用）
-- -----------------------------------------------------------------------------
-- 【警告】以下は要件定義書のとおり「RLSを有効化しつつ true で全許可」する
-- 開発用の設定です。この状態では anon key を持つ人が全テーブルを
-- 自由に読み書きできます。本番公開前に必ずロール別のポリシーへ
-- 置き換えてください（README の「RLS が全許可のままです」を参照）。
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'universities', 'users', 'student_profiles', 'staff_profiles',
    'circles', 'circle_members', 'events', 'facilities', 'facility_reservations'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL USING (true) WITH CHECK (true)',
      'dev_allow_all_' || t, t
    );
  END LOOP;
END $$;

-- ▼▼▼ migrations/0001_handle_new_user.sql ▼▼▼

-- =============================================================================
-- サインアップ時に public.users と各サブプロフィールを自動生成するトリガー
-- =============================================================================
-- Supabase SQL Editor でこのファイルの内容を実行してください。
--
-- 設計意図:
--   auth.users への INSERT と public.users への INSERT を同一トランザクション
--   に閉じ込めることで、「auth 上は存在するがアプリ上のユーザー行が無い」
--   孤児アカウントが発生しないようにする。
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 【重要・セキュリティ】role の自己申告を禁止する
-- -----------------------------------------------------------------------------
-- raw_user_meta_data は signUp() の options.data がそのまま入る領域であり、
-- 完全にクライアント（＝攻撃者）の制御下にある。
-- したがって role をそのまま信用すると、誰でも curl 一発で staff 権限
-- （施設マスタ管理・サークル承認権限）を持つアカウントを作れてしまう。
--
-- 対策として、セルフサインアップで作れるのは 'student' と 'general' のみに
-- 制限する。staff は下部の promote_to_staff() で管理者が手動付与する。
-- -----------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_meta            jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_role            text;
  v_name            text;
  v_university_id   uuid;
  v_enrollment_year int;
begin
  -- role: student / general 以外は問答無用で general に落とす
  v_role := coalesce(v_meta ->> 'role', 'general');
  if v_role not in ('student', 'general') then
    v_role := 'general';
  end if;

  -- name: 未指定ならメールアドレスのローカル部で埋める（NOT NULL のため）
  v_name := nullif(btrim(coalesce(v_meta ->> 'name', '')), '');
  if v_name is null then
    v_name := split_part(coalesce(new.email, 'user'), '@', 1);
  end if;

  insert into public.users (id, role, name)
  values (new.id, v_role, v_name)
  on conflict (id) do nothing;

  -- 学生のみ student_profiles を持つ。general はサブプロフィールを持たない。
  if v_role = 'student' then
    -- 不正な UUID / 数値が来ても例外でサインアップ全体を落とさない
    begin
      v_university_id := nullif(v_meta ->> 'university_id', '')::uuid;
    exception when others then
      v_university_id := null;
    end;

    begin
      v_enrollment_year := nullif(v_meta ->> 'enrollment_year', '')::int;
    exception when others then
      v_enrollment_year := null;
    end;

    insert into public.student_profiles (user_id, university_id, enrollment_year)
    values (new.id, v_university_id, v_enrollment_year)
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();


-- -----------------------------------------------------------------------------
-- staff への昇格（管理者が SQL Editor から手動実行する想定）
-- -----------------------------------------------------------------------------
-- 使い方:
--   select public.promote_to_staff('staff@univ.ac.jp', '<university_id>');
-- -----------------------------------------------------------------------------

create or replace function public.promote_to_staff(
  p_email         text,
  p_university_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid;
begin
  select id into v_user_id from auth.users where email = p_email;

  if v_user_id is null then
    raise exception 'ユーザーが見つかりません: %', p_email;
  end if;

  update public.users set role = 'staff' where id = v_user_id;

  -- 学生から昇格した場合は student_profiles を除去して排他性を保つ
  delete from public.student_profiles where user_id = v_user_id;

  insert into public.staff_profiles (user_id, university_id)
  values (v_user_id, p_university_id)
  on conflict (user_id) do update set university_id = excluded.university_id;
end;
$$;

-- 一般ユーザーから直接叩けないよう実行権限を剥奪しておく。
-- anon / authenticated は Supabase 固有のロールなので、存在する場合のみ剥奪する
-- （ローカルの素の PostgreSQL でも流せるようにするため）。
revoke execute on function public.promote_to_staff(text, uuid) from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke execute on function public.promote_to_staff(text, uuid) from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke execute on function public.promote_to_staff(text, uuid) from authenticated;
  end if;
end $$;

-- ▼▼▼ migrations/0002_circles.sql ▼▼▼

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

-- ▼▼▼ migrations/0003_scopes.sql ▼▼▼

-- =============================================================================
-- 可視範囲・参加資格のスコープを3段階に拡張する
-- =============================================================================
-- 背景:
--   従来はサークルが単一大学に属し、イベントは internal / public の2値だった。
--   しかし「インカレサークル」や「特定大学との合同練習試合」は、この2値では
--   表現できない。全公開にすると無関係な大学が入り込み、学内限定にすると
--   相手大学が参加できないため。
--
-- 方針:
--   サークルとイベントで同じ3段階に揃える。
--     university … 主管大学のみ
--     scoped     … 指定した大学のみ（中間テーブルで列挙）
--     public     … どの大学からでも可
--
--   対象大学は配列ではなく中間テーブルで持つ。第3正規形を保ち、
--   外部キー制約で存在しない大学を弾けるようにするため。
--
--   circles.university_id は「主管大学」として残す。職員の承認スコープ
--   （自大学のサークルのみ承認可）がこれに依存しているため。
-- =============================================================================


-- -----------------------------------------------------------------------------
-- サークルのスコープ
-- -----------------------------------------------------------------------------

ALTER TABLE circles
  ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'university'
    CHECK (scope IN ('university', 'scoped', 'public'));

COMMENT ON COLUMN circles.scope IS
  'university=主管大学のみ / scoped=circle_universities に列挙した大学 / public=全大学（インカレ）';

CREATE TABLE IF NOT EXISTS circle_universities (
  circle_id     UUID NOT NULL REFERENCES circles(id)      ON DELETE CASCADE,
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  PRIMARY KEY (circle_id, university_id)
);

CREATE INDEX IF NOT EXISTS idx_circle_universities_university
  ON circle_universities(university_id);


-- -----------------------------------------------------------------------------
-- イベントのスコープ
-- -----------------------------------------------------------------------------
-- 既存の visibility は 'internal' / 'public' の2値。'scoped' を追加する。
-- 既存データを壊さないため 'internal' はそのまま活かす
-- （意味は「主管大学のみ」で変わらない）。
-- -----------------------------------------------------------------------------

ALTER TABLE events DROP CONSTRAINT IF EXISTS events_visibility_check;

ALTER TABLE events
  ADD CONSTRAINT events_visibility_check
    CHECK (visibility IN ('internal', 'scoped', 'public'));

COMMENT ON COLUMN events.visibility IS
  'internal=主管大学のみ / scoped=event_universities に列挙した大学 / public=全公開';

CREATE TABLE IF NOT EXISTS event_universities (
  event_id      UUID NOT NULL REFERENCES events(id)       ON DELETE CASCADE,
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  PRIMARY KEY (event_id, university_id)
);

CREATE INDEX IF NOT EXISTS idx_event_universities_university
  ON event_universities(university_id);


-- -----------------------------------------------------------------------------
-- RLS（開発環境用・既存テーブルと同じ全許可ポリシー）
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['circle_universities', 'event_universities'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t
        AND policyname = 'dev_allow_all_' || t
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL USING (true) WITH CHECK (true)',
        'dev_allow_all_' || t, t
      );
    END IF;
  END LOOP;
END $$;


-- -----------------------------------------------------------------------------
-- 判定用ヘルパー: ある大学がサークル / イベントの対象範囲に入っているか
-- -----------------------------------------------------------------------------
-- アプリ側のクエリと RPC の両方から使うため関数にまとめる。
-- p_university_id が NULL（所属大学未設定）の場合、public のみ真。
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.circle_allows_university(
  p_circle_id     UUID,
  p_university_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
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

COMMENT ON FUNCTION public.circle_allows_university IS
  'scoped の場合、主管大学も暗黙で対象に含める（列挙し忘れて設立者が弾かれるのを防ぐ）';


-- -----------------------------------------------------------------------------
-- 参加申請に大学スコープの判定を追加する
-- -----------------------------------------------------------------------------
-- 0002 では役割と承認状態しか見ておらず、他大学の学生が自由に参加できた。
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
  v_university_id  UUID;
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

  SELECT university_id INTO v_university_id
  FROM public.student_profiles WHERE user_id = v_uid;

  IF NOT public.circle_allows_university(p_circle_id, v_university_id) THEN
    RAISE EXCEPTION 'このサークルはあなたの所属大学からは参加できません';
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
-- 設立時にスコープを指定できるようにする
-- -----------------------------------------------------------------------------
-- 【重要】先に 0002 で作った2引数版を削除する。
-- CREATE OR REPLACE は引数リストが変わると「置き換え」ではなく
-- 「オーバーロードの追加」になるため、両方が共存してしまう。
-- その状態で create_circle('名前') を呼ぶと
-- 「function create_circle(unknown) is not unique」で失敗する。
-- -----------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.create_circle(TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.create_circle(
  p_name           TEXT,
  p_description    TEXT   DEFAULT NULL,
  p_scope          TEXT   DEFAULT 'university',
  p_university_ids UUID[] DEFAULT NULL
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
  v_scope         TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'ログインが必要です';
  END IF;

  v_name := nullif(btrim(coalesce(p_name, '')), '');
  IF v_name IS NULL THEN
    RAISE EXCEPTION 'サークル名を入力してください';
  END IF;

  v_scope := coalesce(p_scope, 'university');
  IF v_scope NOT IN ('university', 'scoped', 'public') THEN
    RAISE EXCEPTION '公開範囲の指定が不正です';
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

  IF v_scope = 'scoped'
     AND (p_university_ids IS NULL OR array_length(p_university_ids, 1) IS NULL) THEN
    RAISE EXCEPTION '範囲を指定する場合は対象大学を1つ以上選んでください';
  END IF;

  INSERT INTO public.circles (university_id, name, description, status, scope)
  VALUES (
    v_university_id, v_name,
    nullif(btrim(coalesce(p_description, '')), ''),
    'pending', v_scope
  )
  RETURNING id INTO v_circle_id;

  IF v_scope = 'scoped' THEN
    INSERT INTO public.circle_universities (circle_id, university_id)
    SELECT v_circle_id, u
    FROM unnest(p_university_ids) AS u
    WHERE EXISTS (SELECT 1 FROM public.universities WHERE id = u)
    ON CONFLICT DO NOTHING;
  END IF;

  INSERT INTO public.circle_members (circle_id, user_id, role, status)
  VALUES (v_circle_id, v_uid, 'admin', 'active');

  RETURN v_circle_id;
END;
$$;

-- ▼▼▼ migrations/0004_facilities.sql ▼▼▼

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

-- ▼▼▼ migrations/0005_events.sql ▼▼▼

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

-- ▼▼▼ migrations/0006_facility_management.sql ▼▼▼

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

-- ▼▼▼ migrations/0007_event_participants.sql ▼▼▼

-- =============================================================================
-- イベント参加登録
-- =============================================================================
-- カレンダーの既定表示に「参加確定しているイベント」を含めるために必要。
--
-- 要件定義書には無いテーブルなので、既存の設計方針に合わせている:
--   - 参加主体は個人（users）のみ。サークル単位の参加という概念は持たない
--   - UNIQUE(event_id, user_id) で二重登録を防ぐ
--   - status は circle_members と同じ語彙を避け、出欠の意味で 'going' / 'cancelled'
-- =============================================================================

CREATE TABLE IF NOT EXISTS event_participants (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  status     TEXT NOT NULL DEFAULT 'going' CHECK (status IN ('going', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_event_participants_user  ON event_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_event_participants_event ON event_participants(event_id);

DO $$
BEGIN
  EXECUTE 'ALTER TABLE public.event_participants ENABLE ROW LEVEL SECURITY';
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'event_participants'
      AND policyname = 'dev_allow_all_event_participants'
  ) THEN
    EXECUTE 'CREATE POLICY dev_allow_all_event_participants
             ON public.event_participants FOR ALL USING (true) WITH CHECK (true)';
  END IF;
END $$;


-- -----------------------------------------------------------------------------
-- イベントが閲覧者に見えるか（SQL 側の可視判定）
-- -----------------------------------------------------------------------------
-- lib/events.ts の eventVisibleTo() と同じ規則。
-- サークル主催の internal / scoped は、主催サークルの所属大学を
-- 主催大学とみなす。
--
-- 参加登録の可否判定に使う。見えないイベントに参加できてしまうと、
-- URL さえ知っていれば他大学の学内限定イベントに紛れ込めるため。
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.event_visible_to_university(
  p_event_id      UUID,
  p_university_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
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


-- -----------------------------------------------------------------------------
-- 参加登録 / 取り消し
-- -----------------------------------------------------------------------------
-- 一般ユーザーも公開イベントには参加できる（要件定義書3章では閲覧のみと
-- されているが、閲覧できるイベントへの出欠表明は閲覧の延長とみなす）。
-- 見えないイベントには参加できない。
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.join_event(p_event_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid   UUID := auth.uid();
  v_role  TEXT;
  v_univ  UUID;
  v_date  TIMESTAMPTZ;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'ログインが必要です';
  END IF;

  SELECT event_date INTO v_date FROM public.events WHERE id = p_event_id;
  IF v_date IS NULL THEN
    RAISE EXCEPTION 'イベントが見つかりません';
  END IF;
  IF v_date < now() THEN
    RAISE EXCEPTION '終了したイベントには参加登録できません';
  END IF;

  SELECT role INTO v_role FROM public.users WHERE id = v_uid;

  SELECT CASE v_role
    WHEN 'student' THEN (SELECT university_id FROM public.student_profiles WHERE user_id = v_uid)
    WHEN 'staff'   THEN (SELECT university_id FROM public.staff_profiles   WHERE user_id = v_uid)
    ELSE NULL
  END INTO v_univ;

  IF NOT public.event_visible_to_university(p_event_id, v_univ) THEN
    RAISE EXCEPTION 'このイベントには参加できません';
  END IF;

  INSERT INTO public.event_participants (event_id, user_id, status)
  VALUES (p_event_id, v_uid, 'going')
  ON CONFLICT (event_id, user_id)
  DO UPDATE SET status = 'going';

  RETURN 'going';
END;
$$;


CREATE OR REPLACE FUNCTION public.leave_event(p_event_id UUID)
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

  UPDATE public.event_participants
  SET status = 'cancelled'
  WHERE event_id = p_event_id AND user_id = v_uid;
END;
$$;

-- ▼▼▼ migrations/0008_rls.sql ▼▼▼

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

-- ▼▼▼ migrations/0009_profile.sql ▼▼▼

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

-- ▼▼▼ migrations/0010_student_registration.sql ▼▼▼

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

-- ▼▼▼ migrations/0011_circle_posts.sql ▼▼▼

-- =============================================================================
-- サークル掲示板
-- =============================================================================
-- サークル内の連絡・相談の場。所属メンバーだけが読み書きできる。
--
-- 「お知らせ」と「掲示板」を別テーブルにはしない。実態は同じ投稿で、
-- 違いは「上に固定するかどうか」だけなので、is_pinned で表現する。
-- 固定できるのは管理者のみ。
--
-- 【権限】
--   閲覧 … そのサークルの active メンバーのみ
--   投稿 … 同上（連絡が管理者からの一方通行にならないようにする）
--   固定 … 管理者のみ
--   削除 … 投稿者本人、または管理者
-- =============================================================================

CREATE TABLE IF NOT EXISTS circle_posts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id  UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  -- 投稿者が退会・削除されても投稿は残す（連絡の履歴が欠けると困るため）
  author_id  UUID REFERENCES users(id) ON DELETE SET NULL,
  body       TEXT NOT NULL CHECK (btrim(body) <> ''),
  is_pinned  BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 一覧は「サークルごとに、固定を先頭、あとは新しい順」で引く
CREATE INDEX IF NOT EXISTS idx_circle_posts_circle
  ON circle_posts(circle_id, is_pinned DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_circle_posts_author ON circle_posts(author_id);

ALTER TABLE circle_posts ENABLE ROW LEVEL SECURITY;

-- 読み取りのみポリシーを作る。書き込みは RPC 経由に限る（0008 の方針）。
DROP POLICY IF EXISTS circle_posts_select ON circle_posts;
CREATE POLICY circle_posts_select ON circle_posts
  FOR SELECT TO authenticated USING (
    public.app_is_circle_member(circle_id)
  );


-- -----------------------------------------------------------------------------
-- 投稿
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_circle_post(
  p_circle_id UUID,
  p_body      TEXT,
  p_pinned    BOOLEAN DEFAULT false
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid  UUID := auth.uid();
  v_body TEXT;
  v_id   UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'ログインが必要です';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.circle_members
    WHERE circle_id = p_circle_id AND user_id = v_uid AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'このサークルのメンバーのみ投稿できます';
  END IF;

  v_body := nullif(btrim(coalesce(p_body, '')), '');
  IF v_body IS NULL THEN
    RAISE EXCEPTION '本文を入力してください';
  END IF;
  IF length(v_body) > 2000 THEN
    RAISE EXCEPTION '本文は2000文字以内で入力してください';
  END IF;

  -- 固定は管理者だけの操作。メンバーが指定しても無視する。
  IF p_pinned AND NOT EXISTS (
    SELECT 1 FROM public.circle_members
    WHERE circle_id = p_circle_id AND user_id = v_uid
      AND role = 'admin' AND status = 'active'
  ) THEN
    p_pinned := false;
  END IF;

  INSERT INTO public.circle_posts (circle_id, author_id, body, is_pinned)
  VALUES (p_circle_id, v_uid, v_body, coalesce(p_pinned, false))
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;


-- -----------------------------------------------------------------------------
-- 削除（投稿者本人、または管理者）
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.delete_circle_post(p_post_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid    UUID := auth.uid();
  v_author UUID;
  v_circle UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'ログインが必要です';
  END IF;

  SELECT author_id, circle_id INTO v_author, v_circle
  FROM public.circle_posts WHERE id = p_post_id;

  IF v_circle IS NULL THEN
    RAISE EXCEPTION '投稿が見つかりません';
  END IF;

  IF v_author IS DISTINCT FROM v_uid
     AND NOT EXISTS (
       SELECT 1 FROM public.circle_members
       WHERE circle_id = v_circle AND user_id = v_uid
         AND role = 'admin' AND status = 'active'
     ) THEN
    RAISE EXCEPTION 'この投稿を削除する権限がありません';
  END IF;

  DELETE FROM public.circle_posts WHERE id = p_post_id;
END;
$$;


-- -----------------------------------------------------------------------------
-- 固定の切り替え（管理者のみ）
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_post_pinned(
  p_post_id UUID,
  p_pinned  BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid    UUID := auth.uid();
  v_circle UUID;
BEGIN
  SELECT circle_id INTO v_circle FROM public.circle_posts WHERE id = p_post_id;
  IF v_circle IS NULL THEN
    RAISE EXCEPTION '投稿が見つかりません';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.circle_members
    WHERE circle_id = v_circle AND user_id = v_uid
      AND role = 'admin' AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'お知らせに設定できるのはサークル管理者のみです';
  END IF;

  UPDATE public.circle_posts SET is_pinned = coalesce(p_pinned, false)
  WHERE id = p_post_id;
END;
$$;

-- ▼▼▼ migrations/0012_activities.sql ▼▼▼

-- =============================================================================
-- 活動記録と出欠管理
-- =============================================================================
-- 「いつ活動して、誰が来たか」を残す。
--
-- イベント (events) とは目的が違うので別テーブルにする。
--   events              … 対外的な告知。可視範囲があり、他大学にも見せる
--   circle_activities   … 内部の活動記録。メンバーしか見ない
-- 週2回の練習をイベントとして毎回告知するのは実態に合わない。
--
-- 【出欠の考え方】
--   本人が事前に「出席／欠席」を登録し、管理者が実績として上書きもできる。
--   欄を分けず1つの状態にまとめているのは、二重管理を避けるため。
--   誰が最後に記録したかは recorded_by で分かる。
-- =============================================================================

CREATE TABLE IF NOT EXISTS circle_activities (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id     UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  title         TEXT NOT NULL CHECK (btrim(title) <> ''),
  activity_date TIMESTAMPTZ NOT NULL,
  location      TEXT,
  note          TEXT,
  created_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_circle_activities_circle
  ON circle_activities(circle_id, activity_date DESC);

CREATE TABLE IF NOT EXISTS activity_attendances (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID NOT NULL REFERENCES circle_activities(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status      TEXT NOT NULL CHECK (status IN ('present', 'absent')),
  -- 本人が登録したのか管理者が記録したのかを残す
  recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (activity_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_activity_attendances_activity
  ON activity_attendances(activity_id);
CREATE INDEX IF NOT EXISTS idx_activity_attendances_user
  ON activity_attendances(user_id);

ALTER TABLE circle_activities    ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_attendances ENABLE ROW LEVEL SECURITY;

-- 読み取りのみ。書き込みは RPC 経由に限る（0008 の方針）。
DROP POLICY IF EXISTS circle_activities_select ON circle_activities;
CREATE POLICY circle_activities_select ON circle_activities
  FOR SELECT TO authenticated USING (public.app_is_circle_member(circle_id));

-- 出欠は同じサークルのメンバー同士で見える。
-- 「誰が来ているか」が分からないと出欠管理として機能しないため。
DROP POLICY IF EXISTS activity_attendances_select ON activity_attendances;
CREATE POLICY activity_attendances_select ON activity_attendances
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM circle_activities a
      WHERE a.id = activity_id AND public.app_is_circle_member(a.circle_id)
    )
  );


-- -----------------------------------------------------------------------------
-- 活動の登録・削除（管理者のみ）
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_activity(
  p_circle_id     UUID,
  p_title         TEXT,
  p_activity_date TIMESTAMPTZ,
  p_location      TEXT DEFAULT NULL,
  p_note          TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid   UUID := auth.uid();
  v_title TEXT;
  v_id    UUID;
BEGIN
  IF NOT public.app_is_circle_admin(p_circle_id) THEN
    RAISE EXCEPTION '活動を登録できるのはサークル管理者のみです';
  END IF;

  v_title := nullif(btrim(coalesce(p_title, '')), '');
  IF v_title IS NULL THEN
    RAISE EXCEPTION '活動名を入力してください';
  END IF;
  IF p_activity_date IS NULL THEN
    RAISE EXCEPTION '活動日時を入力してください';
  END IF;

  INSERT INTO public.circle_activities
    (circle_id, title, activity_date, location, note, created_by)
  VALUES (
    p_circle_id, v_title, p_activity_date,
    nullif(btrim(coalesce(p_location, '')), ''),
    nullif(btrim(coalesce(p_note, '')), ''),
    v_uid
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;


CREATE OR REPLACE FUNCTION public.delete_activity(p_activity_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_circle UUID;
BEGIN
  SELECT circle_id INTO v_circle
  FROM public.circle_activities WHERE id = p_activity_id;

  IF v_circle IS NULL THEN
    RAISE EXCEPTION '活動が見つかりません';
  END IF;
  IF NOT public.app_is_circle_admin(v_circle) THEN
    RAISE EXCEPTION '活動を削除できるのはサークル管理者のみです';
  END IF;

  DELETE FROM public.circle_activities WHERE id = p_activity_id;
END;
$$;


-- -----------------------------------------------------------------------------
-- 出欠の登録
-- -----------------------------------------------------------------------------
-- 本人は自分の出欠のみ。管理者は同じサークルの誰の出欠でも記録できる。
-- 対象ユーザーを省略すると自分自身になる。
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_attendance(
  p_activity_id UUID,
  p_status      TEXT,
  p_user_id     UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid    UUID := auth.uid();
  v_target UUID := coalesce(p_user_id, auth.uid());
  v_circle UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'ログインが必要です';
  END IF;

  IF p_status NOT IN ('present', 'absent') THEN
    RAISE EXCEPTION '出欠の指定が不正です';
  END IF;

  SELECT circle_id INTO v_circle
  FROM public.circle_activities WHERE id = p_activity_id;
  IF v_circle IS NULL THEN
    RAISE EXCEPTION '活動が見つかりません';
  END IF;

  -- 他人の出欠を記録できるのは管理者だけ
  IF v_target <> v_uid AND NOT public.app_is_circle_admin(v_circle) THEN
    RAISE EXCEPTION '他のメンバーの出欠を記録できるのは管理者のみです';
  END IF;

  -- 対象が実際にそのサークルのメンバーであること
  IF NOT EXISTS (
    SELECT 1 FROM public.circle_members
    WHERE circle_id = v_circle AND user_id = v_target AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'そのサークルのメンバーではありません';
  END IF;

  INSERT INTO public.activity_attendances
    (activity_id, user_id, status, recorded_by, recorded_at)
  VALUES (p_activity_id, v_target, p_status, v_uid, NOW())
  ON CONFLICT (activity_id, user_id) DO UPDATE
    SET status      = excluded.status,
        recorded_by = excluded.recorded_by,
        recorded_at = excluded.recorded_at;
END;
$$;

-- ▼▼▼ migrations/0013_event_attendance.sql ▼▼▼

-- =============================================================================
-- イベントの出欠記録
-- =============================================================================
-- 流れ:
--   1. メンバーがイベントに参加登録する（既存の event_participants）
--   2. 当日、主催者が参加名簿を開いて出席/欠席を記録する
--
-- 0012 で circle_activities / activity_attendances を作ったが、
-- 出欠の対象はイベントそのものであるべきだった。同じ「出欠」の概念を
-- 2箇所に持つと記録が分散するため、0012 の仕組みは撤去する。
-- （必要になれば git 履歴から戻せる）
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 0012 の撤去
-- -----------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.set_attendance(UUID, TEXT, UUID);
DROP FUNCTION IF EXISTS public.create_activity(UUID, TEXT, TIMESTAMPTZ, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.delete_activity(UUID);
DROP TABLE IF EXISTS public.activity_attendances CASCADE;
DROP TABLE IF EXISTS public.circle_activities    CASCADE;


-- -----------------------------------------------------------------------------
-- 参加登録に出欠を持たせる
-- -----------------------------------------------------------------------------
-- attended は3状態を表す:
--   NULL  … まだ記録していない
--   true  … 出席
--   false … 欠席（登録したが来なかった）
--
-- 「未記録」と「欠席」を区別できるようにしている。区別が無いと、
-- 記録を取り忘れた回で全員が欠席扱いになってしまう。
-- -----------------------------------------------------------------------------

ALTER TABLE event_participants
  ADD COLUMN IF NOT EXISTS attended BOOLEAN,
  ADD COLUMN IF NOT EXISTS attendance_recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS attendance_recorded_at TIMESTAMPTZ;

COMMENT ON COLUMN event_participants.attended IS
  'NULL=未記録 / true=出席 / false=欠席。主催者が当日に記録する';


-- -----------------------------------------------------------------------------
-- 出欠の記録（主催者のみ）
-- -----------------------------------------------------------------------------
-- 主催者の判定は app_can_manage_event() を使う。
-- 大学主催なら同じ大学の職員、サークル主催ならそのサークルの管理者。
-- イベントの削除権限と同じ基準に揃えている。
--
-- p_attended に NULL を渡すと「未記録」に戻せる。押し間違いの取り消し用。
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.record_event_attendance(
  p_event_id UUID,
  p_user_id  UUID,
  p_attended BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'ログインが必要です';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.events WHERE id = p_event_id) THEN
    RAISE EXCEPTION 'イベントが見つかりません';
  END IF;

  IF NOT public.app_can_manage_event(p_event_id) THEN
    RAISE EXCEPTION '出欠を記録できるのはイベントの主催者のみです';
  END IF;

  -- 参加登録している人だけが名簿に載る
  IF NOT EXISTS (
    SELECT 1 FROM public.event_participants
    WHERE event_id = p_event_id AND user_id = p_user_id AND status = 'going'
  ) THEN
    RAISE EXCEPTION 'このイベントに参加登録していません';
  END IF;

  UPDATE public.event_participants
  SET attended               = p_attended,
      attendance_recorded_by = CASE WHEN p_attended IS NULL THEN NULL ELSE v_uid END,
      attendance_recorded_at = CASE WHEN p_attended IS NULL THEN NULL ELSE NOW() END
  WHERE event_id = p_event_id AND user_id = p_user_id;
END;
$$;


-- -----------------------------------------------------------------------------
-- 参加名簿（主催者のみ）
-- -----------------------------------------------------------------------------
-- 参加者の氏名は users から引けるが、主催者かどうかの判定を1か所に
-- まとめたいのと、未記録を含めた名簿を安定した順序で返したいので関数にする。
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.list_event_roster(p_event_id UUID)
RETURNS TABLE (
  roster_user_id  UUID,
  roster_name     TEXT,
  roster_attended BOOLEAN,
  roster_joined_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.app_can_manage_event(p_event_id) THEN
    RAISE EXCEPTION '参加名簿を見られるのはイベントの主催者のみです';
  END IF;

  RETURN QUERY
  SELECT ep.user_id, u.name, ep.attended, ep.created_at
  FROM public.event_participants ep
  JOIN public.users u ON u.id = ep.user_id
  WHERE ep.event_id = p_event_id AND ep.status = 'going'
  ORDER BY u.name;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.list_event_roster(UUID) FROM public, anon;

-- ▼▼▼ migrations/0014_notifications.sql ▼▼▼

-- =============================================================================
-- 通知
-- =============================================================================
-- アプリ内通知。ヘッダーのベルと通知一覧に出す。
--
-- 【生成箇所】
--   RPC の中ではなくトリガーで作る。RPC に書くと、後から書き込み経路を
--   追加したときに通知の実装を入れ忘れる。状態の変化そのものを捉える方が
--   取りこぼしがない。
--
-- 【自分の操作は通知しない】
--   承認した本人や投稿者本人に「承認されました」「投稿がありました」と
--   届いても意味がないので、auth.uid() と一致する相手には送らない。
-- =============================================================================

CREATE TABLE IF NOT EXISTS notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL CHECK (type IN (
    'approval_result',   -- 承認・却下の結果
    'request_received',  -- 自分への申請が届いた
    'board_post',        -- 掲示板の新着投稿
    'new_event'          -- 新しいイベントの告知
  )),
  title      TEXT NOT NULL,
  body       TEXT,
  /** 遷移先。アプリ内の相対パス */
  link       TEXT,
  read_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 未読の絞り込みと新着順の取得が主な用途
CREATE INDEX IF NOT EXISTS idx_notifications_user
  ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread
  ON notifications(user_id) WHERE read_at IS NULL;


-- -----------------------------------------------------------------------------
-- 通知設定（種類ごとの受け取り可否）
-- -----------------------------------------------------------------------------
-- 行が無い場合はすべて受け取る扱いにする。全ユーザーぶんを先に作らなくて
-- 済むよう、既定値を「行の不在」で表現している。
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id          UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  approval_result  BOOLEAN NOT NULL DEFAULT true,
  request_received BOOLEAN NOT NULL DEFAULT true,
  board_post       BOOLEAN NOT NULL DEFAULT true,
  new_event        BOOLEAN NOT NULL DEFAULT true,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE notifications             ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notifications_select ON notifications;
CREATE POLICY notifications_select ON notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS notification_preferences_select ON notification_preferences;
CREATE POLICY notification_preferences_select ON notification_preferences
  FOR SELECT TO authenticated USING (user_id = auth.uid());


-- -----------------------------------------------------------------------------
-- 通知を1件作る（内部用）
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.app_notify(
  p_user_id UUID,
  p_type    TEXT,
  p_title   TEXT,
  p_body    TEXT DEFAULT NULL,
  p_link    TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_wants BOOLEAN;
BEGIN
  IF p_user_id IS NULL THEN RETURN; END IF;

  -- 自分の操作の結果を自分に通知しない
  IF p_user_id = auth.uid() THEN RETURN; END IF;

  -- 設定行が無ければ受け取る（既定は全ON）
  SELECT CASE p_type
    WHEN 'approval_result'  THEN np.approval_result
    WHEN 'request_received' THEN np.request_received
    WHEN 'board_post'       THEN np.board_post
    WHEN 'new_event'        THEN np.new_event
    ELSE true
  END INTO v_wants
  FROM public.notification_preferences np
  WHERE np.user_id = p_user_id;

  IF v_wants IS FALSE THEN RETURN; END IF;

  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (p_user_id, p_type, p_title, p_body, p_link);
END;
$$;


-- -----------------------------------------------------------------------------
-- サークル参加申請 → 管理者へ / 承認・却下 → 本人へ
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.notify_circle_member_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_circle TEXT;
  v_name   TEXT;
  admin_id UUID;
BEGIN
  SELECT name INTO v_circle FROM public.circles WHERE id = NEW.circle_id;

  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    SELECT name INTO v_name FROM public.users WHERE id = NEW.user_id;
    FOR admin_id IN
      SELECT user_id FROM public.circle_members
      WHERE circle_id = NEW.circle_id AND role = 'admin' AND status = 'active'
    LOOP
      PERFORM public.app_notify(
        admin_id, 'request_received',
        v_circle || ' に参加申請が届きました',
        coalesce(v_name, '') || ' さんが参加を希望しています',
        '/circles/' || NEW.circle_id
      );
    END LOOP;

  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status <> 'pending' THEN
    PERFORM public.app_notify(
      NEW.user_id, 'approval_result',
      v_circle || ' への参加が' ||
        CASE WHEN NEW.status = 'active' THEN '承認されました' ELSE '見送られました' END,
      NULL,
      '/circles/' || NEW.circle_id
    );
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_circle_member ON circle_members;
CREATE TRIGGER trg_notify_circle_member
  AFTER INSERT OR UPDATE OF status ON circle_members
  FOR EACH ROW EXECUTE FUNCTION public.notify_circle_member_change();


-- -----------------------------------------------------------------------------
-- サークル設立申請 → 職員へ / 承認・却下 → 管理者へ
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.notify_circle_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE target UUID;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    FOR target IN
      SELECT sp.user_id FROM public.staff_profiles sp
      JOIN public.users u ON u.id = sp.user_id
      WHERE sp.university_id = NEW.university_id AND u.role = 'staff'
    LOOP
      PERFORM public.app_notify(
        target, 'request_received',
        'サークル設立の申請が届きました',
        NEW.name, '/circles'
      );
    END LOOP;

  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status <> 'pending' THEN
    FOR target IN
      SELECT user_id FROM public.circle_members
      WHERE circle_id = NEW.id AND role = 'admin' AND status = 'active'
    LOOP
      PERFORM public.app_notify(
        target, 'approval_result',
        NEW.name || ' の設立が' ||
          CASE WHEN NEW.status = 'approved' THEN '承認されました' ELSE '見送られました' END,
        NULL, '/circles/' || NEW.id
      );
    END LOOP;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_circle ON circles;
CREATE TRIGGER trg_notify_circle
  AFTER INSERT OR UPDATE OF status ON circles
  FOR EACH ROW EXECUTE FUNCTION public.notify_circle_change();


-- -----------------------------------------------------------------------------
-- 施設予約 申請 → 職員へ / 承認・却下 → 予約者へ
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.notify_reservation_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_facility TEXT;
  v_univ     UUID;
  target     UUID;
BEGIN
  SELECT name, university_id INTO v_facility, v_univ
  FROM public.facilities WHERE id = NEW.facility_id;

  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    FOR target IN
      SELECT sp.user_id FROM public.staff_profiles sp
      JOIN public.users u ON u.id = sp.user_id
      WHERE sp.university_id = v_univ AND u.role = 'staff'
    LOOP
      PERFORM public.app_notify(
        target, 'request_received',
        '施設の予約申請が届きました',
        coalesce(v_facility, '施設'), '/reservations'
      );
    END LOOP;

  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status <> 'pending' THEN
    -- 予約主体の排他的関連に合わせて宛先を決める
    IF NEW.booked_by_user_id IS NOT NULL THEN
      PERFORM public.app_notify(
        NEW.booked_by_user_id, 'approval_result',
        coalesce(v_facility, '施設') || ' の予約が' ||
          CASE WHEN NEW.status = 'approved' THEN '承認されました' ELSE '見送られました' END,
        NULL, '/reservations'
      );
    ELSE
      FOR target IN
        SELECT user_id FROM public.circle_members
        WHERE circle_id = NEW.group_circle_id AND status = 'active'
      LOOP
        PERFORM public.app_notify(
          target, 'approval_result',
          coalesce(v_facility, '施設') || ' の予約が' ||
            CASE WHEN NEW.status = 'approved' THEN '承認されました' ELSE '見送られました' END,
          NULL, '/reservations'
        );
      END LOOP;
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_reservation ON facility_reservations;
CREATE TRIGGER trg_notify_reservation
  AFTER INSERT OR UPDATE OF status ON facility_reservations
  FOR EACH ROW EXECUTE FUNCTION public.notify_reservation_change();


-- -----------------------------------------------------------------------------
-- 掲示板の新着 → サークルのメンバーへ
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.notify_circle_post()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_circle TEXT;
  target   UUID;
BEGIN
  SELECT name INTO v_circle FROM public.circles WHERE id = NEW.circle_id;

  FOR target IN
    SELECT user_id FROM public.circle_members
    WHERE circle_id = NEW.circle_id AND status = 'active'
  LOOP
    PERFORM public.app_notify(
      target, 'board_post',
      v_circle || (CASE WHEN NEW.is_pinned THEN ' のお知らせ' ELSE ' に新しい投稿' END),
      left(NEW.body, 80),
      '/board'
    );
  END LOOP;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_circle_post ON circle_posts;
CREATE TRIGGER trg_notify_circle_post
  AFTER INSERT ON circle_posts
  FOR EACH ROW EXECUTE FUNCTION public.notify_circle_post();


-- -----------------------------------------------------------------------------
-- 新しいイベント → サークルのメンバー / 主催大学の学生へ
-- -----------------------------------------------------------------------------
-- scoped イベントで対象に含まれる他大学の学生には送らない。
-- 「見えること」と「通知されること」は別で、他大学の予定まで
-- 通知されると多すぎるため。見たい人はカレンダーの設定で追える。
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.notify_new_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_host TEXT;
  target UUID;
BEGIN
  IF NEW.host_circle_id IS NOT NULL THEN
    SELECT name INTO v_host FROM public.circles WHERE id = NEW.host_circle_id;
    FOR target IN
      SELECT user_id FROM public.circle_members
      WHERE circle_id = NEW.host_circle_id AND status = 'active'
    LOOP
      PERFORM public.app_notify(
        target, 'new_event',
        v_host || ' のイベント: ' || NEW.title,
        to_char(NEW.event_date AT TIME ZONE 'Asia/Tokyo', 'MM月DD日 HH24:MI'),
        '/events/' || NEW.id
      );
    END LOOP;
  ELSE
    SELECT name INTO v_host FROM public.universities WHERE id = NEW.host_university_id;
    FOR target IN
      SELECT sp.user_id FROM public.student_profiles sp
      WHERE sp.university_id = NEW.host_university_id
    LOOP
      PERFORM public.app_notify(
        target, 'new_event',
        coalesce(v_host, '大学') || ' のイベント: ' || NEW.title,
        to_char(NEW.event_date AT TIME ZONE 'Asia/Tokyo', 'MM月DD日 HH24:MI'),
        '/events/' || NEW.id
      );
    END LOOP;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_new_event ON events;
CREATE TRIGGER trg_notify_new_event
  AFTER INSERT ON events
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_event();


-- -----------------------------------------------------------------------------
-- 既読・設定の操作
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.mark_notifications_read(p_ids UUID[] DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'ログインが必要です';
  END IF;

  -- 引数を省略するとすべて既読にする
  UPDATE public.notifications
  SET read_at = NOW()
  WHERE user_id = auth.uid()
    AND read_at IS NULL
    AND (p_ids IS NULL OR id = ANY(p_ids));
END;
$$;


CREATE OR REPLACE FUNCTION public.update_notification_preferences(
  p_approval_result  BOOLEAN,
  p_request_received BOOLEAN,
  p_board_post       BOOLEAN,
  p_new_event        BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'ログインが必要です';
  END IF;

  INSERT INTO public.notification_preferences
    (user_id, approval_result, request_received, board_post, new_event, updated_at)
  VALUES (
    auth.uid(), coalesce(p_approval_result, true), coalesce(p_request_received, true),
    coalesce(p_board_post, true), coalesce(p_new_event, true), NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    approval_result  = excluded.approval_result,
    request_received = excluded.request_received,
    board_post       = excluded.board_post,
    new_event        = excluded.new_event,
    updated_at       = NOW();
END;
$$;

-- ▼▼▼ migrations/0015_images.sql ▼▼▼

-- =============================================================================
-- 画像（サークル・イベント）
-- =============================================================================
-- Supabase Storage を使う。バケットの作成もポリシーも SQL で書けるので、
-- ダッシュボードでの手作業は不要。
--
-- 【公開バケットにしている理由】
--   サークルのロゴやイベントのフライヤーは元々公開される性質のもので、
--   署名付きURLにすると有効期限の管理が必要になる。
--   ただし URL を知っていれば誰でも参照できるため、機微な画像は
--   載せない前提。学内限定イベントの画像も同様。
--
-- 【書き込みの制御】
--   他のテーブルは RPC を唯一の書き込み経路にしているが、Storage への
--   アップロードは Storage API を直接叩くしかない。そのため
--   storage.objects に INSERT / UPDATE / DELETE のポリシーを書き、
--   パスから対象を判別して権限を確認する。
--
-- 【パスの規約】
--   circles/<circle_id>/<ファイル名>
--   events/<event_id>/<ファイル名>
-- =============================================================================


-- -----------------------------------------------------------------------------
-- バケット
-- -----------------------------------------------------------------------------
-- 5MB / 画像形式のみ。Storage 側で弾けるものはアプリに到達させない。
-- -----------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'images', 'images', true, 5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;


-- -----------------------------------------------------------------------------
-- 画像を保存する列
-- -----------------------------------------------------------------------------
-- URL ではなくバケット内のパスを持つ。プロジェクトの URL が変わっても
-- 追随でき、公開／非公開を後から切り替えても壊れないため。
-- -----------------------------------------------------------------------------

ALTER TABLE circles ADD COLUMN IF NOT EXISTS image_path TEXT;
ALTER TABLE events  ADD COLUMN IF NOT EXISTS image_path TEXT;

COMMENT ON COLUMN circles.image_path IS
  'images バケット内のパス。例: circles/<id>/logo.png';


-- -----------------------------------------------------------------------------
-- パスから書き込み権限を判定する
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.app_can_write_image(p_path TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_kind TEXT;
  v_id   UUID;
BEGIN
  v_kind := split_part(p_path, '/', 1);

  -- 不正な UUID でも例外にせず、単に権限なしとして扱う
  BEGIN
    v_id := split_part(p_path, '/', 2)::uuid;
  EXCEPTION WHEN others THEN
    RETURN false;
  END;

  IF v_kind = 'circles' THEN
    RETURN public.app_is_circle_admin(v_id);
  ELSIF v_kind = 'events' THEN
    RETURN public.app_can_manage_event(v_id);
  END IF;

  RETURN false;
END;
$$;


-- -----------------------------------------------------------------------------
-- Storage のポリシー
-- -----------------------------------------------------------------------------
-- 公開バケットなので読み取りは誰でも可。書き込みのみ制限する。
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS images_read   ON storage.objects;
DROP POLICY IF EXISTS images_insert ON storage.objects;
DROP POLICY IF EXISTS images_update ON storage.objects;
DROP POLICY IF EXISTS images_delete ON storage.objects;

CREATE POLICY images_read ON storage.objects
  FOR SELECT USING (bucket_id = 'images');

CREATE POLICY images_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'images' AND public.app_can_write_image(name));

CREATE POLICY images_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'images' AND public.app_can_write_image(name))
  WITH CHECK (bucket_id = 'images' AND public.app_can_write_image(name));

CREATE POLICY images_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'images' AND public.app_can_write_image(name));


-- -----------------------------------------------------------------------------
-- 画像パスの登録（アップロード後に呼ぶ）
-- -----------------------------------------------------------------------------
-- パスの妥当性も確認する。アップロード先とは別の対象を指す値を
-- 書き込めないようにするため。
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_circle_image(
  p_circle_id UUID,
  p_path      TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.app_is_circle_admin(p_circle_id) THEN
    RAISE EXCEPTION '画像を設定できるのはサークル管理者のみです';
  END IF;

  IF p_path IS NOT NULL
     AND p_path NOT LIKE 'circles/' || p_circle_id::text || '/%' THEN
    RAISE EXCEPTION '画像のパスが不正です';
  END IF;

  UPDATE public.circles SET image_path = p_path WHERE id = p_circle_id;
END;
$$;


CREATE OR REPLACE FUNCTION public.set_event_image(
  p_event_id UUID,
  p_path     TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.app_can_manage_event(p_event_id) THEN
    RAISE EXCEPTION '画像を設定できるのはイベントの主催者のみです';
  END IF;

  IF p_path IS NOT NULL
     AND p_path NOT LIKE 'events/' || p_event_id::text || '/%' THEN
    RAISE EXCEPTION '画像のパスが不正です';
  END IF;

  UPDATE public.events SET image_path = p_path WHERE id = p_event_id;
END;
$$;

-- ▼▼▼ migrations/0016_theme.sql ▼▼▼

-- =============================================================================
-- 表示テーマの個人設定
-- =============================================================================
-- 見た目の好みは人によるので、ユーザーごとに選べるようにする。
--
-- 保存先を Cookie ではなく DB にしているのは、端末を変えても設定が
-- 保たれるようにするため。サーバー側で読んで html に属性を付けるので、
-- 切り替え時にちらつかない（localStorage だと一瞬既定のテーマが見える）。
-- =============================================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS theme TEXT NOT NULL DEFAULT 'glass';

-- 既存行にも既定値が入るので、そのあとに制約を付ける
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_theme_check;
ALTER TABLE users
  ADD CONSTRAINT users_theme_check CHECK (theme IN ('glass', 'pop'));

COMMENT ON COLUMN users.theme IS
  'glass=グラスモーフィズム / pop=フラットで彩度の高いポップスタイル';


-- -----------------------------------------------------------------------------
-- テーマの変更
-- -----------------------------------------------------------------------------
-- 対象は常に自分自身。0008 の方針どおり、書き込みは RPC のみ。
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_my_theme(p_theme TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'ログインが必要です';
  END IF;

  IF p_theme NOT IN ('glass', 'pop') THEN
    RAISE EXCEPTION 'テーマの指定が不正です';
  END IF;

  UPDATE public.users SET theme = p_theme WHERE id = auth.uid();
END;
$$;

-- ▼▼▼ migrations/0017_theme_variants.sql ▼▼▼

-- =============================================================================
-- テーマの配色バリエーションを追加し、既定を pop にする
-- =============================================================================
-- 構造（角丸・影・ボタン形状）は pop 系で共通、配色だけが違う4種と、
-- 質感の異なる glass の計5種から選べるようにする。
-- =============================================================================

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_theme_check;
ALTER TABLE users
  ADD CONSTRAINT users_theme_check
  CHECK (theme IN ('pop', 'citrus', 'mint', 'berry', 'glass'));

-- 既定を pop に。既に glass を明示的に選んだ人の設定は変えない。
ALTER TABLE users ALTER COLUMN theme SET DEFAULT 'pop';

COMMENT ON COLUMN users.theme IS
  'pop/citrus/mint/berry=フラットなポップ系（配色違い） / glass=グラスモーフィズム';


CREATE OR REPLACE FUNCTION public.set_my_theme(p_theme TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'ログインが必要です';
  END IF;

  IF p_theme NOT IN ('pop', 'citrus', 'mint', 'berry', 'glass') THEN
    RAISE EXCEPTION 'テーマの指定が不正です';
  END IF;

  UPDATE public.users SET theme = p_theme WHERE id = auth.uid();
END;
$$;

-- ▼▼▼ migrations/0018_circle_event_stats.sql ▼▼▼

-- =============================================================================
-- サークルの活動記録に出す参加人数
-- =============================================================================
-- 活動記録に「出席N人 / 参加登録N人」を出しているが、event_participants は
-- RLS により「本人の登録」と「主催者から見た参加者一覧」しか読めない。
-- そのため一般メンバーには自分の1件しか返らず、常に「1人」と表示されていた。
--
-- 「誰が参加したか」は伏せたままにしたいので RLS は緩めない。
-- 代わりに人数だけを返す関数を用意する。個人を特定できる情報は返さない。
--
-- 【RETURNS TABLE の列名について】
-- 列名は関数内で変数として扱われ、本体クエリの同名列と衝突する。
-- stat_ 接頭辞を付けて避けている（0010 で踏んだのと同じ問題）。
-- =============================================================================

CREATE OR REPLACE FUNCTION public.circle_event_stats(p_circle_id UUID)
RETURNS TABLE (
  stat_event_id   UUID,
  stat_registered INT,
  stat_present    INT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- そのサークルのメンバーだけが見られる。
  -- 部外者が任意のサークルの活動量を調べられないようにするため。
  IF NOT public.app_is_circle_member(p_circle_id) THEN
    RAISE EXCEPTION 'このサークルのメンバーのみ参照できます';
  END IF;

  RETURN QUERY
  SELECT
    e.id,
    count(*) FILTER (WHERE ep.status = 'going')::INT,
    count(*) FILTER (WHERE ep.status = 'going' AND ep.attended IS TRUE)::INT
  FROM public.events e
  LEFT JOIN public.event_participants ep ON ep.event_id = e.id
  -- 引数のサークルが主催するイベントに限る。
  -- 他サークルのイベントIDを混ぜて集計を引き出せないようにしている。
  WHERE e.host_circle_id = p_circle_id
  GROUP BY e.id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.circle_event_stats(UUID) FROM public, anon;

-- ▼▼▼ migrations/0019_public_discovery.sql ▼▼▼

-- =============================================================================
-- 公開情報の閲覧（一般ユーザー向け）
-- =============================================================================
-- 高校生や企業の人が、志望校・取引先の大学で何が起きているかを
-- 見に来られるようにする。見せるのは公開設定のものだけ。
--
-- 追加するのは2つ。
--   watched_universities … 気にしている大学。一覧の既定の絞り込みに使う
--   circle_favorites     … 気になるサークル
--
-- どちらも「自分の行だけ読める」。書き込みポリシーは作らず、
-- SECURITY DEFINER の関数だけを書き込み口にする方針は既存と揃える。
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. サークルの可視範囲を scope に従わせる
-- -----------------------------------------------------------------------------
-- これまでは status='approved' でありさえすれば誰でも読めた。
-- サークル画面を学生・職員に限定していたので表には出ていなかったが、
-- 一般ユーザーに開くとそのまま非公開サークルまで見えてしまう。
--
-- 学生・職員の見え方は変えない。合同・インカレを探す動きを
-- 妨げたくないので、これまでどおり承認済みなら全部見える。
-- 変わるのは一般ユーザーと未ログインで、公開サークルだけになる。

DROP POLICY IF EXISTS circles_select ON circles;

CREATE POLICY circles_select ON circles
  FOR SELECT USING (
    public.app_is_circle_member(id)
    OR public.app_is_staff_of(university_id)
    OR (
      status = 'approved'
      AND (
        public.app_role() IN ('student', 'staff')
        OR scope = 'public'
      )
    )
  );

COMMENT ON POLICY circles_select ON circles IS
  '学生・職員は承認済みを全て。一般と未ログインは scope=public のみ。'
  'メンバーと主管大学の職員は承認前でも読める。';


-- -----------------------------------------------------------------------------
-- 2. 気にしている大学
-- -----------------------------------------------------------------------------
-- 一般ユーザーは所属大学を持たないので、何を既定で見せるかの手がかりがない。
-- 本人に選んでもらい、それを一覧の既定の絞り込みに使う。
-- 学生・職員が他大学を追いかける用途にも使えるよう、ロールは問わない。

CREATE TABLE IF NOT EXISTS watched_universities (
  user_id       UUID NOT NULL REFERENCES users(id)        ON DELETE CASCADE,
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, university_id)
);

COMMENT ON TABLE watched_universities IS
  '閲覧者が指定した、気にしている大学。表示の既定値にのみ使い、認可には使わない。';

ALTER TABLE watched_universities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS watched_universities_select ON watched_universities;
CREATE POLICY watched_universities_select ON watched_universities
  FOR SELECT TO authenticated USING (user_id = auth.uid());


-- -----------------------------------------------------------------------------
-- 3. 気になるサークル
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS circle_favorites (
  user_id    UUID NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  circle_id  UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, circle_id)
);

CREATE INDEX IF NOT EXISTS idx_circle_favorites_circle
  ON circle_favorites(circle_id);

COMMENT ON TABLE circle_favorites IS
  '閲覧者が気になったサークル。誰が入れたかは本人以外に見せない。';

ALTER TABLE circle_favorites ENABLE ROW LEVEL SECURITY;

-- 誰が何を気にしているかは行動履歴なので、他人からは読めない。
-- サークル側から「何人が気にしているか」も出さない。
-- 少人数のサークルでは人数の増減から個人が割れるため。
DROP POLICY IF EXISTS circle_favorites_select ON circle_favorites;
CREATE POLICY circle_favorites_select ON circle_favorites
  FOR SELECT TO authenticated USING (user_id = auth.uid());


-- -----------------------------------------------------------------------------
-- 4. 書き込み口
-- -----------------------------------------------------------------------------

/**
 * 気にしている大学を置き換える。
 *
 * 差分ではなく総入れ替えにしているのは、画面が「チェックした集合」を
 * そのまま送る形になるため。途中で失敗して片側だけ反映されることがない。
 */
CREATE OR REPLACE FUNCTION public.set_watched_universities(
  p_university_ids UUID[]
)
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count INT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'ログインが必要です';
  END IF;

  IF coalesce(array_length(p_university_ids, 1), 0) > 20 THEN
    RAISE EXCEPTION '指定できる大学は20校までです';
  END IF;

  DELETE FROM watched_universities WHERE user_id = auth.uid();

  -- universities と突き合わせるので、存在しない ID は黙って落ちる
  INSERT INTO watched_universities (user_id, university_id)
  SELECT auth.uid(), u.id
    FROM universities u
   WHERE u.id = ANY(p_university_ids);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

/**
 * 気になるサークルの登録・解除。
 *
 * 戻り値は登録後の状態（true=気になる）。
 *
 * SECURITY DEFINER なので RLS を通らない。見えないサークルを
 * 登録できてしまうと、ID を総当たりすることで非公開サークルの
 * 存在を確かめられるので、可視かどうかをここで自分で確認する。
 */
CREATE OR REPLACE FUNCTION public.toggle_circle_favorite(
  p_circle_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_removed INT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'ログインが必要です';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM circles c
     WHERE c.id = p_circle_id
       AND c.status = 'approved'
       AND (
         public.app_role() IN ('student', 'staff')
         OR c.scope = 'public'
       )
  ) THEN
    RAISE EXCEPTION 'このサークルは参照できません';
  END IF;

  DELETE FROM circle_favorites
   WHERE user_id = auth.uid() AND circle_id = p_circle_id;
  GET DIAGNOSTICS v_removed = ROW_COUNT;

  IF v_removed > 0 THEN
    RETURN FALSE;
  END IF;

  INSERT INTO circle_favorites (user_id, circle_id)
  VALUES (auth.uid(), p_circle_id);

  RETURN TRUE;
END;
$$;


-- -----------------------------------------------------------------------------
-- 5. 権限
-- -----------------------------------------------------------------------------

-- Supabase は public スキーマの新規テーブルを既定で anon にも GRANT する。
-- ポリシーを TO authenticated にしてあるので anon は1行も読めないが、
-- 権限の側でも閉じておく。
REVOKE ALL ON watched_universities FROM anon;
REVOKE ALL ON circle_favorites     FROM anon;

GRANT SELECT ON watched_universities TO authenticated;
GRANT SELECT ON circle_favorites     TO authenticated;

REVOKE EXECUTE ON FUNCTION public.set_watched_universities(UUID[]) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.toggle_circle_favorite(UUID)     FROM public, anon;

GRANT EXECUTE ON FUNCTION public.set_watched_universities(UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_circle_favorite(UUID)     TO authenticated;

-- ▼▼▼ migrations/0020_event_participation_roles.sql ▼▼▼

-- =============================================================================
-- 参加登録できる人を学生に限る
-- =============================================================================
-- 一般ユーザー（高校生・企業）は公開イベントを「見に来る」立場であって、
-- 参加者名簿に載る立場ではない。職員も同じで、画面上も参加導線は無い。
--
-- これまで join_event は役割を見ていなかった。公開イベントであれば
-- 誰でも登録が通る状態で、画面に出していなかっただけだった。
-- 名簿は出欠管理に使われるので、ここは画面ではなく DB で塞ぐ。
--
-- 退会（leave_event）は塞がない。すでに登録が残っている人が
-- 自分で取り消せなくなると、名簿から降りる手段が無くなるため。
--
-- 【CREATE OR REPLACE の注意】
-- 0008_rls.sql が join_event を SECURITY DEFINER に変えている。
-- 書き込みポリシーは存在せず、この関数が唯一の書き込み経路なので、
-- 作り直すときに SECURITY DEFINER を書き忘れると INVOKER に戻り、
-- 学生も含めて誰も参加登録できなくなる。
-- =============================================================================

CREATE OR REPLACE FUNCTION public.join_event(p_event_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid   UUID := auth.uid();
  v_role  TEXT;
  v_univ  UUID;
  v_date  TIMESTAMPTZ;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'ログインが必要です';
  END IF;

  SELECT event_date INTO v_date FROM public.events WHERE id = p_event_id;
  IF v_date IS NULL THEN
    RAISE EXCEPTION 'イベントが見つかりません';
  END IF;
  IF v_date < now() THEN
    RAISE EXCEPTION '終了したイベントには参加登録できません';
  END IF;

  SELECT role INTO v_role FROM public.users WHERE id = v_uid;

  IF v_role IS DISTINCT FROM 'student' THEN
    RAISE EXCEPTION '参加登録できるのは学生のみです';
  END IF;

  v_univ := (SELECT university_id FROM public.student_profiles WHERE user_id = v_uid);

  IF NOT public.event_visible_to_university(p_event_id, v_univ) THEN
    RAISE EXCEPTION 'このイベントには参加できません';
  END IF;

  INSERT INTO public.event_participants (event_id, user_id, status)
  VALUES (p_event_id, v_uid, 'going')
  ON CONFLICT (event_id, user_id)
  DO UPDATE SET status = 'going';

  RETURN 'going';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.join_event(UUID) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.join_event(UUID) TO authenticated;

-- ▼▼▼ migrations/0021_circle_public_profile.sql ▼▼▼

-- =============================================================================
-- サークルの公開プロフィール
-- =============================================================================
-- 一般ユーザー（高校生・企業）に「どんなサークルなのか」を伝えたい。
--
-- これまで一般ユーザーに見えるのは scope='public'（インカレ）だけだった。
-- しかし scope は「誰が参加できるか」の軸であって、「外部に紹介してよいか」
-- とは別の話。自大学のみの募集でも、活動内容は知ってもらいたい。
-- そこで掲載可否を独立した列として持たせる。
--
-- 既定は掲載する（TRUE）。大学のサークルは名前と活動内容を知ってもらう
-- ことに意味があるため。名簿・掲示板・活動記録はこれまでどおり
-- メンバー以外には見えない。掲載したくないサークルは管理者が下ろせる。
-- =============================================================================

ALTER TABLE circles
  ADD COLUMN IF NOT EXISTS public_listed   BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS public_intro    TEXT,
  ADD COLUMN IF NOT EXISTS public_schedule TEXT,
  ADD COLUMN IF NOT EXISTS public_contact  TEXT;

COMMENT ON COLUMN circles.public_listed IS
  '一般ユーザー・未ログインの一覧に載せるか。scope（参加できる範囲）とは別の軸。';
COMMENT ON COLUMN circles.public_intro IS    '公開用の活動紹介';
COMMENT ON COLUMN circles.public_schedule IS '公開用の活動日・場所';
COMMENT ON COLUMN circles.public_contact IS  '公開用の連絡先・SNS';


-- -----------------------------------------------------------------------------
-- 可視範囲を scope から public_listed に付け替える
-- -----------------------------------------------------------------------------
-- 0019 では scope='public' を条件にしていたが、上記のとおり軸が違う。
-- インカレでも掲載を下ろしたサークルは載せない。管理者の判断を優先する。

DROP POLICY IF EXISTS circles_select ON circles;

CREATE POLICY circles_select ON circles
  FOR SELECT USING (
    public.app_is_circle_member(id)
    OR public.app_is_staff_of(university_id)
    OR (
      status = 'approved'
      AND (
        public.app_role() IN ('student', 'staff')
        OR public_listed
      )
    )
  );

COMMENT ON POLICY circles_select ON circles IS
  '学生・職員は承認済みを全て。一般と未ログインは public_listed のものだけ。'
  'メンバーと主管大学の職員は承認前でも読める。';


-- -----------------------------------------------------------------------------
-- 編集口
-- -----------------------------------------------------------------------------

/**
 * 公開プロフィールの更新。サークル管理者のみ。
 *
 * circles には UPDATE ポリシーが無いので、書き込めるのはこの関数だけ。
 * 更新する列も4つに限っているため、名前や scope、承認状態が
 * この経路から書き換わることはない。
 */
CREATE OR REPLACE FUNCTION public.update_circle_public_profile(
  p_circle_id UUID,
  p_listed    BOOLEAN,
  p_intro     TEXT DEFAULT NULL,
  p_schedule  TEXT DEFAULT NULL,
  p_contact   TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'ログインが必要です';
  END IF;

  IF NOT public.app_is_circle_admin(p_circle_id) THEN
    RAISE EXCEPTION 'このサークルの管理者のみ編集できます';
  END IF;

  IF char_length(coalesce(p_intro, '')) > 1000 THEN
    RAISE EXCEPTION '活動紹介は1000文字までです';
  END IF;
  IF char_length(coalesce(p_schedule, '')) > 200 THEN
    RAISE EXCEPTION '活動日・場所は200文字までです';
  END IF;
  IF char_length(coalesce(p_contact, '')) > 200 THEN
    RAISE EXCEPTION '連絡先は200文字までです';
  END IF;

  UPDATE circles
     SET public_listed   = coalesce(p_listed, TRUE),
         -- 空欄は NULL に寄せる。空文字と未入力を画面側で区別したくない
         public_intro    = nullif(btrim(coalesce(p_intro, '')), ''),
         public_schedule = nullif(btrim(coalesce(p_schedule, '')), ''),
         public_contact  = nullif(btrim(coalesce(p_contact, '')), '')
   WHERE id = p_circle_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_circle_public_profile(UUID, BOOLEAN, TEXT, TEXT, TEXT)
  FROM public, anon;
GRANT EXECUTE ON FUNCTION public.update_circle_public_profile(UUID, BOOLEAN, TEXT, TEXT, TEXT)
  TO authenticated;

-- ▼▼▼ migrations/0022_event_reminders.sql ▼▼▼

-- =============================================================================
-- 参加イベントのリマインド
-- =============================================================================
-- 参加登録したイベントについて、開始の何分前に知らせるかを
-- イベントごと・利用者ごとに決められるようにする。
--
-- 【なぜ既存のトリガー方式ではないか】
-- 既存の通知は「状態が変わった瞬間」に作られる。リマインドは
-- 「時刻が来たら」なので、変化を捉えるトリガーでは表現できない。
-- 予約表（event_reminders）を持ち、定期実行で期限の来たものを配る。
--
-- 【app_notify を経由しない理由】
-- app_notify は p_user_id = auth.uid() のとき送信を止める。
-- 自分の操作の結果を自分に通知しないための仕組みだが、リマインドは
-- 本人が本人のために仕掛けるものなので、この判定に掛かると必ず消える。
-- 受け取り設定だけ自分で確認して、notifications へ直接入れる。
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. 通知の種類を増やす
-- -----------------------------------------------------------------------------

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'approval_result',
    'request_received',
    'board_post',
    'new_event',
    'event_reminder'
  ));

ALTER TABLE notification_preferences
  ADD COLUMN IF NOT EXISTS event_reminder BOOLEAN NOT NULL DEFAULT true;


-- -----------------------------------------------------------------------------
-- 2. 受け取り設定の更新（引数が1つ増える）
-- -----------------------------------------------------------------------------
-- CREATE OR REPLACE は引数の並びが違うと「置き換え」ではなく
-- 「多重定義の追加」になる。古い4引数版が残ると、どちらが呼ばれるか
-- 分からなくなるので先に落とす（0003 で踏んだのと同じ問題）。

DROP FUNCTION IF EXISTS public.update_notification_preferences(
  BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN
);

CREATE OR REPLACE FUNCTION public.update_notification_preferences(
  p_approval_result  BOOLEAN,
  p_request_received BOOLEAN,
  p_board_post       BOOLEAN,
  p_new_event        BOOLEAN,
  p_event_reminder   BOOLEAN DEFAULT true
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'ログインが必要です';
  END IF;

  INSERT INTO public.notification_preferences
    (user_id, approval_result, request_received, board_post, new_event,
     event_reminder, updated_at)
  VALUES (
    auth.uid(),
    coalesce(p_approval_result, true),
    coalesce(p_request_received, true),
    coalesce(p_board_post, true),
    coalesce(p_new_event, true),
    coalesce(p_event_reminder, true),
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    approval_result  = EXCLUDED.approval_result,
    request_received = EXCLUDED.request_received,
    board_post       = EXCLUDED.board_post,
    new_event        = EXCLUDED.new_event,
    event_reminder   = EXCLUDED.event_reminder,
    updated_at       = NOW();
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_notification_preferences(
  BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.update_notification_preferences(
  BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN) TO authenticated;

-- app_notify の受け取り判定にも新しい種類を足す
CREATE OR REPLACE FUNCTION public.app_notify(
  p_user_id UUID,
  p_type    TEXT,
  p_title   TEXT,
  p_body    TEXT DEFAULT NULL,
  p_link    TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_wants BOOLEAN;
BEGIN
  IF p_user_id IS NULL THEN RETURN; END IF;
  IF p_user_id = auth.uid() THEN RETURN; END IF;

  SELECT CASE p_type
    WHEN 'approval_result'  THEN np.approval_result
    WHEN 'request_received' THEN np.request_received
    WHEN 'board_post'       THEN np.board_post
    WHEN 'new_event'        THEN np.new_event
    WHEN 'event_reminder'   THEN np.event_reminder
    ELSE true
  END INTO v_wants
  FROM public.notification_preferences np
  WHERE np.user_id = p_user_id;

  IF v_wants IS FALSE THEN RETURN; END IF;

  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (p_user_id, p_type, p_title, p_body, p_link);
END;
$$;


-- -----------------------------------------------------------------------------
-- 3. リマインドの予約表
-- -----------------------------------------------------------------------------
-- 1イベントにつき1件。複数の時刻を仕掛けたくなったら主キーを崩す。

CREATE TABLE IF NOT EXISTS event_reminders (
  user_id      UUID NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  event_id     UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  /** 開始の何分前に知らせるか */
  lead_minutes INT  NOT NULL CHECK (lead_minutes BETWEEN 5 AND 10080),
  /** 送信済みなら時刻。時刻を変えたら NULL に戻して送り直す */
  notified_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, event_id)
);

COMMENT ON TABLE event_reminders IS
  '参加イベントのリマインド予約。定期実行で期限の来たものを通知に変える。';

-- 定期実行が「まだ送っていないもの」だけを走査できるようにする
CREATE INDEX IF NOT EXISTS idx_event_reminders_pending
  ON event_reminders(event_id) WHERE notified_at IS NULL;

ALTER TABLE event_reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS event_reminders_select ON event_reminders;
CREATE POLICY event_reminders_select ON event_reminders
  FOR SELECT TO authenticated USING (user_id = auth.uid());

REVOKE ALL ON event_reminders FROM anon;
GRANT SELECT ON event_reminders TO authenticated;


-- -----------------------------------------------------------------------------
-- 4. 設定する
-- -----------------------------------------------------------------------------

/**
 * リマインドの設定・解除。p_lead_minutes に NULL を渡すと解除。
 *
 * 参加登録しているイベントにしか仕掛けられない。参加していない
 * イベントに仕掛けられると、開始時刻を知る手段として使えてしまう。
 */
CREATE OR REPLACE FUNCTION public.set_event_reminder(
  p_event_id     UUID,
  p_lead_minutes INT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_date TIMESTAMPTZ;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'ログインが必要です';
  END IF;

  IF p_lead_minutes IS NULL THEN
    DELETE FROM public.event_reminders
     WHERE user_id = auth.uid() AND event_id = p_event_id;
    RETURN;
  END IF;

  IF p_lead_minutes < 5 OR p_lead_minutes > 10080 THEN
    RAISE EXCEPTION 'リマインドは5分前から1週間前までの間で指定してください';
  END IF;

  SELECT event_date INTO v_date FROM public.events WHERE id = p_event_id;
  IF v_date IS NULL THEN
    RAISE EXCEPTION 'イベントが見つかりません';
  END IF;
  IF v_date < now() THEN
    RAISE EXCEPTION '終了したイベントには設定できません';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.event_participants
     WHERE event_id = p_event_id
       AND user_id = auth.uid()
       AND status = 'going'
  ) THEN
    RAISE EXCEPTION '参加登録しているイベントにのみ設定できます';
  END IF;

  INSERT INTO public.event_reminders (user_id, event_id, lead_minutes)
  VALUES (auth.uid(), p_event_id, p_lead_minutes)
  ON CONFLICT (user_id, event_id) DO UPDATE
    SET lead_minutes = EXCLUDED.lead_minutes,
        -- 時刻を変えたら送り直せるように未送信へ戻す
        notified_at  = NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_event_reminder(UUID, INT) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_event_reminder(UUID, INT) TO authenticated;


-- -----------------------------------------------------------------------------
-- 5. 期限の来たリマインドを配る
-- -----------------------------------------------------------------------------

/**
 * 送信した件数を返す。定期実行から呼ぶ。
 *
 * 参加を取り消した人には送らない（結合条件で status='going' を要求）。
 * 終了済みのイベントにも送らない。設定を切っている人にも送らない。
 */
CREATE OR REPLACE FUNCTION public.deliver_due_event_reminders()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count INT;
BEGIN
  -- 実行が重なっても二重に送らない。前の回がまだ走っていれば何もしない
  IF NOT pg_try_advisory_xact_lock(hashtext('deliver_due_event_reminders')) THEN
    RETURN 0;
  END IF;

  WITH due AS (
    SELECT r.user_id, r.event_id, e.title, e.event_date
      FROM public.event_reminders r
      JOIN public.events e ON e.id = r.event_id
      JOIN public.event_participants p
        ON p.event_id = r.event_id
       AND p.user_id  = r.user_id
       AND p.status   = 'going'
      LEFT JOIN public.notification_preferences np ON np.user_id = r.user_id
     WHERE r.notified_at IS NULL
       AND e.event_date > now()
       AND now() >= e.event_date - make_interval(mins => r.lead_minutes)
       AND coalesce(np.event_reminder, true)
  ),
  sent AS (
    INSERT INTO public.notifications (user_id, type, title, body, link)
    SELECT d.user_id,
           'event_reminder',
           d.title || ' がまもなく始まります',
           to_char(d.event_date AT TIME ZONE 'Asia/Tokyo',
                   'MM"月"DD"日" HH24:MI') || ' 開始',
           '/events/' || d.event_id
      FROM due d
    RETURNING 1
  ),
  marked AS (
    UPDATE public.event_reminders r
       SET notified_at = now()
      FROM due d
     WHERE r.user_id = d.user_id AND r.event_id = d.event_id
    RETURNING 1
  )
  SELECT count(*)::INT INTO v_count FROM marked;

  RETURN coalesce(v_count, 0);
END;
$$;

-- 呼ぶのは定期実行だけ。利用者から直接叩ける必要はない
REVOKE EXECUTE ON FUNCTION public.deliver_due_event_reminders()
  FROM public, anon, authenticated;


-- -----------------------------------------------------------------------------
-- 6. 定期実行の登録
-- -----------------------------------------------------------------------------
-- pg_cron が有効でなければ登録を飛ばす。ここで失敗させると
-- 上の定義まで巻き戻ってしまうため。

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE
      'pg_cron が有効でないため、リマインドの定期実行は登録しませんでした。'
      'Supabase の Database > Extensions で pg_cron を有効にしてから、'
      'このファイルを流し直してください。';
    RETURN;
  END IF;

  PERFORM cron.unschedule(jobid)
     FROM cron.job WHERE jobname = 'deliver-event-reminders';

  PERFORM cron.schedule(
    'deliver-event-reminders',
    '*/5 * * * *',
    'SELECT public.deliver_due_event_reminders();'
  );

  RAISE NOTICE 'リマインドの定期実行を5分間隔で登録しました。';
END;
$$;

-- ▼▼▼ migrations/0023_university_details.sql ▼▼▼

-- =============================================================================
-- 大学マスタの拡充とキャンパス
-- =============================================================================
-- 多くの大学が載ることを想定すると、公開のサークル一覧に全大学を
-- 平坦に並べるのは成り立たない。都道府県 → 大学 → サークル と
-- 辿れるようにするため、大学に所在地を持たせる。
--
-- あわせてキャンパスを別テーブルにする。複数キャンパスを持つ大学では、
-- サークルの拠点がどこなのかが名前だけでは分からないため。
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. 大学の属性
-- -----------------------------------------------------------------------------
-- prefecture は表記ゆれがあると絞り込みが壊れるので、47都道府県に限る。
-- name_kana は並び順のため。漢字の localeCompare は読みを当てられず、
-- 「青空大学」と「海原大学」の前後すら安定しない。

ALTER TABLE universities
  ADD COLUMN IF NOT EXISTS prefecture  TEXT,
  ADD COLUMN IF NOT EXISTS name_kana   TEXT,
  ADD COLUMN IF NOT EXISTS website_url TEXT;

ALTER TABLE universities DROP CONSTRAINT IF EXISTS universities_prefecture_check;
ALTER TABLE universities ADD CONSTRAINT universities_prefecture_check
  CHECK (prefecture IS NULL OR prefecture IN (
    '北海道','青森県','岩手県','宮城県','秋田県','山形県','福島県',
    '茨城県','栃木県','群馬県','埼玉県','千葉県','東京都','神奈川県',
    '新潟県','富山県','石川県','福井県','山梨県','長野県',
    '岐阜県','静岡県','愛知県','三重県',
    '滋賀県','京都府','大阪府','兵庫県','奈良県','和歌山県',
    '鳥取県','島根県','岡山県','広島県','山口県',
    '徳島県','香川県','愛媛県','高知県',
    '福岡県','佐賀県','長崎県','熊本県','大分県','宮崎県','鹿児島県','沖縄県'
  ));

CREATE INDEX IF NOT EXISTS idx_universities_prefecture
  ON universities(prefecture);

COMMENT ON COLUMN universities.prefecture  IS '所在地の都道府県。公開一覧の絞り込みに使う。';
COMMENT ON COLUMN universities.name_kana   IS '並び順のための読み。';
COMMENT ON COLUMN universities.website_url IS '公式サイト。公開ページから案内する。';


-- -----------------------------------------------------------------------------
-- 2. キャンパス
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS campuses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  address       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (university_id, name)
);

CREATE INDEX IF NOT EXISTS idx_campuses_university ON campuses(university_id);

COMMENT ON TABLE campuses IS
  '大学のキャンパス。サークルの拠点を示すのに使う。管理するのはその大学の職員。';

ALTER TABLE campuses ENABLE ROW LEVEL SECURITY;

-- 大学と同じく誰でも読める。どこで活動しているかは公開情報。
DROP POLICY IF EXISTS campuses_select ON campuses;
CREATE POLICY campuses_select ON campuses FOR SELECT USING (true);

GRANT SELECT ON campuses TO anon, authenticated;


-- -----------------------------------------------------------------------------
-- 3. サークルの拠点
-- -----------------------------------------------------------------------------
-- 「そのサークルの大学のキャンパスか」は複合外部キーでも表せるが、
-- ON DELETE SET NULL が両方の列を NULL にしてしまい、
-- キャンパスを消すとサークルの所属大学まで外れる。
-- 単純な外部キーにして、大学の一致は書き込み口の関数で担保する。
-- circles には UPDATE ポリシーが無く、書き込めるのは関数だけなので、
-- 実質的にはここが唯一の入口になる。

ALTER TABLE circles
  ADD COLUMN IF NOT EXISTS campus_id UUID REFERENCES campuses(id) ON DELETE SET NULL;

COMMENT ON COLUMN circles.campus_id IS
  '主な活動拠点。同じ大学のキャンパスであることは update_circle_public_profile が確認する。';


-- -----------------------------------------------------------------------------
-- 4. キャンパスの管理（その大学の職員のみ）
-- -----------------------------------------------------------------------------

/** 追加・更新。p_id が NULL なら追加。大学は職員自身の所属で固定する。 */
CREATE OR REPLACE FUNCTION public.upsert_campus(
  p_id      UUID,
  p_name    TEXT,
  p_address TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_university UUID := public.app_university_id();
  v_name       TEXT := btrim(coalesce(p_name, ''));
  v_id         UUID;
BEGIN
  IF public.app_role() IS DISTINCT FROM 'staff' OR v_university IS NULL THEN
    RAISE EXCEPTION 'キャンパスを管理できるのは大学職員のみです';
  END IF;
  IF v_name = '' THEN
    RAISE EXCEPTION 'キャンパス名を入力してください';
  END IF;
  IF char_length(v_name) > 60 THEN
    RAISE EXCEPTION 'キャンパス名は60文字までです';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.campuses (university_id, name, address)
    VALUES (v_university, v_name, nullif(btrim(coalesce(p_address, '')), ''))
    RETURNING id INTO v_id;
    RETURN v_id;
  END IF;

  UPDATE public.campuses
     SET name    = v_name,
         address = nullif(btrim(coalesce(p_address, '')), '')
   WHERE id = p_id
     -- 他大学のキャンパスは触れない
     AND university_id = v_university
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'キャンパスが見つかりません';
  END IF;
  RETURN v_id;
END;
$$;

/** 削除。参照しているサークルの campus_id は外部キーで NULL に戻る。 */
CREATE OR REPLACE FUNCTION public.delete_campus(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_university UUID := public.app_university_id();
BEGIN
  IF public.app_role() IS DISTINCT FROM 'staff' OR v_university IS NULL THEN
    RAISE EXCEPTION 'キャンパスを管理できるのは大学職員のみです';
  END IF;

  DELETE FROM public.campuses
   WHERE id = p_id AND university_id = v_university;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.upsert_campus(UUID, TEXT, TEXT) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.delete_campus(UUID)             FROM public, anon;
GRANT EXECUTE ON FUNCTION public.upsert_campus(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_campus(UUID)             TO authenticated;


-- -----------------------------------------------------------------------------
-- 5. 公開プロフィールに拠点を足す
-- -----------------------------------------------------------------------------
-- 引数が増えるので、多重定義にならないよう古い版を先に落とす。

DROP FUNCTION IF EXISTS public.update_circle_public_profile(
  UUID, BOOLEAN, TEXT, TEXT, TEXT
);

CREATE OR REPLACE FUNCTION public.update_circle_public_profile(
  p_circle_id UUID,
  p_listed    BOOLEAN,
  p_intro     TEXT DEFAULT NULL,
  p_schedule  TEXT DEFAULT NULL,
  p_contact   TEXT DEFAULT NULL,
  p_campus_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_university UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'ログインが必要です';
  END IF;

  IF NOT public.app_is_circle_admin(p_circle_id) THEN
    RAISE EXCEPTION 'このサークルの管理者のみ編集できます';
  END IF;

  IF char_length(coalesce(p_intro, '')) > 1000 THEN
    RAISE EXCEPTION '活動紹介は1000文字までです';
  END IF;
  IF char_length(coalesce(p_schedule, '')) > 200 THEN
    RAISE EXCEPTION '活動日・場所は200文字までです';
  END IF;
  IF char_length(coalesce(p_contact, '')) > 200 THEN
    RAISE EXCEPTION '連絡先は200文字までです';
  END IF;

  SELECT university_id INTO v_university FROM public.circles WHERE id = p_circle_id;

  -- よその大学のキャンパスを拠点にはできない
  IF p_campus_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.campuses c
     WHERE c.id = p_campus_id AND c.university_id = v_university
  ) THEN
    RAISE EXCEPTION 'そのキャンパスは選べません';
  END IF;

  UPDATE public.circles
     SET public_listed   = coalesce(p_listed, TRUE),
         public_intro    = nullif(btrim(coalesce(p_intro, '')), ''),
         public_schedule = nullif(btrim(coalesce(p_schedule, '')), ''),
         public_contact  = nullif(btrim(coalesce(p_contact, '')), ''),
         campus_id       = p_campus_id
   WHERE id = p_circle_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_circle_public_profile(
  UUID, BOOLEAN, TEXT, TEXT, TEXT, UUID) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.update_circle_public_profile(
  UUID, BOOLEAN, TEXT, TEXT, TEXT, UUID) TO authenticated;


-- -----------------------------------------------------------------------------
-- 6. 既存データの補完
-- -----------------------------------------------------------------------------
-- 都道府県が空だと、公開の一覧で全大学が「未設定」に落ちて絞り込みの
-- 意味が無くなる。デモ用の大学にだけ、未設定のときに限って埋める。
-- 実運用の大学を上書きしないよう、ID を指定して当てている。

UPDATE universities SET prefecture = v.pref, name_kana = v.kana
  FROM (VALUES
    ('a0000000-0000-4000-8000-000000000001'::uuid, '東京都',   'あおぞらだいがく'),
    ('a0000000-0000-4000-8000-000000000002'::uuid, '神奈川県', 'うなばらだいがく'),
    ('a0000000-0000-4000-8000-000000000003'::uuid, '東京都',   'やまてこうかだいがく'),
    ('a0000000-0000-4000-8000-000000000004'::uuid, '大阪府',   'さくらがおかだいがく'),
    ('a0000000-0000-4000-8000-000000000005'::uuid, '北海道',   'ほくとだいがく'),
    ('a0000000-0000-4000-8000-000000000006'::uuid, '福岡県',   'せいりょうがくいんだいがく')
  ) AS v(id, pref, kana)
 WHERE universities.id = v.id AND universities.prefecture IS NULL;

-- 各大学に本部キャンパスを1つ用意しておく。複数拠点の大学は職員が足す。
INSERT INTO campuses (university_id, name)
SELECT u.id, '本部キャンパス'
  FROM universities u
 WHERE NOT EXISTS (SELECT 1 FROM campuses c WHERE c.university_id = u.id);

-- ▼▼▼ migrations/0024_campus_location.sql ▼▼▼

-- =============================================================================
-- キャンパスに所在地を持たせる
-- =============================================================================
-- 0023 では都道府県を大学に持たせたが、これだと県をまたいで
-- キャンパスを構える大学が、片方の県からしか見つからない。
-- 「神奈川県」を選んだ人に、横浜キャンパスを持つ東京の大学が出てこない。
--
-- 大学の行を分けて「○○大学（横浜キャンパス）」という名前にする手もあるが、
-- それをすると同じ大学が複数行になり、サークル・職員・施設が
-- どちらにぶら下がるのかが決まらなくなる。
-- 大学は1行のまま、所在地をキャンパス側に持たせる。
-- 「○○大学（横浜キャンパス）」という見せ方は、画面で組み立てればよい。
--
-- universities.prefecture は残す。本部の所在地として意味があり、
-- キャンパスの所在地が未設定のときの既定値にも使う。
-- =============================================================================

ALTER TABLE campuses
  ADD COLUMN IF NOT EXISTS prefecture TEXT;

ALTER TABLE campuses DROP CONSTRAINT IF EXISTS campuses_prefecture_check;
ALTER TABLE campuses ADD CONSTRAINT campuses_prefecture_check
  CHECK (prefecture IS NULL OR prefecture IN (
    '北海道','青森県','岩手県','宮城県','秋田県','山形県','福島県',
    '茨城県','栃木県','群馬県','埼玉県','千葉県','東京都','神奈川県',
    '新潟県','富山県','石川県','福井県','山梨県','長野県',
    '岐阜県','静岡県','愛知県','三重県',
    '滋賀県','京都府','大阪府','兵庫県','奈良県','和歌山県',
    '鳥取県','島根県','岡山県','広島県','山口県',
    '徳島県','香川県','愛媛県','高知県',
    '福岡県','佐賀県','長崎県','熊本県','大分県','宮崎県','鹿児島県','沖縄県'
  ));

CREATE INDEX IF NOT EXISTS idx_campuses_prefecture ON campuses(prefecture);

COMMENT ON COLUMN campuses.prefecture IS
  'キャンパスの所在地。公開一覧はこちらで絞る。大学の prefecture は本部の所在地。';

-- 既存のキャンパスは、大学の所在地を引き継ぐ
UPDATE campuses c
   SET prefecture = u.prefecture
  FROM universities u
 WHERE c.university_id = u.id AND c.prefecture IS NULL;


-- -----------------------------------------------------------------------------
-- 管理関数に所在地を足す
-- -----------------------------------------------------------------------------
-- 引数が増えるので、多重定義にならないよう古い版を先に落とす。

DROP FUNCTION IF EXISTS public.upsert_campus(UUID, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.upsert_campus(
  p_id         UUID,
  p_name       TEXT,
  p_address    TEXT DEFAULT NULL,
  p_prefecture TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_university UUID := public.app_university_id();
  v_name       TEXT := btrim(coalesce(p_name, ''));
  v_pref       TEXT := nullif(btrim(coalesce(p_prefecture, '')), '');
  v_id         UUID;
BEGIN
  IF public.app_role() IS DISTINCT FROM 'staff' OR v_university IS NULL THEN
    RAISE EXCEPTION 'キャンパスを管理できるのは大学職員のみです';
  END IF;
  IF v_name = '' THEN
    RAISE EXCEPTION 'キャンパス名を入力してください';
  END IF;
  IF char_length(v_name) > 60 THEN
    RAISE EXCEPTION 'キャンパス名は60文字までです';
  END IF;

  -- 所在地の指定が無ければ大学の所在地を引き継ぐ。
  -- 値の妥当性は CHECK 制約が受け持つ。
  IF v_pref IS NULL THEN
    SELECT prefecture INTO v_pref FROM public.universities WHERE id = v_university;
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.campuses (university_id, name, address, prefecture)
    VALUES (v_university, v_name, nullif(btrim(coalesce(p_address, '')), ''), v_pref)
    RETURNING id INTO v_id;
    RETURN v_id;
  END IF;

  UPDATE public.campuses
     SET name       = v_name,
         address    = nullif(btrim(coalesce(p_address, '')), ''),
         prefecture = v_pref
   WHERE id = p_id
     -- 他大学のキャンパスは触れない
     AND university_id = v_university
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'キャンパスが見つかりません';
  END IF;
  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.upsert_campus(UUID, TEXT, TEXT, TEXT)
  FROM public, anon;
GRANT EXECUTE ON FUNCTION public.upsert_campus(UUID, TEXT, TEXT, TEXT)
  TO authenticated;

-- ▼▼▼ seed.sql ▼▼▼

-- =============================================================================
-- 開発用テストデータ
-- =============================================================================
-- 0000_initial_schema.sql と 0001_handle_new_user.sql を流したあとに実行します。
--
-- ユーザー（users / student_profiles）はここでは作りません。
-- auth.users を経由する必要があるため、アプリの /signup 画面から
-- 登録してください（トリガーが自動で作成します）。
--
-- 何度流しても重複しないよう、固定UUID + ON CONFLICT DO NOTHING にしています。
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 大学
-- -----------------------------------------------------------------------------
-- ⚠️ これが1件も無いと /signup の大学選択が空になり、
--    学生アカウントを作成できません。
-- -----------------------------------------------------------------------------

INSERT INTO universities (id, name) VALUES
  ('a0000000-0000-4000-8000-000000000001', '青空大学'),
  ('a0000000-0000-4000-8000-000000000002', '海原大学'),
  ('a0000000-0000-4000-8000-000000000003', '山手工科大学')
ON CONFLICT (id) DO NOTHING;


-- -----------------------------------------------------------------------------
-- サークル
-- -----------------------------------------------------------------------------

INSERT INTO circles (id, university_id, name, description, status) VALUES
  ('c0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000001',
   '軽音楽部', 'ロックからジャズまで。週2回スタジオ練習しています。', 'approved'),
  ('c0000000-0000-4000-8000-000000000002',
   'a0000000-0000-4000-8000-000000000001',
   'プログラミング同好会', 'もくもく会と月1のLT大会をやっています。', 'approved'),
  ('c0000000-0000-4000-8000-000000000003',
   'a0000000-0000-4000-8000-000000000002',
   'フットサル部', '初心者歓迎。毎週土曜に活動中。', 'approved'),
  ('c0000000-0000-4000-8000-000000000004',
   'a0000000-0000-4000-8000-000000000001',
   '写真部', '設立申請中のサークルです。', 'pending')
ON CONFLICT (id) DO NOTHING;


-- -----------------------------------------------------------------------------
-- イベント
-- -----------------------------------------------------------------------------
-- 一覧は「今日以降」を表示するため、現在時刻からの相対日時で入れています。
--
-- 排他的関連の確認用に、大学主催とサークル主催の両方を用意しています。
-- visibility の出し分け確認用に public / internal の両方も入れています。
--   - public   … 未ログイン・一般ユーザーにも見える
--   - internal … 学生・職員のみ見える
-- -----------------------------------------------------------------------------

INSERT INTO events
  (id, host_university_id, host_circle_id, title, description,
   event_date, visibility, target_grades)
VALUES
  -- 大学主催・公開
  ('e0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000001', NULL,
   'オープンキャンパス2026',
   '学部紹介、模擬授業、キャンパスツアーを実施します。どなたでも参加できます。',
   NOW() + INTERVAL '7 days', 'public', ARRAY['高校生', '一般']),

  -- 大学主催・学内限定
  ('e0000000-0000-4000-8000-000000000002',
   'a0000000-0000-4000-8000-000000000001', NULL,
   '春学期 履修登録ガイダンス',
   '履修登録システムの使い方と注意点を説明します。',
   NOW() + INTERVAL '3 days', 'internal', ARRAY['1年', '2年']),

  -- サークル主催・公開
  ('e0000000-0000-4000-8000-000000000003',
   NULL, 'c0000000-0000-4000-8000-000000000001',
   '軽音楽部 新歓ライブ',
   '入場無料。5バンドが出演します。楽器未経験でも大歓迎です。',
   NOW() + INTERVAL '14 days', 'public', ARRAY['1年', '2年', '3年', '4年']),

  -- サークル主催・学内限定
  ('e0000000-0000-4000-8000-000000000004',
   NULL, 'c0000000-0000-4000-8000-000000000002',
   'もくもく会 #12',
   '各自の作業を持ち寄って黙々と進める会です。飛び入り参加OK。',
   NOW() + INTERVAL '5 days', 'internal', NULL),

  -- サークル主催・公開（少し先）
  ('e0000000-0000-4000-8000-000000000005',
   NULL, 'c0000000-0000-4000-8000-000000000003',
   'フットサル交流戦',
   '他大学との合同練習試合です。見学だけでも歓迎。',
   NOW() + INTERVAL '21 days', 'public', ARRAY['1年', '2年'])
ON CONFLICT (id) DO NOTHING;


-- -----------------------------------------------------------------------------
-- 施設マスタ
-- -----------------------------------------------------------------------------

INSERT INTO facilities (id, university_id, name, category, is_available) VALUES
  ('f0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000001', '第1講義室', 'facility', true),
  ('f0000000-0000-4000-8000-000000000002',
   'a0000000-0000-4000-8000-000000000001', '音楽スタジオA', 'facility', true),
  ('f0000000-0000-4000-8000-000000000003',
   'a0000000-0000-4000-8000-000000000001', '体育館', 'facility', true),
  ('f0000000-0000-4000-8000-000000000004',
   'a0000000-0000-4000-8000-000000000001', 'プロジェクター', 'equipment', true),
  ('f0000000-0000-4000-8000-000000000005',
   'a0000000-0000-4000-8000-000000000001', 'PA機材一式', 'equipment', false)
ON CONFLICT (id) DO NOTHING;


-- -----------------------------------------------------------------------------
-- 確認
-- -----------------------------------------------------------------------------

SELECT
  (SELECT count(*) FROM universities) AS universities,
  (SELECT count(*) FROM circles)      AS circles,
  (SELECT count(*) FROM events)       AS events,
  (SELECT count(*) FROM facilities)   AS facilities;
