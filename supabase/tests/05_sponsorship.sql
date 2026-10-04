-- =============================================================================
-- サークル協賛（0036）
-- =============================================================================
-- 募集は、大学の職員が確かめてから外に出ること。申し込みの金額は、
-- 当事者（申し込んだ企業・サークルの管理者・大学の職員）にしか見えないこと。
-- 外に出るのは、成立した企業の名前だけであること。
-- =============================================================================

-- 代替わりのテスト（03）で、テスト部の代表は部員に移り、部長は退会している。
-- 名前どおりの役職（admin が管理者、member が部員）に戻してから始める
RESET ROLE;
INSERT INTO circle_members (circle_id, user_id, role, status)
VALUES ('cc111111-0000-4000-8000-000000000001', test.uid('admin@t.test'), 'admin', 'active')
ON CONFLICT (circle_id, user_id) DO UPDATE SET role = 'admin', status = 'active';
UPDATE circle_members SET role = 'member'
 WHERE circle_id = 'cc111111-0000-4000-8000-000000000001'
   AND user_id = test.uid('member@t.test');


SELECT test.section('募集を出せる人・出せない人');

RESET ROLE;  SELECT test.as('member@t.test');  SET ROLE authenticated;
SELECT test.raises(
  $$SELECT public.request_sponsorship('cc111111-0000-4000-8000-000000000001',
      '部員が出す募集', '使い道', 50000, NULL,
      (now() AT TIME ZONE 'Asia/Tokyo')::date + 30)$$,
  '管理者でない部員は、募集を出せない');

RESET ROLE;  SELECT test.as('admin@t.test');  SET ROLE authenticated;
SELECT test.raises(
  $$SELECT public.request_sponsorship('cc111111-0000-4000-8000-000000000001',
      '過去の締め切り', '使い道', 50000, NULL,
      (now() AT TIME ZONE 'Asia/Tokyo')::date - 1)$$,
  '締め切りが過去の日付では出せない');

SELECT test.raises(
  $$SELECT public.request_sponsorship('cc111111-0000-4000-8000-000000000001',
      '少なすぎる目標額', '使い道', 500, NULL,
      (now() AT TIME ZONE 'Asia/Tokyo')::date + 30)$$,
  '目標額は1000円から');


SELECT test.section('募集を出す');

SELECT public.request_sponsorship(
  'cc111111-0000-4000-8000-000000000001',
  '全国大会の遠征費',
  '8月の全国大会に出る部員の交通費と宿泊費に使います。',
  100000,
  '大会の配布物に、協賛企業のロゴを載せます。',
  (now() AT TIME ZONE 'Asia/Tokyo')::date + 30);

SELECT test.eq(
  (SELECT status FROM sponsorship_requests WHERE title = '全国大会の遠征費'),
  'pending', '出した募集は、大学の確認待ちになる');

RESET ROLE;
SELECT test.ok(
  EXISTS (SELECT 1 FROM notifications
           WHERE user_id = test.uid('staff-a@t.test')
             AND title = '協賛の募集の確認が届きました'),
  'その大学の職員に、確認の依頼が届く');
SELECT test.ok(
  NOT EXISTS (SELECT 1 FROM notifications
               WHERE user_id = test.uid('staff-b@t.test')
                 AND title = '協賛の募集の確認が届きました'),
  'ほかの大学の職員には届かない');


SELECT test.section('確認待ちの募集は、外から見えない');

-- 外から見えるかを確かめるため、テスト部を公開設定にしておく
UPDATE circles SET public_listed = true
 WHERE id = 'cc111111-0000-4000-8000-000000000001';

SELECT test.as('general@t.test');  SET ROLE authenticated;
SELECT test.count_is(
  $$SELECT 1 FROM sponsorship_requests WHERE title = '全国大会の遠征費'$$, 0,
  '確認待ちの募集は、企業には見えない');

