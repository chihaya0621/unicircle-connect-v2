-- =============================================================================
-- テスト用の登場人物
-- =============================================================================
-- 名前は @t.test（RFC 2606 の予約ドメイン）。開発用の名簿とは別に持つ。
-- 名簿（lib/dev-users.mjs）を触るたびにテストが落ちると、直す気が失せるため。
--
-- handle_new_user のトリガーが auth.users への INSERT で public.users を
-- 先に作るので、あとから UPDATE で役割を与える。ON CONFLICT DO NOTHING で
-- 書こうとすると、トリガーが作った general の行が残って静かに失敗する。
-- =============================================================================

SET ROLE NONE;

-- 大学2校。片方は「他大学から見えないこと」を確かめるために要る。
INSERT INTO universities (id, name, prefecture) VALUES
  ('a1111111-0000-4000-8000-000000000001', 'テスト大学', '東京都'),
  ('a1111111-0000-4000-8000-000000000002', 'よその大学', '大阪府')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (email, raw_user_meta_data) VALUES
  ('staff-a@t.test',   '{"name":"甲大職員"}'),
  ('staff-a2@t.test',  '{"name":"甲大職員2"}'),
  ('staff-b@t.test',   '{"name":"乙大職員"}'),
  ('admin@t.test',     '{"name":"部長"}'),
  ('member@t.test',    '{"name":"部員"}'),
  ('outsider@t.test',  '{"name":"部外の学生"}'),
  ('general@t.test',   '{"name":"高校生"}')
ON CONFLICT (email) DO NOTHING;

-- 職員
UPDATE public.users u SET role = 'staff', name = a.raw_user_meta_data->>'name'
  FROM auth.users a
 WHERE a.id = u.id AND a.email IN ('staff-a@t.test','staff-a2@t.test','staff-b@t.test');

INSERT INTO staff_profiles (user_id, university_id)
SELECT a.id, (CASE WHEN a.email = 'staff-b@t.test'
                   THEN 'a1111111-0000-4000-8000-000000000002'
                   ELSE 'a1111111-0000-4000-8000-000000000001' END)::uuid
  FROM auth.users a
 WHERE a.email IN ('staff-a@t.test','staff-a2@t.test','staff-b@t.test')
ON CONFLICT (user_id) DO UPDATE SET university_id = excluded.university_id;

-- 学生
UPDATE public.users u SET role = 'student', name = a.raw_user_meta_data->>'name'
  FROM auth.users a
 WHERE a.id = u.id AND a.email IN ('admin@t.test','member@t.test','outsider@t.test');

INSERT INTO student_profiles (user_id, university_id, enrollment_year)
SELECT a.id, 'a1111111-0000-4000-8000-000000000001', 2025
  FROM auth.users a
 WHERE a.email IN ('admin@t.test','member@t.test','outsider@t.test')
ON CONFLICT (user_id) DO NOTHING;

-- 一般（高校生）は handle_new_user の既定のまま
UPDATE public.users u SET name = a.raw_user_meta_data->>'name'
  FROM auth.users a WHERE a.id = u.id AND a.email = 'general@t.test';

-- サークル。承認済みだが非公開（一般には見えない）
INSERT INTO circles (id, university_id, name, description, status, scope, public_listed)
VALUES ('cc111111-0000-4000-8000-000000000001',
        'a1111111-0000-4000-8000-000000000001',
        'テスト部', '検証用', 'approved', 'university', false)
ON CONFLICT (id) DO NOTHING;

-- 承認待ちのサークル。押印のテストに使う
INSERT INTO circles (id, university_id, name, description, status, scope)
VALUES ('cc111111-0000-4000-8000-000000000002',
        'a1111111-0000-4000-8000-000000000001',
        '申請中の部', '検証用', 'pending', 'university')
ON CONFLICT (id) DO NOTHING;

INSERT INTO circle_members (circle_id, user_id, role, status)
SELECT 'cc111111-0000-4000-8000-000000000001', a.id, v.r, 'active'
  FROM (VALUES ('admin@t.test','admin'), ('member@t.test','member')) AS v(email, r)
  JOIN auth.users a ON a.email = v.email
ON CONFLICT (circle_id, user_id) DO NOTHING;

-- 部内限定の連絡。部外に漏れないことを確かめる
INSERT INTO circle_posts (circle_id, author_id, body)
SELECT 'cc111111-0000-4000-8000-000000000001', a.id, '部内限定の連絡です'
  FROM auth.users a WHERE a.email = 'admin@t.test'
   AND NOT EXISTS (SELECT 1 FROM circle_posts
                    WHERE circle_id = 'cc111111-0000-4000-8000-000000000001');

-- 大学主催のイベント。学外に出すものと、出さないもの
INSERT INTO events (id, host_university_id, title, event_date, visibility, public_listed)
VALUES
  ('ee111111-0000-4000-8000-000000000001',
   'a1111111-0000-4000-8000-000000000001',
   'オープンキャンパス', now() + interval '10 days', 'public', true),
  ('ee111111-0000-4000-8000-000000000002',
   'a1111111-0000-4000-8000-000000000001',
   '防災訓練', now() + interval '12 days', 'public', false),
  ('ee111111-0000-4000-8000-000000000003',
   'a1111111-0000-4000-8000-000000000001',
   '学内限定の説明会', now() + interval '14 days', 'internal', false)
ON CONFLICT (id) DO NOTHING;

-- 施設と、部長の予約
INSERT INTO facilities (id, university_id, name, category, is_available)
VALUES ('ff111111-0000-4000-8000-000000000001',
        'a1111111-0000-4000-8000-000000000001', '第1会議室', 'facility', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO facility_reservations
  (id, facility_id, booked_by_user_id, start_time, end_time, purpose, status)
SELECT 'dd111111-0000-4000-8000-000000000001',
       'ff111111-0000-4000-8000-000000000001', a.id,
       now() + interval '3 days', now() + interval '3 days 2 hours', 'ミーティング', 'pending'
  FROM auth.users a WHERE a.email = 'admin@t.test'
ON CONFLICT (id) DO NOTHING;

RESET ROLE;
