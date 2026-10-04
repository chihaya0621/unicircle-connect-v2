-- =============================================================================
-- 施設使用許可願の、大学ごとの項目（0038）
-- =============================================================================
-- 職員が足した項目が、その大学の学生の願いで尋ねられること。対象の施設を
-- 絞った項目は、その施設のときだけ尋ねること。答えは項目名と一緒に残ること。
-- ほかの大学の様式や施設には触れられないこと。
-- =============================================================================

-- 対象を絞る確かめに、テスト大学の2つ目の施設と、よその大学の施設を足す
RESET ROLE;
INSERT INTO facilities (id, university_id, name, category, is_available) VALUES
  ('ff111111-0000-4000-8000-000000000002',
   'a1111111-0000-4000-8000-000000000001', '第2会議室', 'facility', true),
  ('ff222222-0000-4000-8000-000000000001',
   'a1111111-0000-4000-8000-000000000002', 'よその会議室', 'facility', true)
ON CONFLICT (id) DO NOTHING;


SELECT test.section('職員が様式を変える');

RESET ROLE;  SELECT test.as('staff-a@t.test');  SET ROLE authenticated;
SELECT public.update_facility_use_form(jsonb_build_object(
  'notes', jsonb_build_array('  飲食はしないでください。  '),
  'outside_rule', '',
  'questions', jsonb_build_array(
    jsonb_build_object(
      'id', '11111111-1111-4111-8111-111111111111',
      'label', '電気錠設定', 'kind', 'choice',
      'options', jsonb_build_array('不要', '必要'),
      'hint', '講義棟の部屋だけ', 'required', true,
      'facility_ids', jsonb_build_array('ff111111-0000-4000-8000-000000000001'),
      'unknown_key', '捨てられる'),
    jsonb_build_object(
      'id', '22222222-2222-4222-8222-222222222222',
      'label', '使ったあと鍵を返します', 'kind', 'check',
      'options', jsonb_build_array('使われない'),
      'required', false, 'facility_ids', '[]'::jsonb))));

RESET ROLE;
SELECT test.eq(
  (SELECT jsonb_array_length(facility_use_form -> 'questions') FROM universities
    WHERE id = 'a1111111-0000-4000-8000-000000000001'),
  2, '追加の項目が2つ保存される');
SELECT test.eq(
  (SELECT facility_use_form -> 'notes' ->> 0 FROM universities
    WHERE id = 'a1111111-0000-4000-8000-000000000001'),
  '飲食はしないでください。', '注意事項は前後の空白を落として保存する');
SELECT test.ok(
  (SELECT NOT (facility_use_form -> 'questions' -> 0 ? 'unknown_key')
          AND facility_use_form -> 'questions' -> 1 -> 'options' = '[]'::jsonb
     FROM universities WHERE id = 'a1111111-0000-4000-8000-000000000001'),
  '知らないキーと、選択式でない項目の選択肢は捨てる');


SELECT test.section('学生の願いで尋ねる');

RESET ROLE;  SELECT test.as('member@t.test');  SET ROLE authenticated;
SELECT test.raises(
  $$SELECT public.request_facility_use('ff111111-0000-4000-8000-000000000001',
      jsonb_build_array(jsonb_build_object('start', now() + interval '90 days',
                                           'end',   now() + interval '90 days 1 hour')),
      '電気錠の答え漏れ', NULL, 3)$$,
  '必須の項目に答えないと出せない');
SELECT test.raises(
  $$SELECT public.request_facility_use('ff111111-0000-4000-8000-000000000001',
      jsonb_build_array(jsonb_build_object('start', now() + interval '90 days',
                                           'end',   now() + interval '90 days 1 hour')),
      '選択肢に無い答え', NULL, 3, 0, 0, 0, NULL, NULL,
      jsonb_build_object('11111111-1111-4111-8111-111111111111', 'たぶん'))$$,
  '選択肢に無い答えは断る');

SELECT public.request_facility_use('ff111111-0000-4000-8000-000000000001',
  jsonb_build_array(jsonb_build_object('start', now() + interval '90 days',
                                       'end',   now() + interval '90 days 1 hour')),
  '電気錠あり', NULL, 3, 0, 0, 0, NULL, NULL,
  jsonb_build_object('11111111-1111-4111-8111-111111111111', '必要'));

RESET ROLE;
SELECT test.eq(
  (SELECT answers FROM facility_reservations WHERE purpose = '電気錠あり'),
  '[{"label": "電気錠設定", "answer": "必要"}, {"label": "使ったあと鍵を返します", "answer": "いいえ"}]'::jsonb,
  '答えは項目名と一緒に残る。付いていないチェックは「いいえ」');