RESET ROLE;  SELECT test.as_anon();  SET ROLE anon;
SELECT test.count_is(
  $$SELECT 1 FROM sponsorship_requests WHERE title = '全国大会の遠征費'$$, 0,
  '未ログインにも見えない');

RESET ROLE;  SELECT test.as('member@t.test');  SET ROLE authenticated;
SELECT test.count_is(
  $$SELECT 1 FROM sponsorship_requests WHERE title = '全国大会の遠征費'$$, 1,
  'サークルの部員には見える');


SELECT test.section('大学の職員が確かめる');

RESET ROLE;  SELECT test.as('staff-b@t.test');  SET ROLE authenticated;
SELECT test.raises(
  $$SELECT public.decide_sponsorship(test.sponsorship('全国大会の遠征費'), true, NULL)$$,
  'ほかの大学の職員は確かめられない');

RESET ROLE;  SELECT test.as('admin@t.test');  SET ROLE authenticated;
SELECT test.raises(
  $$SELECT public.decide_sponsorship(test.sponsorship('全国大会の遠征費'), true, NULL)$$,
  '学生は確かめられない');

RESET ROLE;  SELECT test.as('staff-a@t.test');  SET ROLE authenticated;
SELECT test.eq(
  public.decide_sponsorship(test.sponsorship('全国大会の遠征費'), true, '内容を確認しました'),
  'open', '職員1人の判子で公開される');

SELECT test.raises(
  $$SELECT public.decide_sponsorship(test.sponsorship('全国大会の遠征費'), false, NULL)$$,
  '確認が済んだ募集は、もう一度は決められない');

RESET ROLE;
SELECT test.eq(
  (SELECT checked_by_name FROM sponsorship_requests WHERE title = '全国大会の遠征費'),
  '甲大職員', '確かめた職員の名前が、募集に写る');
SELECT test.eq(
  (SELECT checked_seal_text FROM sponsorship_requests WHERE title = '全国大会の遠征費'),
  (SELECT seal_text FROM staff_profiles WHERE user_id = test.uid('staff-a@t.test')),
  '押した職員の印影が、募集に写る');
SELECT test.eq(
  (SELECT count(*) FROM approvals
    WHERE target_type = 'sponsorship'
      AND target_id = test.sponsorship('全国大会の遠征費')),
  1::bigint, '判子は承認の記録にも残る');
SELECT test.ok(
  (SELECT ok FROM public.verify_approval_chain('sponsorship', test.sponsorship('全国大会の遠征費'))),
  '協賛の判子も、記録の連なりで検証できる');
SELECT test.ok(
  EXISTS (SELECT 1 FROM notifications
           WHERE user_id = test.uid('admin@t.test')
             AND title = '協賛の募集「全国大会の遠征費」が公開されました'),
  'サークルの管理者に、公開されたことが届く');

SELECT test.as('member@t.test');  SET ROLE authenticated;
SELECT test.count_is(
  $$SELECT 1 FROM approvals WHERE target_type = 'sponsorship'$$, 1,
  '部員は、自分のサークルの協賛の記録を読める');

RESET ROLE;  SELECT test.as('staff-b@t.test');  SET ROLE authenticated;
SELECT test.count_is(
  $$SELECT 1 FROM approvals WHERE target_type = 'sponsorship'$$, 1,
  '公開された募集の記録は、募集が見える人なら読める');


SELECT test.section('公開された募集は、サークルが見える人に見える');

RESET ROLE;  SELECT test.as('general@t.test');  SET ROLE authenticated;
SELECT test.count_is(
  $$SELECT 1 FROM sponsorship_requests WHERE title = '全国大会の遠征費'$$, 1,
  '公開設定のサークルの募集は、企業に見える');

RESET ROLE;  SELECT test.as_anon();  SET ROLE anon;
SELECT test.count_is(
  $$SELECT 1 FROM sponsorship_requests WHERE title = '全国大会の遠征費'$$, 1,
  '未ログインにも見える');

