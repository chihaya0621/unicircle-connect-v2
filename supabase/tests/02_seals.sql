-- =============================================================================
-- 印影と、承認記録の連なり
-- =============================================================================

SELECT test.section('印影を彫る');

RESET ROLE;  SELECT test.as('staff-a@t.test');  SET ROLE authenticated;

SELECT public.update_my_seal('甲大', 'circle');
SELECT test.eq(
  (SELECT seal_text FROM staff_profiles WHERE user_id = test.uid('staff-a@t.test')),
  '甲大', '職員は自分の印影を決められる');

SELECT test.raises(
  $$SELECT public.update_my_seal('五文字ある', 'circle')$$,
  '5字以上は彫れない');

SELECT test.raises(
  $$SELECT public.update_my_seal('甲', 'triangle')$$,
  '丸と角以外の形は指定できない');

RESET ROLE;  SELECT test.as('admin@t.test');  SET ROLE authenticated;
SELECT test.raises(
  $$SELECT public.update_my_seal('学生', 'circle')$$,
  '学生は印影を持てない');


SELECT test.section('押すと印影が焼き付く');

RESET ROLE;
UPDATE universities SET required_circle_approvals = 2
 WHERE id = 'a1111111-0000-4000-8000-000000000001';

SELECT test.as('staff-a@t.test');  SET ROLE authenticated;
SELECT test.eq(
  public.decide_circle('cc111111-0000-4000-8000-000000000002', true, '規約を確認しました'),
  'pending', '1人目の承認では成立しない');

SELECT test.eq(
  (SELECT seal_text FROM approvals
    WHERE target_id = 'cc111111-0000-4000-8000-000000000002'
      AND approver_id = test.uid('staff-a@t.test')),
  '甲大', '押した印影が記録に残る');

-- 印影を決めていない職員でも押せる。氏名の頭2字を彫った認印になる
RESET ROLE;  SELECT test.as('staff-a2@t.test');  SET ROLE authenticated;
SELECT test.eq(
  public.decide_circle('cc111111-0000-4000-8000-000000000002', true, '顧問の承諾も確認'),
  'approved', '2人目で承認が成立する');

SELECT test.eq(
  (SELECT seal_text FROM approvals
    WHERE target_id = 'cc111111-0000-4000-8000-000000000002'
      AND approver_id = test.uid('staff-a2@t.test')),
  '甲大', '印影を決めていなくても、氏名から認印ができる');

SELECT test.eq(
  (SELECT status FROM circles WHERE id = 'cc111111-0000-4000-8000-000000000002'),
  'approved', '人数が揃ってサークルが承認される');

-- 印影を後から変えても、押した跡は変わらない
RESET ROLE;  SELECT test.as('staff-a@t.test');  SET ROLE authenticated;
SELECT public.update_my_seal('改印', 'square');
SELECT test.eq(
  (SELECT seal_text FROM approvals
    WHERE target_id = 'cc111111-0000-4000-8000-000000000002'
      AND approver_id = test.uid('staff-a@t.test')),
  '甲大', '印影を変えても、過去に押した跡はそのまま');


SELECT test.section('記録の連なり');

RESET ROLE;  SELECT test.as('staff-a@t.test');  SET ROLE authenticated;

SELECT test.count_is(
  $$SELECT * FROM approvals
     WHERE target_id = 'cc111111-0000-4000-8000-000000000002' AND row_hash IS NOT NULL$$,
  2, '押すたびにハッシュが付く');

SELECT test.ok(
  (SELECT prev_hash IS NULL FROM approvals
    WHERE target_id = 'cc111111-0000-4000-8000-000000000002'
    ORDER BY created_at LIMIT 1),
  '1件目に前の記録は無い');

SELECT test.ok(
  (SELECT a2.prev_hash = a1.row_hash
     FROM approvals a1, approvals a2
    WHERE a1.target_id = 'cc111111-0000-4000-8000-000000000002'
      AND a2.target_id = 'cc111111-0000-4000-8000-000000000002'
      AND a1.created_at < a2.created_at),
  '2件目は1件目のハッシュを抱えている');

