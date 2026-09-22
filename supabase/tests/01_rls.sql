-- =============================================================================
-- 可視範囲と、書き込みの経路
-- =============================================================================
-- README に「読み取りは SELECT ポリシーで可視範囲を表現し、書き込みは RPC が
-- 唯一の経路」と書いている。その2つが本当にそうなっているかを確かめる。
--
-- 確かめたいのは「見えること」ではなく「見えないこと」のほう。
-- 見えることはアプリを開けば分かるが、見えないことは誰かが試さない限り
-- 誰も気づかない。ポリシーを1行消したときに、ここが落ちてほしい。
-- =============================================================================

SELECT test.section('未ログイン（匿名キーで直接叩かれている状態）');

RESET ROLE;  SELECT test.as_anon();  SET ROLE anon;

-- 大学とキャンパスは開ける。未ログインの大学一覧に要る
SELECT test.ok(
  (SELECT count(*) FROM universities) >= 2,
  '未ログインでも大学の一覧は読める');

-- 部内の連絡は、外に一切出さない
SELECT test.count_is(
  'SELECT * FROM circle_posts',
  0, '未ログインからサークルの掲示は1件も読めない');

-- 公開設定にしていないサークルは出さない
SELECT test.count_is(
  $$SELECT * FROM circles WHERE id = 'cc111111-0000-4000-8000-000000000001'$$,
  0, '未ログインから非公開のサークルは読めない');

-- イベントは「公開かつ学外に出す」ものだけ
SELECT test.count_is(
  $$SELECT * FROM events WHERE id = 'ee111111-0000-4000-8000-000000000001'$$,
  1, '未ログインでも学外向けのイベントは読める');
SELECT test.count_is(
  $$SELECT * FROM events WHERE id = 'ee111111-0000-4000-8000-000000000002'$$,
  0, '未ログインから学外に出さないイベントは読めない');
SELECT test.count_is(
  $$SELECT * FROM events WHERE id = 'ee111111-0000-4000-8000-000000000003'$$,
  0, '未ログインから学内限定のイベントは読めない');

-- 氏名は伏せる
SELECT test.count_is('SELECT * FROM users', 0, '未ログインから利用者の一覧は読めない');
SELECT test.count_is('SELECT * FROM student_profiles', 0, '未ログインから学生の情報は読めない');
SELECT test.count_is('SELECT * FROM facility_reservations', 0, '未ログインから予約は読めない');
SELECT test.count_is('SELECT * FROM approvals', 0, '未ログインから承認の記録は読めない');


SELECT test.section('部外の学生から見えてはいけないもの');

RESET ROLE;  SELECT test.as('outsider@t.test');  SET ROLE authenticated;

SELECT test.count_is(
  'SELECT * FROM circle_posts',
  0, '入っていないサークルの掲示は読めない');

SELECT test.count_is(
  $$SELECT * FROM facility_reservations WHERE id = 'dd111111-0000-4000-8000-000000000001'$$,
  0, '他人の予約は読めない');

-- 同じ大学でも、サークルを共有していなければプロフィールは見えない
SELECT test.count_is(
  $$SELECT * FROM student_profiles WHERE user_id = test.uid('member@t.test')$$,
  0, 'サークルを共有していない学生のプロフィールは読めない');

SELECT test.count_is(
  $$SELECT * FROM student_profiles WHERE user_id = test.uid('outsider@t.test')$$,
  1, '自分のプロフィールは読める');


SELECT test.section('部員から見えるもの');

RESET ROLE;  SELECT test.as('member@t.test');  SET ROLE authenticated;

SELECT test.count_is(
  'SELECT * FROM circle_posts', 1, '入っているサークルの掲示は読める');
SELECT test.count_is(
  $$SELECT * FROM student_profiles WHERE user_id = test.uid('admin@t.test')$$,
  1, '同じサークルの仲間のプロフィールは読める');


SELECT test.section('職員は、自分の大学のぶんだけ');