RESET ROLE;
UPDATE circles SET public_listed = false
 WHERE id = 'cc111111-0000-4000-8000-000000000001';

SELECT test.as('general@t.test');  SET ROLE authenticated;
SELECT test.count_is(
  $$SELECT 1 FROM sponsorship_requests WHERE title = '全国大会の遠征費'$$, 0,
  '非公開のサークルの募集は、企業には見えない');
SELECT test.raises(
  $$SELECT public.offer_sponsorship(test.sponsorship('全国大会の遠征費'),
      '株式会社テスト', NULL, 30000, NULL)$$,
  '非公開のサークルの募集には、申し込めない');

RESET ROLE;  SELECT test.as('outsider@t.test');  SET ROLE authenticated;
SELECT test.count_is(
  $$SELECT 1 FROM sponsorship_requests WHERE title = '全国大会の遠征費'$$, 1,
  '学生には、非公開でも承認済みのサークルの募集が見える');

RESET ROLE;
UPDATE circles SET public_listed = true
 WHERE id = 'cc111111-0000-4000-8000-000000000001';


SELECT test.section('企業が申し込む');

SELECT test.as('outsider@t.test');  SET ROLE authenticated;
SELECT test.raises(
  $$SELECT public.offer_sponsorship(test.sponsorship('全国大会の遠征費'),
      '学生の会社', NULL, 30000, NULL)$$,
  '学生は申し込めない');

RESET ROLE;  SELECT test.as('staff-a@t.test');  SET ROLE authenticated;
SELECT test.raises(
  $$SELECT public.offer_sponsorship(test.sponsorship('全国大会の遠征費'),
      '職員の会社', NULL, 30000, NULL)$$,
  '職員は申し込めない');

RESET ROLE;  SELECT test.as('general@t.test');  SET ROLE authenticated;
SELECT test.raises(
  $$SELECT public.offer_sponsorship(test.sponsorship('全国大会の遠征費'),
      '株式会社テスト', 'javascript:alert(1)', 30000, NULL)$$,
  'Web サイトは http か https の URL だけ');
SELECT test.raises(
  $$SELECT public.offer_sponsorship(test.sponsorship('全国大会の遠征費'),
      '株式会社テスト', NULL, 500, NULL)$$,
  '金額は1000円から');

SELECT test.ok(
  public.offer_sponsorship(test.sponsorship('全国大会の遠征費'),
    '株式会社テスト', 'https://example.com', 30000,
    '学生の挑戦を応援しています。') IS NOT NULL,
  '企業は、公開された募集に申し込める');

SELECT test.raises(
  $$SELECT public.offer_sponsorship(test.sponsorship('全国大会の遠征費'),
      '株式会社テスト', NULL, 20000, NULL)$$,
  '返事待ちの申し込みがあるうちは、同じ募集に重ねて申し込めない');

RESET ROLE;
SELECT test.ok(
  EXISTS (SELECT 1 FROM notifications
           WHERE user_id = test.uid('admin@t.test')
             AND title = 'テスト部 に協賛の申し込みが届きました'),
  'サークルの管理者に、申し込みが届く');


SELECT test.section('申し込みの中身は、当事者だけが読める');

SELECT test.as('general@t.test');  SET ROLE authenticated;
SELECT test.count_is($$SELECT 1 FROM sponsorship_offers$$, 1,
  '申し込んだ本人は読める');

RESET ROLE;  SELECT test.as('admin@t.test');  SET ROLE authenticated;
SELECT test.count_is($$SELECT 1 FROM sponsorship_offers$$, 1,
  'サークルの管理者は読める');

RESET ROLE;  SELECT test.as('staff-a@t.test');  SET ROLE authenticated;
SELECT test.count_is($$SELECT 1 FROM sponsorship_offers$$, 1,
  'その大学の職員は読める');

