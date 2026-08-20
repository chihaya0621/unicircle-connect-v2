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
