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
--   9. seed.sql
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