RESET ROLE;  SELECT test.as('member@t.test');  SET ROLE authenticated;
SELECT test.count_is($$SELECT 1 FROM sponsorship_offers$$, 0,
  '管理者でない部員は読めない');

RESET ROLE;  SELECT test.as('staff-b@t.test');  SET ROLE authenticated;
SELECT test.count_is($$SELECT 1 FROM sponsorship_offers$$, 0,
  'ほかの大学の職員は読めない');

-- 本番では anon の読み取り権限そのものを外している（0036）。
-- 検証用の DB は全部の表に読み取りを配るので、行が見えないことで確かめる
RESET ROLE;  SELECT test.as_anon();  SET ROLE anon;
SELECT test.count_is($$SELECT 1 FROM sponsorship_offers$$, 0,
  '未ログインには1件も見えない');


SELECT test.section('サークルが申し込みに答える');

RESET ROLE;  SELECT test.as('member@t.test');  SET ROLE authenticated;
SELECT test.raises(
  $$SELECT public.respond_sponsorship_offer(test.pending_offer('全国大会の遠征費'), true)$$,
  '管理者でない部員は答えられない');

RESET ROLE;  SELECT test.as('general@t.test');  SET ROLE authenticated;
SELECT test.raises(
  $$SELECT public.respond_sponsorship_offer(test.pending_offer('全国大会の遠征費'), true)$$,
  '申し込んだ企業は、自分で成立にはできない');

RESET ROLE;  SELECT test.as('admin@t.test');  SET ROLE authenticated;
SELECT test.eq(
  public.respond_sponsorship_offer(test.pending_offer('全国大会の遠征費'), true),
  'accepted', 'サークルの管理者が受けると成立する');

RESET ROLE;
SELECT test.ok(
  EXISTS (SELECT 1 FROM notifications
           WHERE user_id = test.uid('general@t.test')
             AND title = 'テスト部 への協賛が成立しました'),
  '申し込んだ企業に、成立が届く');

SELECT test.as_anon();  SET ROLE anon;
SELECT test.eq(
  (SELECT sponsor_name FROM public.list_circle_sponsors('cc111111-0000-4000-8000-000000000001')),
  '株式会社テスト', '成立した企業の名前は、未ログインでも見える');

RESET ROLE;
UPDATE circles SET public_listed = false
 WHERE id = 'cc111111-0000-4000-8000-000000000001';
SELECT test.as_anon();  SET ROLE anon;
SELECT test.count_is(
  $$SELECT 1 FROM public.list_circle_sponsors('cc111111-0000-4000-8000-000000000001')$$, 0,
  '非公開のサークルの協賛企業は、外に出ない');
RESET ROLE;
UPDATE circles SET public_listed = true
 WHERE id = 'cc111111-0000-4000-8000-000000000001';


SELECT test.section('取り下げと締め切り');

SELECT test.as('general@t.test');  SET ROLE authenticated;
SELECT public.offer_sponsorship(test.sponsorship('全国大会の遠征費'),
  '株式会社テスト', NULL, 10000, '追加で応援します');

RESET ROLE;  SELECT test.as('member@t.test');  SET ROLE authenticated;
SELECT test.raises(
  $$SELECT public.withdraw_sponsorship_offer(test.pending_offer('全国大会の遠征費'))$$,
  '申し込んだ本人でなければ取り下げられない');

RESET ROLE;  SELECT test.as('general@t.test');  SET ROLE authenticated;
SELECT public.withdraw_sponsorship_offer(test.pending_offer('全国大会の遠征費'));
SELECT test.eq(
  (SELECT count(*) FROM sponsorship_offers WHERE status = 'withdrawn'),
  1::bigint, '申し込んだ本人は取り下げられる');

RESET ROLE;  SELECT test.as('member@t.test');  SET ROLE authenticated;
SELECT test.raises(
  $$SELECT public.close_sponsorship(test.sponsorship('全国大会の遠征費'))$$,
  '管理者でない部員は締め切れない');

