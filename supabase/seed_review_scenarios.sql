-- =============================================================================
-- 確認用シナリオ（0026〜0028 の動作確認）
-- =============================================================================
-- 承認待ち・承認済み・却下・廃止申請といった状態を、あらかじめ用意する。
-- 画面から一つずつ作らなくても、各機能の見え方を確かめられるようにする。
--
-- 【前に必要なもの】
--   1. 0026 / 0027 / 0028 を適用済みであること
--   2. npm run db:users を流し、staff2 / staff3 が作られていること
--      （複数人承認は職員が2人以上いないと設定できない）
--
-- 何度流しても増えない。UUID を決め打ちにして ON CONFLICT で受ける。
-- ユーザーはメールアドレスで引くので、ID を書き換える必要はない。
-- =============================================================================

-- 青空大学。承認は2人必要という運用にする
UPDATE universities SET required_circle_approvals = 2
 WHERE id = 'a0000000-0000-4000-8000-000000000001';


-- -----------------------------------------------------------------------------
-- 1. 設立の承認待ち
-- -----------------------------------------------------------------------------

INSERT INTO circles (id, university_id, name, description, status, scope) VALUES
  ('d0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000001',
   '【確認用】設立申請ちょうど出したところ',
   'まだ誰も承認していない状態です。職員2人の承認で成立します。',
   'pending', 'university'),
  ('d0000000-0000-4000-8000-000000000002',
   'a0000000-0000-4000-8000-000000000001',
   '【確認用】設立申請あと1人',
   '職員がひとり承認済みです。もうひとりで承認が成立します。',
   'pending', 'university')
ON CONFLICT (id) DO NOTHING;

-- 申請者（学生1）を管理者として入れておく
INSERT INTO circle_members (circle_id, user_id, role, status)
SELECT c.id, u.id, 'admin', 'active'
  FROM (VALUES
    ('d0000000-0000-4000-8000-000000000001'::uuid),
    ('d0000000-0000-4000-8000-000000000002'::uuid)
  ) AS c(id)
 CROSS JOIN auth.users u
 WHERE u.email = 'student1@aozora.test'
ON CONFLICT DO NOTHING;

-- 「あと1人」の方に、職員太郎の承認を1件入れておく
INSERT INTO approvals (target_type, target_id, approver_id, approver_name, decision, comment)
SELECT 'circle', 'd0000000-0000-4000-8000-000000000002', u.id,
       coalesce(pu.name, '職員'), 'approved', '活動計画を確認しました。'
  FROM auth.users u JOIN users pu ON pu.id = u.id
 WHERE u.email = 'staff1@aozora.test'
ON CONFLICT DO NOTHING;


-- -----------------------------------------------------------------------------
-- 2. 承認の記録が残っているサークル
-- -----------------------------------------------------------------------------

INSERT INTO circles (id, university_id, name, description, status, scope) VALUES
  ('d0000000-0000-4000-8000-000000000003',
   'a0000000-0000-4000-8000-000000000001',
   '【確認用】承認の記録つき',
   '2人の職員の承認を経て設立されたサークルです。詳細に記録が出ます。',
   'approved', 'university'),
  ('d0000000-0000-4000-8000-000000000004',
   'a0000000-0000-4000-8000-000000000001',
   '【確認用】却下されたサークル',
   '職員1人の却下で不成立になった例です。',
   'rejected', 'university')
ON CONFLICT (id) DO NOTHING;

INSERT INTO circle_members (circle_id, user_id, role, status)
SELECT 'd0000000-0000-4000-8000-000000000003', u.id, 'admin', 'active'
  FROM auth.users u WHERE u.email = 'student1@aozora.test'
ON CONFLICT DO NOTHING;

INSERT INTO approvals (target_type, target_id, approver_id, approver_name, decision, comment)
SELECT v.t, v.tid, u.id, coalesce(pu.name, '職員'), v.d, v.c
  FROM (VALUES
    ('circle', 'd0000000-0000-4000-8000-000000000003'::uuid,
     'staff1@aozora.test', 'approved', '規約と活動計画に問題ありません。'),
    ('circle', 'd0000000-0000-4000-8000-000000000003'::uuid,
     'staff2@aozora.test', 'approved', '顧問の承諾も確認済みです。'),
    ('circle', 'd0000000-0000-4000-8000-000000000004'::uuid,
     'staff1@aozora.test', 'rejected', '活動内容が既存のサークルと重複しています。')
  ) AS v(t, tid, email, d, c)
  JOIN auth.users u ON u.email = v.email
  JOIN users pu ON pu.id = u.id
ON CONFLICT DO NOTHING;


-- -----------------------------------------------------------------------------
-- 3. 廃止の申請
-- -----------------------------------------------------------------------------
-- 申請中も status は approved のまま。承認が揃った時点で closed になる。

