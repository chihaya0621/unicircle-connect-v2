-- =============================================================================
-- 代替わり（引き継ぎ）
-- =============================================================================
-- 芯は「断れること」。役職の変更は管理者が一方的にできるが、
-- 代表を押し付けられては困るので、相手の承諾で初めて成立させる。
-- =============================================================================

SELECT test.section('申し出を出せる人・出せない人');

-- 部員（管理者ではない）は申し出を出せない
RESET ROLE;  SELECT test.as('member@t.test');  SET ROLE authenticated;
SELECT test.raises(
  $$SELECT public.request_handover('cc111111-0000-4000-8000-000000000001',
      test.uid('outsider@t.test'), NULL)$$,
  '管理者でない人は引き継ぎを申し出られない');

RESET ROLE;  SELECT test.as('admin@t.test');  SET ROLE authenticated;

SELECT test.raises(
  $$SELECT public.request_handover('cc111111-0000-4000-8000-000000000001',
      test.uid('admin@t.test'), NULL)$$,
  '自分自身には引き継げない');

-- 在籍していない人を代表に据えられると、名簿に載っていない人が
-- サークルを握ることになる
SELECT test.raises(
  $$SELECT public.request_handover('cc111111-0000-4000-8000-000000000001',
      test.uid('outsider@t.test'), NULL)$$,
  '在籍していない人には引き継げない');


SELECT test.section('申し出を出す');

SELECT public.request_handover(
  'cc111111-0000-4000-8000-000000000001',
  test.uid('member@t.test'),
  '鍵は部室の棚。顧問の連絡先は名簿の最後に書いてあります。');

SELECT test.eq(
  (SELECT status FROM circle_handovers
    WHERE circle_id = 'cc111111-0000-4000-8000-000000000001'),
  'pending', '申し出が残る');

SELECT test.eq(
  (SELECT to_name FROM circle_handovers
    WHERE circle_id = 'cc111111-0000-4000-8000-000000000001'),
  '部員', '継ぐ相手の氏名が記録される');

SELECT test.raises(
  $$SELECT public.request_handover('cc111111-0000-4000-8000-000000000001',
      test.uid('member@t.test'), NULL)$$,
  '申し出は同時に1件まで');

-- 指名された本人に通知が届く。
-- 通知は本人しか読めないので、本人として数える（申し出た側からは見えない）
RESET ROLE;  SELECT test.as('member@t.test');  SET ROLE authenticated;
SELECT test.count_is(
  $$SELECT * FROM notifications WHERE type = 'request_received'$$,
  1, '指名された人に通知が届く');
RESET ROLE;  SELECT test.as('admin@t.test');  SET ROLE authenticated;


SELECT test.section('答えられるのは指名された本人だけ');

RESET ROLE;  SELECT test.as('outsider@t.test');  SET ROLE authenticated;
SELECT test.raises(
  $$SELECT public.respond_handover(
      test.pending_handover('cc111111-0000-4000-8000-000000000001'), true)$$,
  '関係のない人は答えられない');

RESET ROLE;  SELECT test.as('admin@t.test');  SET ROLE authenticated;
SELECT test.raises(
  $$SELECT public.respond_handover(
      test.pending_handover('cc111111-0000-4000-8000-000000000001'), true)$$,
  '申し出た側が勝手に成立させられない');


SELECT test.section('断る');

RESET ROLE;  SELECT test.as('member@t.test');  SET ROLE authenticated;
SELECT test.eq(
  public.respond_handover(
    test.pending_handover('cc111111-0000-4000-8000-000000000001'), false),
  'declined', '指名された人は断れる');

SELECT test.eq(
  (SELECT role FROM circle_members
    WHERE circle_id = 'cc111111-0000-4000-8000-000000000001'
      AND user_id = test.uid('member@t.test')),
  'member', '断れば役職は変わらない');

SELECT test.eq(
  (SELECT role FROM circle_members
    WHERE circle_id = 'cc111111-0000-4000-8000-000000000001'
      AND user_id = test.uid('admin@t.test')),
  'admin', '断られた側も管理者のまま');


SELECT test.section('受ける');

RESET ROLE;  SELECT test.as('admin@t.test');  SET ROLE authenticated;
SELECT public.request_handover(
  'cc111111-0000-4000-8000-000000000001',
  test.uid('member@t.test'),
  '今度こそお願いします');

RESET ROLE;  SELECT test.as('member@t.test');  SET ROLE authenticated;
SELECT test.eq(
  public.respond_handover(
    test.pending_handover('cc111111-0000-4000-8000-000000000001'), true),
  'accepted', '受けると成立する');

SELECT test.eq(
  (SELECT role FROM circle_members
    WHERE circle_id = 'cc111111-0000-4000-8000-000000000001'
      AND user_id = test.uid('member@t.test')),
  'admin', '継いだ人が管理者になる');

-- 譲った人は退会させない。代表を降りたあとも在籍し続けるのが普通
SELECT test.eq(
  (SELECT role FROM circle_members
    WHERE circle_id = 'cc111111-0000-4000-8000-000000000001'
      AND user_id = test.uid('admin@t.test')),
  'member', '譲った人は一般のメンバーに降りる');

SELECT test.eq(
  (SELECT status FROM circle_members
    WHERE circle_id = 'cc111111-0000-4000-8000-000000000001'
      AND user_id = test.uid('admin@t.test')),
  'active', '譲った人は在籍したまま');

SELECT test.eq(
  (SELECT term_year FROM circles WHERE id = 'cc111111-0000-4000-8000-000000000001'),
  public.app_term_year(), 'サークルの年度が更新される');

-- 申し送りは残り続ける。次の代が最初に読む場所
SELECT test.eq(
  (SELECT note FROM circle_handovers
    WHERE circle_id = 'cc111111-0000-4000-8000-000000000001'
      AND status = 'declined'),
  '鍵は部室の棚。顧問の連絡先は名簿の最後に書いてあります。',
  '断られた申し出の申し送りも消えない');


SELECT test.section('代替わりしたあと、前の代表は抜けられる');

-- 管理者が新代表に移っているので、「最後の管理者は抜けられない」に
-- 引っかからない。これが引き継ぎと単なる退会の違い。
RESET ROLE;  SELECT test.as('admin@t.test');  SET ROLE authenticated;
SELECT public.leave_circle('cc111111-0000-4000-8000-000000000001');
SELECT test.count_is(
  $$SELECT * FROM circle_members
     WHERE circle_id = 'cc111111-0000-4000-8000-000000000001'
       AND user_id = test.uid('admin@t.test')$$,
  0, '代を譲ったあとなら退会できる');


SELECT test.section('年度の数えかた');

RESET ROLE;
SELECT test.eq(public.app_term_year('2026-04-01 09:00+09'::timestamptz), 2026,
  '4月1日は新しい年度');
SELECT test.eq(public.app_term_year('2026-03-31 09:00+09'::timestamptz), 2025,
  '3月31日はまだ前の年度');
SELECT test.eq(public.app_term_year('2026-12-31 09:00+09'::timestamptz), 2026,
  '年をまたぐ前は同じ年度');

RESET ROLE;