RESET ROLE;  SELECT test.as('admin@t.test');  SET ROLE authenticated;
SELECT public.close_sponsorship(test.sponsorship('全国大会の遠征費'));
SELECT test.eq(
  (SELECT status FROM sponsorship_requests WHERE title = '全国大会の遠征費'),
  'closed', '管理者は締め切れる');

RESET ROLE;  SELECT test.as('general@t.test');  SET ROLE authenticated;
SELECT test.raises(
  $$SELECT public.offer_sponsorship(test.sponsorship('全国大会の遠征費'),
      '株式会社テスト', NULL, 10000, NULL)$$,
  '締め切った募集には申し込めない');
SELECT test.count_is(
  $$SELECT 1 FROM sponsorship_requests WHERE title = '全国大会の遠征費'$$, 1,
  '締め切った募集も、外から読める（協賛の実績として）');


SELECT test.section('締め切り日を過ぎた募集');

RESET ROLE;  SELECT test.as('admin@t.test');  SET ROLE authenticated;
SELECT public.request_sponsorship(
  'cc111111-0000-4000-8000-000000000001',
  '定期演奏会のホール代', '12月の定期演奏会の会場費に使います。', 80000, NULL,
  (now() AT TIME ZONE 'Asia/Tokyo')::date + 10);

RESET ROLE;  SELECT test.as('staff-a@t.test');  SET ROLE authenticated;
SELECT public.decide_sponsorship(test.sponsorship('定期演奏会のホール代'), true, NULL);

RESET ROLE;
UPDATE sponsorship_requests
   SET deadline = (now() AT TIME ZONE 'Asia/Tokyo')::date - 1
 WHERE title = '定期演奏会のホール代';

SELECT test.as('general@t.test');  SET ROLE authenticated;
SELECT test.raises(
  $$SELECT public.offer_sponsorship(test.sponsorship('定期演奏会のホール代'),
      '株式会社テスト', NULL, 10000, NULL)$$,
  '締め切り日を過ぎた募集には申し込めない');


SELECT test.section('同時に出せるのは3件まで');

RESET ROLE;  SELECT test.as('admin@t.test');  SET ROLE authenticated;
SELECT public.request_sponsorship('cc111111-0000-4000-8000-000000000001',
  '2件目', '使い道', NULL, NULL, (now() AT TIME ZONE 'Asia/Tokyo')::date + 30);
SELECT public.request_sponsorship('cc111111-0000-4000-8000-000000000001',
  '3件目', '使い道', NULL, NULL, (now() AT TIME ZONE 'Asia/Tokyo')::date + 30);
SELECT test.raises(
  $$SELECT public.request_sponsorship('cc111111-0000-4000-8000-000000000001',
      '4件目', '使い道', NULL, NULL, (now() AT TIME ZONE 'Asia/Tokyo')::date + 30)$$,
  '確認待ちと募集中は、あわせて3件まで');


SELECT test.section('画面から呼べるのは、ログインした人だけ');

RESET ROLE;
SELECT test.ok(
  NOT has_function_privilege('anon', 'public.request_sponsorship(uuid,text,text,integer,text,date)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.decide_sponsorship(uuid,boolean,text)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.offer_sponsorship(uuid,text,text,integer,text)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.respond_sponsorship_offer(uuid,boolean)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.withdraw_sponsorship_offer(uuid)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.close_sponsorship(uuid)', 'EXECUTE'),
  '未ログインは、募集・確認・申し込み・返事・取り下げ・締め切りを呼べない');
SELECT test.ok(
  has_function_privilege('anon', 'public.list_circle_sponsors(uuid)', 'EXECUTE'),
  '協賛企業の名前は、未ログインでも引ける');

SELECT test.ok(
  'sponsorship_requests' = ANY (public.demo_content_tables())
  AND 'sponsorship_offers' = ANY (public.demo_content_tables()),
  '毎晩デモを戻す対象に、協賛の表が入っている');

RESET ROLE;