-- 第2会議室は電気錠の対象ではない
SELECT test.as('member@t.test');  SET ROLE authenticated;
SELECT test.eq(
  public.request_facility_use('ff111111-0000-4000-8000-000000000002',
    jsonb_build_array(jsonb_build_object('start', now() + interval '91 days',
                                         'end',   now() + interval '91 days 1 hour')),
    '対象外の施設', NULL, 3, 0, 0, 0, NULL, NULL,
    jsonb_build_object('22222222-2222-4222-8222-222222222222', 'yes')),
  1, '対象を絞った項目は、ほかの施設では尋ねない');
RESET ROLE;
SELECT test.eq(
  (SELECT answers FROM facility_reservations WHERE purpose = '対象外の施設'),
  '[{"label": "使ったあと鍵を返します", "answer": "はい"}]'::jsonb,
  '付いたチェックは「はい」と残る');

-- あとで項目の名前を変えても、出した願いの答えは変わらない
SELECT test.as('staff-a@t.test');  SET ROLE authenticated;
SELECT public.update_facility_use_form(jsonb_build_object(
  'notes', '[]'::jsonb, 'outside_rule', '',
  'questions', jsonb_build_array(jsonb_build_object(
    'id', '11111111-1111-4111-8111-111111111111',
    'label', '電気錠', 'kind', 'choice', 'options', jsonb_build_array('不要', '必要'),
    'required', true, 'facility_ids', '[]'::jsonb))));
RESET ROLE;
SELECT test.eq(
  (SELECT answers -> 0 ->> 'label' FROM facility_reservations WHERE purpose = '電気錠あり'),
  '電気錠設定', '出した願いの項目名は、出したときのまま');


SELECT test.section('様式を変えられる人と、中身の確認');

RESET ROLE;  SELECT test.as('member@t.test');  SET ROLE authenticated;
SELECT test.raises(
  $$SELECT public.update_facility_use_form('{"notes": []}'::jsonb)$$,
  '学生は様式を変えられない');

RESET ROLE;  SELECT test.as('staff-a@t.test');  SET ROLE authenticated;
SELECT test.raises(
  $$SELECT public.update_facility_use_form(jsonb_build_object('questions',
      (SELECT jsonb_agg(jsonb_build_object('id', gen_random_uuid(), 'label', '項目' || i,
                                           'kind', 'text', 'facility_ids', '[]'::jsonb))
         FROM generate_series(1, 11) AS i)))$$,
  '追加の項目は10個まで');
SELECT test.raises(
  $$SELECT public.update_facility_use_form(jsonb_build_object('questions', jsonb_build_array(
      jsonb_build_object('id', gen_random_uuid(), 'label', '選択肢が1つ', 'kind', 'choice',
                         'options', jsonb_build_array('はい'), 'facility_ids', '[]'::jsonb))))$$,
  '選択式の選択肢は2つ以上');
SELECT test.raises(
  $$SELECT public.update_facility_use_form(jsonb_build_object('questions', jsonb_build_array(
      jsonb_build_object('id', gen_random_uuid(), 'label', 'よその施設', 'kind', 'text',
                         'facility_ids', jsonb_build_array('ff222222-0000-4000-8000-000000000001')))))$$,
  'ほかの大学の施設は、対象に選べない');
SELECT test.raises(
  $$SELECT public.update_facility_use_form(jsonb_build_object('questions', jsonb_build_array(
      jsonb_build_object('id', 'not-a-uuid', 'label', '識別子が変', 'kind', 'text',
                         'facility_ids', '[]'::jsonb))))$$,
  '項目の識別子の形を確かめる');

-- よその大学の職員が変えても、テスト大学の様式は変わらない
RESET ROLE;  SELECT test.as('staff-b@t.test');  SET ROLE authenticated;
SELECT public.update_facility_use_form(jsonb_build_object(
  'notes', jsonb_build_array('よその注意事項'), 'outside_rule', '', 'questions', '[]'::jsonb));
RESET ROLE;
SELECT test.eq(
  (SELECT facility_use_form -> 'questions' -> 0 ->> 'label' FROM universities
    WHERE id = 'a1111111-0000-4000-8000-000000000001'),
  '電気錠', 'よその大学の職員の変更は、自分の大学にだけ効く');


SELECT test.section('既定に戻す');

RESET ROLE;  SELECT test.as('staff-a@t.test');  SET ROLE authenticated;
SELECT public.update_facility_use_form(NULL);
RESET ROLE;
SELECT test.ok(
  (SELECT facility_use_form IS NULL FROM universities
    WHERE id = 'a1111111-0000-4000-8000-000000000001'),
  'null を渡すと既定に戻る');

RESET ROLE;  SELECT test.as_anon();  SET ROLE anon;
SELECT test.raises(
  $$SELECT public.update_facility_use_form(NULL)$$,
  '未ログインは呼べない');
RESET ROLE;