INSERT INTO circles (id, university_id, name, description, status, scope,
                     closure_requested_at) VALUES
  ('d0000000-0000-4000-8000-000000000005',
   'a0000000-0000-4000-8000-000000000001',
   '【確認用】廃止申請 承認0件',
   '管理者が廃止を申請したところです。職員2人の承認で廃止されます。',
   'approved', 'university', now()),
  ('d0000000-0000-4000-8000-000000000006',
   'a0000000-0000-4000-8000-000000000001',
   '【確認用】廃止申請 あと1人',
   '職員がひとり承認済みです。もうひとりで廃止が成立します。',
   'approved', 'university', now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO circle_members (circle_id, user_id, role, status)
SELECT c.id, u.id, 'admin', 'active'
  FROM (VALUES
    ('d0000000-0000-4000-8000-000000000005'::uuid),
    ('d0000000-0000-4000-8000-000000000006'::uuid)
  ) AS c(id)
 CROSS JOIN auth.users u
 WHERE u.email = 'student1@aozora.test'
ON CONFLICT DO NOTHING;

INSERT INTO approvals (target_type, target_id, approver_id, approver_name, decision, comment)
SELECT 'circle_closure', 'd0000000-0000-4000-8000-000000000006', u.id,
       coalesce(pu.name, '職員'), 'approved', '在籍者がいないことを確認しました。'
  FROM auth.users u JOIN users pu ON pu.id = u.id
 WHERE u.email = 'staff1@aozora.test'
ON CONFLICT DO NOTHING;


-- -----------------------------------------------------------------------------
-- 4. 退会の可否
-- -----------------------------------------------------------------------------
-- 管理者がひとりだけのサークルからは抜けられない。
-- 2人いれば抜けられる。両方を用意して違いを見る。

INSERT INTO circles (id, university_id, name, description, status, scope) VALUES
  ('d0000000-0000-4000-8000-000000000007',
   'a0000000-0000-4000-8000-000000000001',
   '【確認用】管理者がひとり',
   '学生1が唯一の管理者です。退会しようとすると止まります。',
   'approved', 'university'),
  ('d0000000-0000-4000-8000-000000000008',
   'a0000000-0000-4000-8000-000000000001',
   '【確認用】管理者がふたり',
   '学生1と学生2が管理者です。学生1は退会できます。',
   'approved', 'university')
ON CONFLICT (id) DO NOTHING;

INSERT INTO circle_members (circle_id, user_id, role, status)
SELECT v.cid, u.id, v.r, 'active'
  FROM (VALUES
    ('d0000000-0000-4000-8000-000000000007'::uuid, 'student1@aozora.test', 'admin'),
    ('d0000000-0000-4000-8000-000000000007'::uuid, 'student2@aozora.test', 'member'),
    ('d0000000-0000-4000-8000-000000000007'::uuid, 'student3@aozora.test', 'member'),
    ('d0000000-0000-4000-8000-000000000008'::uuid, 'student1@aozora.test', 'admin'),
    ('d0000000-0000-4000-8000-000000000008'::uuid, 'student2@aozora.test', 'admin'),
    ('d0000000-0000-4000-8000-000000000008'::uuid, 'student3@aozora.test', 'member')
  ) AS v(cid, email, r)
  JOIN auth.users u ON u.email = v.email
ON CONFLICT DO NOTHING;


-- -----------------------------------------------------------------------------
-- 5. イベントの編集
-- -----------------------------------------------------------------------------
-- 参加者がいて、リマインドが「送信済み」になっているイベント。
-- 日時を動かすと notified_at が NULL に戻り、送り直しの対象になる。

INSERT INTO events (id, host_university_id, host_circle_id, title, description,
                    event_date, visibility, target_grades, public_listed) VALUES
  ('d1000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000001', NULL,
   '【確認用】日時を動かしてみるイベント',
   '参加者のリマインドが送信済みになっています。日時を変えると送り直しの対象に戻ります。',
   now() + interval '10 days', 'public', ARRAY['高校生','一般'], true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO event_participants (event_id, user_id, status)
SELECT 'd1000000-0000-4000-8000-000000000001', u.id, 'going'
  FROM auth.users u
 WHERE u.email IN ('student1@aozora.test', 'student2@aozora.test')
ON CONFLICT (event_id, user_id) DO UPDATE SET status = 'going';

INSERT INTO event_reminders (user_id, event_id, lead_minutes, notified_at)
SELECT u.id, 'd1000000-0000-4000-8000-000000000001', 1440, now()
  FROM auth.users u WHERE u.email = 'student1@aozora.test'
ON CONFLICT (user_id, event_id) DO UPDATE
  SET lead_minutes = 1440, notified_at = now();


-- -----------------------------------------------------------------------------
-- 確認
-- -----------------------------------------------------------------------------

SELECT
  (SELECT required_circle_approvals FROM universities
    WHERE id = 'a0000000-0000-4000-8000-000000000001') AS 必要承認者数,
  (SELECT count(*) FROM users u JOIN staff_profiles s ON s.user_id = u.id
    WHERE u.role = 'staff'
      AND s.university_id = 'a0000000-0000-4000-8000-000000000001') AS 青空の職員数,
  (SELECT count(*) FROM circles WHERE id::text LIKE 'd0000000%') AS 確認用サークル,
  (SELECT count(*) FROM circles
    WHERE closure_requested_at IS NOT NULL) AS 廃止申請中,
  (SELECT count(*) FROM approvals) AS 承認の記録;
