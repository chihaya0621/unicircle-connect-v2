-- =============================================================================
-- 公開デモを、保存した状態に戻す（0035）
-- =============================================================================
-- 来場者が足したもの・書き換えたものが消え、保存したときのデータは残ること。
-- あとから登録した人のアカウントは消えないこと。承認の記録の連なりが
-- 崩れないこと。画面からは呼べないこと。
-- ここまでのテストで積み上がった状態を、そのまま「元の状態」として保存する。
-- =============================================================================

SELECT test.section('保存が無いうちは、何もしない');

RESET ROLE;
SELECT test.eq(public.demo_reset(), 'skipped: 保存がありません', '保存が無ければ何もしない');

-- 保存より前に、判子を1つ押しておく（戻したあとも、記録の連なりが崩れないか）。
-- 2人目は保存のあとで押すので、成立に2人要るようにしておく
UPDATE universities SET required_circle_approvals = 2
 WHERE id = 'a1111111-0000-4000-8000-000000000001';
INSERT INTO circles (id, university_id, name, description, status, scope)
VALUES ('cc111111-0000-4000-8000-0000000000e1',
        'a1111111-0000-4000-8000-000000000001', '戻しても判子が残る部', '検証用', 'pending', 'university');
SELECT test.as('staff-a@t.test');  SET ROLE authenticated;
SELECT public.decide_circle('cc111111-0000-4000-8000-0000000000e1', true, '保存の前に押した');
RESET ROLE;

-- 保存より前に、リマインドを1件予約しておく（送ったあとで戻したときに、送り直さないか）
INSERT INTO event_reminders (user_id, event_id, lead_minutes)
VALUES (test.uid('member@t.test'), 'ee111111-0000-4000-8000-000000000001', 60)
ON CONFLICT DO NOTHING;


SELECT test.section('保存する');

SELECT test.ok(public.demo_snapshot() LIKE '%行を保存しました%', '保存できる');

SELECT test.eq(
  (SELECT count(*) FROM pg_tables
    WHERE schemaname = 'public'
      AND NOT (tablename = ANY (public.demo_content_tables() || public.demo_account_tables()))),
  0::bigint,
  'public の表は、すべて戻す対象に入っている（表を足したら 0035 にも足す）');


SELECT test.section('来場者が触ったあとで戻す');

-- 来場者のしわざ
INSERT INTO circles (id, university_id, name, description, status, scope)
VALUES ('cc111111-0000-4000-8000-0000000000ff',
        'a1111111-0000-4000-8000-000000000001', 'いたずらの部', '来場者が足した', 'pending', 'university');
UPDATE users SET name = 'らくがき' WHERE id = test.uid('staff-a@t.test');
UPDATE staff_profiles SET seal_text = '落書' WHERE user_id = test.uid('staff-a@t.test');
UPDATE universities SET required_circle_approvals = 5
 WHERE id = 'a1111111-0000-4000-8000-000000000001';
DELETE FROM circle_posts WHERE circle_id = 'cc111111-0000-4000-8000-000000000001';
UPDATE event_reminders SET notified_at = now()
 WHERE user_id = test.uid('member@t.test')
   AND event_id = 'ee111111-0000-4000-8000-000000000001';

-- 保存したあとで、もう1人が押す
SELECT test.as('staff-a2@t.test');  SET ROLE authenticated;
SELECT public.decide_circle('cc111111-0000-4000-8000-0000000000e1', true, '保存のあとで押した');
RESET ROLE;

-- 保存したあとで登録した来場者と、その人の「気になる」
INSERT INTO auth.users (email, raw_user_meta_data)
VALUES ('visitor@t.test', '{"name":"来場者"}');
INSERT INTO circle_favorites (user_id, circle_id)
VALUES (test.uid('visitor@t.test'), 'cc111111-0000-4000-8000-000000000001');

SELECT test.ok(public.demo_reset() LIKE '%保存した状態に戻しました', '戻せる');

SELECT test.eq(
  (SELECT count(*) FROM circles WHERE name = 'いたずらの部'), 0::bigint,
  '来場者が足したサークルは消える');

SELECT test.eq(
  (SELECT count(*) FROM circles), (SELECT count(*) FROM demo_seed.circles),
  '保存したときのサークルは、すべて残る');

SELECT test.eq(
  (SELECT count(*) FROM circle_posts), (SELECT count(*) FROM demo_seed.circle_posts),
  '消された掲示は戻る');

SELECT test.eq(
  (SELECT name FROM users WHERE id = test.uid('staff-a@t.test')), '甲大職員',
  '書き換えられた名前は戻る');

SELECT test.eq(
  (SELECT seal_text FROM staff_profiles WHERE user_id = test.uid('staff-a@t.test')),
  (SELECT seal_text FROM demo_seed.staff_profiles WHERE user_id = test.uid('staff-a@t.test')),
  '彫り直された印影は戻る');

SELECT test.eq(
  (SELECT required_circle_approvals FROM universities
    WHERE id = 'a1111111-0000-4000-8000-000000000001'),
  (SELECT required_circle_approvals FROM demo_seed.universities
    WHERE id = 'a1111111-0000-4000-8000-000000000001'),
  '承認に要る人数は戻る');

SELECT test.eq(
  (SELECT count(*) FROM users WHERE id = test.uid('visitor@t.test')), 1::bigint,
  'あとから登録した人のアカウントは消えない');

SELECT test.eq(
  (SELECT count(*) FROM circle_favorites WHERE user_id = test.uid('visitor@t.test')), 0::bigint,
  'あとから登録した人が付けた印は消える');

SELECT test.ok(
  (SELECT notified_at IS NOT NULL FROM event_reminders
    WHERE user_id = test.uid('member@t.test')
      AND event_id = 'ee111111-0000-4000-8000-000000000001'),
  '送ったリマインドは、送ったままにする（送り直さない）');

SELECT test.eq(
  (SELECT count(*) FROM notifications), (SELECT count(*) FROM demo_seed.notifications),
  '戻すあいだに通知は作られない');

SELECT test.eq(
  (SELECT count(*) FROM approvals WHERE target_id = 'cc111111-0000-4000-8000-0000000000e1'),
  1::bigint,
  '保存のあとで押した判子は消え、前に押した判子は残る');

SELECT test.ok(
  (SELECT ok FROM public.verify_approval_chain('circle', 'cc111111-0000-4000-8000-0000000000e1')),
  '残った判子の記録は、押されたときのまま');

SELECT test.ok(
  (SELECT coalesce(bool_and(ok), true) FROM (
     SELECT (public.verify_approval_chain(target_type, target_id)).ok
       FROM (SELECT DISTINCT target_type, target_id FROM approvals
              WHERE target_type <> 'reservation') x) v),
  'ほかの承認の記録も、連なりは崩れない');

SELECT test.eq(
  current_setting('session_replication_role'), 'origin',
  '戻したあと、トリガーは動く状態に戻っている');


SELECT test.section('画面からは呼べない');

SELECT test.ok(
  NOT has_function_privilege('anon', 'public.demo_reset()', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.demo_reset()', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.demo_snapshot()', 'EXECUTE'),
  '未ログインもログインした人も、戻す・保存するを呼べない');

RESET ROLE;  SELECT test.as('staff-a@t.test');  SET ROLE authenticated;
SELECT test.raises($$SELECT public.demo_reset()$$, '職員でも、戻すことはできない');

RESET ROLE;
