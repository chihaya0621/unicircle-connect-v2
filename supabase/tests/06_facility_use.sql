-- =============================================================================
-- 施設の使用許可願（0037）
-- =============================================================================
-- 複数の日時をまとめて出せること。1つでも通らなければ、どの日時も残らないこと。
-- 職員への通知は、願い1枚につき1回であること。
-- =============================================================================

-- 職員への通知の数を、願いを出す前に控えておく
RESET ROLE;
CREATE TEMP TABLE notified_before AS
  SELECT count(*) AS n FROM notifications WHERE user_id = test.uid('staff-a@t.test');


SELECT test.section('使用許可願を出す');

RESET ROLE;  SELECT test.as('member@t.test');  SET ROLE authenticated;
SELECT test.eq(
  public.request_facility_use(
    'ff111111-0000-4000-8000-000000000001',
    jsonb_build_array(
      jsonb_build_object('start', now() + interval '40 days',
                         'end',   now() + interval '40 days 2 hours'),
      jsonb_build_object('start', now() + interval '47 days',
                         'end',   now() + interval '47 days 2 hours')),
    '定期練習', NULL, 5, 1, 0, 1, '持ち込みのスピーカー', '片付けまで行います'),
  2, '2日分の日時をまとめて出せる');

RESET ROLE;
SELECT test.count_is(
  $$SELECT 1 FROM facility_reservations
     WHERE purpose = '定期練習' AND status = 'pending'
       AND student_count = 5 AND staff_count = 1 AND other_count = 0
       AND outside_count = 1 AND equipment_note = '持ち込みのスピーカー'
       AND remarks = '片付けまで行います'$$,
  2, '日時ごとの予約に、利用人員・使用用具・備考が入る');
SELECT test.eq(
  (SELECT count(DISTINCT request_id) FROM facility_reservations
    WHERE purpose = '定期練習' AND request_id IS NOT NULL),
  1::bigint, '同じ願いの日時は、同じ request_id でまとまる');

SELECT test.eq(
  (SELECT count(*) FROM notifications WHERE user_id = test.uid('staff-a@t.test'))
    - (SELECT n FROM notified_before),
  1::bigint, '職員への通知は、日数分ではなく1回');
SELECT test.ok(
  EXISTS (SELECT 1 FROM notifications
           WHERE user_id = test.uid('staff-a@t.test')
             AND title = '施設の使用許可願が届きました'
             AND body = '第1会議室（2日分）'),
  '通知に、施設の名前と何日分かが出る');

-- まとめて出したあとも、1件ずつの予約ではこれまでどおり通知が飛ぶ
RESET ROLE;
TRUNCATE notified_before;
INSERT INTO notified_before
  SELECT count(*) FROM notifications WHERE user_id = test.uid('staff-a@t.test');
SELECT test.as('member@t.test');  SET ROLE authenticated;
SELECT public.create_reservation('ff111111-0000-4000-8000-000000000001',
  now() + interval '60 days', now() + interval '60 days 1 hour', '単発の予約', NULL);
RESET ROLE;
SELECT test.eq(
  (SELECT count(*) FROM notifications WHERE user_id = test.uid('staff-a@t.test'))
    - (SELECT n FROM notified_before),
  1::bigint, '1件ずつの予約申請の通知は、止まったままにならない');


SELECT test.section('1つでも通らなければ、どの日時も残らない');

-- 2つ目の日時が、上で出した40日後の予約と重なる
RESET ROLE;  SELECT test.as('member@t.test');  SET ROLE authenticated;
SELECT test.raises(
  $$SELECT public.request_facility_use(
      'ff111111-0000-4000-8000-000000000001',
      jsonb_build_array(
        jsonb_build_object('start', now() + interval '50 days',
                           'end',   now() + interval '50 days 1 hour'),
        jsonb_build_object('start', now() + interval '40 days 1 hour',
                           'end',   now() + interval '40 days 3 hours')),
      '重なる願い', NULL, 3)$$,
  '重なる日時が1つでもあると、出せない');

RESET ROLE;
SELECT test.count_is(
  $$SELECT 1 FROM facility_reservations WHERE purpose = '重なる願い'$$,
  0, '重ならなかった日時も残らない');

