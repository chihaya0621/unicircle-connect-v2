-- =============================================================================
-- 協賛のデモ用データ（0036 の見え方の確認用）
-- =============================================================================
-- 協賛の募集と申し込みを、いくつかの状態で用意する。
--   ・軽音楽部        … 募集中。1社と成立し、もう1社が返事待ち
--   ・プログラミング同好会 … 募集中
--   ・テニスサークル SMASH … 募集中
--   ・写真研究会      … 大学の確認待ち（職員の「対応待ち」に並ぶ）
--
-- どれも青空大学の、外に公開しているサークル。募集は公開設定のサークル
-- でないと企業から見えない。企業の名前はすべて架空。
--
-- 【前に必要なもの】
--   1. 0036 を適用済みであること
--   2. npm run db:users を流し、staff1@aozora.test と
--      general1 / general2@example.test が作られていること
--
-- 何度流しても増えない。UUID を決め打ちにして ON CONFLICT で受ける。
-- ユーザーはメールアドレスで引くので、ID を書き換える必要はない。
--
-- 流したあとは、毎晩の戻し先に入れるため select public.demo_snapshot(); を流す。
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. 募集
-- -----------------------------------------------------------------------------

INSERT INTO sponsorship_requests
  (id, circle_id, title, purpose, amount_goal, returns, deadline, status,
   created_by, created_at)
VALUES
  ('f5000000-0000-4000-8000-000000000001',
   'c0000000-0000-4000-8000-000000000001',
   '12月の定期演奏会のホール代',
   '12月20日に市民ホールで開く定期演奏会の、会場費と音響機材の借り賃に使います。毎年200人ほどの方に来ていただいています。',
   120000,
   '当日のパンフレットと、ステージ横の看板に協賛企業のロゴを載せます。演奏会の最後に、協賛企業をご紹介します。',
   DATE '2026-11-30', 'pending',
   (SELECT id FROM auth.users WHERE email = 'student1@aozora.test'),
   now() - interval '12 days'),
  ('f5000000-0000-4000-8000-000000000002',
   'c0000000-0000-4000-8000-000000000002',
   '学内ハッカソンの開催費',
   '11月に、学内の学生向けに2日間のハッカソンを開きます。会場の電源と通信の設備、参加者の食事、賞品に使います。',
   200000,
   '開会の時間に、協賛企業の会社紹介を5分ずつ設けます。賞の名前に、協賛企業の名前を付けます。',
   DATE '2026-11-15', 'pending',
   NULL,
   now() - interval '9 days'),
  ('f5000000-0000-4000-8000-000000000003',
   'c0000000-0000-4000-8000-000000000011',
   '秋季リーグ戦の遠征費',
   '10月末の秋季リーグ戦（県外の会場）に出る部員8人の、交通費とコートの使用料に使います。',
   80000,
   '大会で着るTシャツの袖に、協賛企業のロゴを入れます。',
   DATE '2026-10-31', 'pending',
   (SELECT id FROM auth.users WHERE email = 'student1@aozora.test'),
   now() - interval '7 days'),
  ('f5000000-0000-4000-8000-000000000004',
   'c0000000-0000-4000-8000-000000000012',
   '学園祭の写真展のプリント代',
   '学園祭で開く写真展の、大判プリントと額の費用に使います。部員18人の作品を展示します。',
   50000,
   '会場の入り口に、協賛企業の名前を掲示します。',
   DATE '2026-11-20', 'pending',
   (SELECT id FROM auth.users WHERE email = 'student1@aozora.test'),
   now() - interval '2 days')
ON CONFLICT (id) DO NOTHING;


-- -----------------------------------------------------------------------------
-- 2. 大学の職員の確認（判子）
-- -----------------------------------------------------------------------------
-- 写真研究会のぶんは、あえて確認待ちのまま残す。職員の「対応待ち」で
-- 押すところを見せるため。
-- 記録の連なり（row_hash）は、承認の記録のトリガーが付ける。

INSERT INTO approvals
  (target_type, target_id, approver_id, approver_name, decision, comment,
   seal_text, seal_shape, created_at)
SELECT 'sponsorship', r.id, u.id, u.name, 'approved', '内容を確認しました。',
       coalesce(sp.seal_text, left(u.name, 2)), coalesce(sp.seal_shape, 'circle'),
       r.created_at + interval '1 day'
  FROM sponsorship_requests r
  CROSS JOIN public.users u
  LEFT JOIN staff_profiles sp ON sp.user_id = u.id
 WHERE r.id IN ('f5000000-0000-4000-8000-000000000001',
                'f5000000-0000-4000-8000-000000000002',
                'f5000000-0000-4000-8000-000000000003')
   AND u.id = (SELECT id FROM auth.users WHERE email = 'staff1@aozora.test')
ON CONFLICT (target_type, target_id, approver_id) DO NOTHING;

UPDATE sponsorship_requests r
   SET status = 'open',
       decided_at = a.created_at,
       checked_by_name = a.approver_name,
       checked_seal_text = a.seal_text,
       checked_seal_shape = a.seal_shape
  FROM approvals a
 WHERE a.target_type = 'sponsorship'
   AND a.target_id = r.id
   AND r.status = 'pending';


-- -----------------------------------------------------------------------------
-- 3. 企業の申し込み
-- -----------------------------------------------------------------------------
-- 軽音楽部に、成立した1件と、返事待ちの1件。学生1は軽音楽部の管理者なので、
-- 学生として入ると、返事待ちの申し込みに答えるところを見せられる。

INSERT INTO sponsorship_offers
  (id, request_id, sponsor_id, sponsor_name, sponsor_url, amount, message,
   status, created_at, decided_at)
VALUES
  ('f6000000-0000-4000-8000-000000000001',
   'f5000000-0000-4000-8000-000000000001',
   (SELECT id FROM auth.users WHERE email = 'general1@example.test'),
   '株式会社サンプルテック（架空）', NULL, 30000,
   '地域の音楽活動を応援しています。演奏会、楽しみにしています。',
   'accepted', now() - interval '8 days', now() - interval '7 days'),
  ('f6000000-0000-4000-8000-000000000002',
   'f5000000-0000-4000-8000-000000000001',
   (SELECT id FROM auth.users WHERE email = 'general2@example.test'),
   'あおば印刷株式会社（架空）', NULL, 20000,
   'パンフレットの印刷も、あわせてお手伝いできます。',
   'pending', now() - interval '1 day', NULL)
ON CONFLICT (id) DO NOTHING;


-- -----------------------------------------------------------------------------
-- 確認
-- -----------------------------------------------------------------------------

SELECT
  (SELECT count(*) FROM sponsorship_requests WHERE status = 'open')    AS 募集中,
  (SELECT count(*) FROM sponsorship_requests WHERE status = 'pending') AS 確認待ち,
  (SELECT count(*) FROM sponsorship_offers WHERE status = 'accepted')  AS 成立,
  (SELECT count(*) FROM sponsorship_offers WHERE status = 'pending')   AS 返事待ち,
  (SELECT bool_and(ok) FROM (
     SELECT (public.verify_approval_chain('sponsorship', id)).ok
       FROM sponsorship_requests WHERE status = 'open') v) AS 判子の記録は崩れていない;