RESET ROLE;  SELECT test.as('staff-a@t.test');  SET ROLE authenticated;
SELECT test.count_is(
  $$SELECT * FROM student_profiles WHERE user_id = test.uid('outsider@t.test')$$,
  1, '自分の大学の学生の情報は読める');
SELECT test.count_is(
  $$SELECT * FROM facility_reservations WHERE id = 'dd111111-0000-4000-8000-000000000001'$$,
  1, '自分の大学の施設の予約は読める');

RESET ROLE;  SELECT test.as('staff-b@t.test');  SET ROLE authenticated;
SELECT test.count_is(
  $$SELECT * FROM student_profiles WHERE user_id = test.uid('outsider@t.test')$$,
  0, '他大学の職員からは学生の情報が読めない');
SELECT test.count_is(
  $$SELECT * FROM facility_reservations WHERE id = 'dd111111-0000-4000-8000-000000000001'$$,
  0, '他大学の職員からは予約が読めない');


SELECT test.section('書き込みは RPC 以外に経路が無い');

RESET ROLE;  SELECT test.as('outsider@t.test');  SET ROLE authenticated;

-- テーブルに INSERT / UPDATE / DELETE のポリシーを1つも作っていないので、
-- 直接の書き込みはすべて弾かれる。ここが通るようになったら設計が崩れている。
SELECT test.raises(
  $$INSERT INTO circles (university_id, name, status)
    VALUES ('a1111111-0000-4000-8000-000000000001','勝手に作った部','approved')$$,
  'サークルを直接 INSERT できない');

SELECT test.raises(
  $$INSERT INTO circle_members (circle_id, user_id, role, status)
    VALUES ('cc111111-0000-4000-8000-000000000001', test.uid('outsider@t.test'),
            'admin','active')$$,
  '自分を管理者として直接 INSERT できない');

SELECT test.raises(
  $$INSERT INTO approvals (target_type, target_id, approver_id, approver_name, decision)
    VALUES ('circle','cc111111-0000-4000-8000-000000000002',
            test.uid('outsider@t.test'),'なりすまし','approved')$$,
  '承認の記録を直接 INSERT できない');

-- UPDATE と DELETE は「見えない行が対象外になるだけ」で例外にならないことがある。
-- 0件で終わることまで確かめる。
SELECT test.affects_none(
  $$UPDATE circles SET name = '乗っ取り'
     WHERE id = 'cc111111-0000-4000-8000-000000000001'$$,
  'サークルを直接 UPDATE できない');

SELECT test.affects_none(
  $$UPDATE users SET role = 'staff' WHERE id = test.uid('outsider@t.test')$$,
  '自分の役割を staff に書き換えられない');

SELECT test.affects_none(
  $$DELETE FROM circles WHERE id = 'cc111111-0000-4000-8000-000000000001'$$,
  'サークルを直接 DELETE できない');

SELECT test.affects_none(
  $$UPDATE universities SET required_circle_approvals = 1
     WHERE id = 'a1111111-0000-4000-8000-000000000001'$$,
  '必要承認者数を直接 UPDATE できない');


SELECT test.section('役割による制限');

-- イベントの参加登録ができるのは学生だけ（0020）
RESET ROLE;  SELECT test.as('general@t.test');  SET ROLE authenticated;
SELECT test.raises(
  $$SELECT public.join_event('ee111111-0000-4000-8000-000000000001')$$,
  '一般アカウントはイベントに参加登録できない');

RESET ROLE;  SELECT test.as('staff-a@t.test');  SET ROLE authenticated;
SELECT test.raises(
  $$SELECT public.join_event('ee111111-0000-4000-8000-000000000001')$$,
  '職員もイベントに参加登録できない');

-- 権限の昇格を直接の経路で試す（0001 / 0010）
RESET ROLE;  SELECT test.as('outsider@t.test');  SET ROLE authenticated;
SELECT test.raises(
  $$SELECT public.promote_to_staff('outsider@t.test',
       'a1111111-0000-4000-8000-000000000001')$$,
  '学生が自分を職員に昇格させられない');

RESET ROLE;
