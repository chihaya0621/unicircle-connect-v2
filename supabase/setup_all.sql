-- =============================================================================
-- UniCircle Connect セットアップ一括実行ファイル（自動生成）
-- =============================================================================
--
-- このファイルは以下を連結した生成物です。直接編集しないでください。
--   1. migrations/0000_initial_schema.sql
--   2. migrations/0001_handle_new_user.sql
--   3. seed.sql
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