SELECT test.as('member@t.test');  SET ROLE authenticated;
DO $$
DECLARE v_msg TEXT;
BEGIN
  BEGIN
    PERFORM public.request_facility_use(
      'ff111111-0000-4000-8000-000000000001',
      jsonb_build_array(
        jsonb_build_object('start', now() + interval '40 days 1 hour',
                           'end',   now() + interval '40 days 3 hours')),
      '重なる願い', NULL, 3);
  EXCEPTION WHEN OTHERS THEN
    v_msg := SQLERRM;
  END;
  PERFORM test.ok(
    v_msg LIKE 'その時間帯はすでに予約されています（%月%日 %:%）',
    '断るときは、どの日時で止まったかを添える');
END $$;


SELECT test.section('願いの中身の確認');

RESET ROLE;  SELECT test.as('member@t.test');  SET ROLE authenticated;
SELECT test.raises(
  $$SELECT public.request_facility_use('ff111111-0000-4000-8000-000000000001',
      jsonb_build_array(jsonb_build_object('start', now() + interval '70 days',
                                           'end',   now() + interval '70 days 1 hour')),
      '   ', NULL, 3)$$,
  '目的が空では出せない');
SELECT test.raises(
  $$SELECT public.request_facility_use('ff111111-0000-4000-8000-000000000001',
      jsonb_build_array(jsonb_build_object('start', now() + interval '70 days',
                                           'end',   now() + interval '70 days 1 hour')),
      '人数なし', NULL, 0, 0, 0)$$,
  '利用人員が0人では出せない');
SELECT test.raises(
  $$SELECT public.request_facility_use('ff111111-0000-4000-8000-000000000001',
      jsonb_build_array(jsonb_build_object('start', now() + interval '70 days',
                                           'end',   now() + interval '70 days 1 hour')),
      '学外者が多すぎる', NULL, 2, 0, 0, 3)$$,
  '学外者は、利用人員の合計を超えられない');
SELECT test.raises(
  $$SELECT public.request_facility_use('ff111111-0000-4000-8000-000000000001',
      '[]'::jsonb, '日時なし', NULL, 3)$$,
  '日時が1つも無ければ出せない');
SELECT test.raises(
  $$SELECT public.request_facility_use('ff111111-0000-4000-8000-000000000001',
      (SELECT jsonb_agg(jsonb_build_object(
                'start', now() + (i || ' days')::interval + interval '100 days',
                'end',   now() + (i || ' days')::interval + interval '100 days 1 hour'))
         FROM generate_series(1, 17) AS i),
      '多すぎる日時', NULL, 3)$$,
  '日時は16件まで');

RESET ROLE;
SELECT test.raises(
  $$UPDATE facility_reservations SET outside_count = 99 WHERE purpose = '定期練習'$$,
  '学外者は利用人員の内数（表の制約でも止める）');


SELECT test.section('出せる人・出せない人');

RESET ROLE;  SELECT test.as('staff-a@t.test');  SET ROLE authenticated;
SELECT test.raises(
  $$SELECT public.request_facility_use('ff111111-0000-4000-8000-000000000001',
      jsonb_build_array(jsonb_build_object('start', now() + interval '80 days',
                                           'end',   now() + interval '80 days 1 hour')),
      '職員の願い', NULL, 3)$$,
  '職員は出せない（学生のみ）');

RESET ROLE;  SELECT test.as('general@t.test');  SET ROLE authenticated;
SELECT test.raises(
  $$SELECT public.request_facility_use('ff111111-0000-4000-8000-000000000001',
      jsonb_build_array(jsonb_build_object('start', now() + interval '80 days',
                                           'end',   now() + interval '80 days 1 hour')),
      '一般の願い', NULL, 3)$$,
  '一般は出せない');

RESET ROLE;  SELECT test.as_anon();  SET ROLE anon;
SELECT test.raises(
  $$SELECT public.request_facility_use('ff111111-0000-4000-8000-000000000001',
      '[]'::jsonb, '未ログインの願い', NULL, 3)$$,
  '未ログインは呼べない');

RESET ROLE;
DROP TABLE notified_before;