SELECT test.ok(
  (SELECT ok FROM public.verify_approval_chain(
     'circle','cc111111-0000-4000-8000-000000000002')),
  '連なりの検証が通る');


SELECT test.section('押した順と時刻の順が食い違っても、連なりが崩れない');

-- 2人がほぼ同時に押すと、あとの人は鍵（0034）を待ってから書く。このとき、
-- あとから書く側のトランザクションのほうが先に始まっていると、created_at の
-- 既定値（開始時刻）は前の記録より早くなる。1つの接続では待ち合わせを
-- 再現できないので、時刻を巻き戻した記録を直接入れて、同じ状態を作る。
RESET ROLE;
INSERT INTO circles (id, university_id, name, description, status, scope)
VALUES ('cc111111-0000-4000-8000-000000000009',
        'a1111111-0000-4000-8000-000000000001',
        '同時押しの部', '検証用', 'pending', 'university');

INSERT INTO approvals
  (target_type, target_id, approver_id, approver_name, decision, seal_text, seal_shape)
VALUES ('circle', 'cc111111-0000-4000-8000-000000000009',
        test.uid('staff-a@t.test'), '甲大職員', 'approved', '甲大', 'circle');

INSERT INTO approvals
  (target_type, target_id, approver_id, approver_name, decision, seal_text, seal_shape,
   created_at)
VALUES ('circle', 'cc111111-0000-4000-8000-000000000009',
        test.uid('staff-a2@t.test'), '甲大職員2', 'approved', '甲大', 'circle',
        now() - interval '1 second');

SELECT test.ok(
  (SELECT a2.created_at > a1.created_at
     FROM approvals a1, approvals a2
    WHERE a1.target_id = 'cc111111-0000-4000-8000-000000000009'
      AND a2.target_id = 'cc111111-0000-4000-8000-000000000009'
      AND a1.approver_id = test.uid('staff-a@t.test')
      AND a2.approver_id = test.uid('staff-a2@t.test')),
  'あとから書いた記録は、時刻も前の記録のあとに置かれる');

SELECT test.ok(
  (SELECT a2.prev_hash = a1.row_hash
     FROM approvals a1, approvals a2
    WHERE a1.target_id = 'cc111111-0000-4000-8000-000000000009'
      AND a2.target_id = 'cc111111-0000-4000-8000-000000000009'
      AND a1.approver_id = test.uid('staff-a@t.test')
      AND a2.approver_id = test.uid('staff-a2@t.test')),
  'あとから書いた記録が、前の記録のハッシュを抱えている');

SELECT test.ok(
  (SELECT ok FROM public.verify_approval_chain(
     'circle','cc111111-0000-4000-8000-000000000009')),
  '食い違っても、連なりの検証が通る');


SELECT test.section('書き換えに気づけるか');

-- 所見を後から書き換える。RLS を迂回できる立場でやってみる。
RESET ROLE;
UPDATE approvals SET comment = 'やはり取り消したい'
 WHERE target_id = 'cc111111-0000-4000-8000-000000000002'
   AND approver_id = test.uid('staff-a@t.test');

SELECT test.eq(
  (SELECT ok FROM public.verify_approval_chain(
     'circle','cc111111-0000-4000-8000-000000000002')),
  false, '所見を書き換えると検証が落ちる');

SELECT test.eq(
  (SELECT checked FROM public.verify_approval_chain(
     'circle','cc111111-0000-4000-8000-000000000002')),
  1, '何件目で合わなくなったかが分かる');

-- この仕組みの限界も書いておく。元の値にきっちり戻されると、
-- ハッシュも一致するので検知できない。検知できるのは「いまの中身が
-- 押された当時と違うこと」であって、途中で何があったかではない。
-- そこまで追うなら、書き換えの試み自体を別の表に積む必要がある。
UPDATE approvals SET comment = '規約を確認しました'
 WHERE target_id = 'cc111111-0000-4000-8000-000000000002'
   AND approver_id = test.uid('staff-a@t.test');
SELECT test.eq(
  (SELECT ok FROM public.verify_approval_chain(
     'circle','cc111111-0000-4000-8000-000000000002')),
  true, '元の値に戻されると検知できない（この仕組みの限界）');

RESET ROLE;
