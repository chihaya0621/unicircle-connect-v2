-- =============================================================================
-- テストの足場
-- =============================================================================
-- 素の PostgreSQL に Supabase のふりをさせて、マイグレーションをそのまま
-- 流せるようにする。pgTAP は入れない。依存を増やすほど「手元では動くが
-- CI では動かない」が起きやすく、ここで欲しいのは
-- 「ポリシーを1行消したら落ちる」ことだけなので、素の SQL で足りる。
--
-- いちばん大事なのは test.as() で、RLS は「誰として実行しているか」で
-- 結果が変わる。ロールを切り替えずに書いたテストは、何も検証していない。
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS test;

-- 実行した検査の数を数える。0件で「全部通った」と言わないため。
CREATE TABLE IF NOT EXISTS test.log (
  id    BIGSERIAL PRIMARY KEY,
  label TEXT NOT NULL,
  at    TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);


-- -----------------------------------------------------------------------------
-- 誰として実行するか
-- -----------------------------------------------------------------------------
-- auth.uid() が読む設定値と、PostgreSQL のロールの両方を切り替える必要がある。
-- 片方だけだと、RLS は効いているのに auth.uid() が NULL、といった現実には
-- 起こらない状態でテストしてしまう。
--
-- ロールの切り替えは関数に隠さず、テスト側に SET ROLE を書く。
-- psql は1文ごとに確定するので SET LOCAL が効かず、関数の中で普通の
-- SET ROLE をすると、以降そのロールのままになって戻せなくなるため。
--
--   使い方:  RESET ROLE;  SELECT test.as('member@t.test');  SET ROLE authenticated;
--   未ログイン: RESET ROLE;  SELECT test.as_anon();  SET ROLE anon;

CREATE OR REPLACE FUNCTION test.as(p_email TEXT)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE v_id UUID;
BEGIN
  SELECT id INTO v_id FROM auth.users WHERE email = p_email;
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'テスト用の利用者が見つかりません: %', p_email;
  END IF;
  PERFORM set_config('request.jwt.uid', v_id::text, false);
  RETURN p_email;
END;
$$;

/** 未ログイン。匿名キーで叩かれている状態 */
CREATE OR REPLACE FUNCTION test.as_anon()
RETURNS TEXT LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.uid', '', false);
  RETURN '（未ログイン）';
END;
$$;

CREATE OR REPLACE FUNCTION test.uid(p_email TEXT)
RETURNS UUID LANGUAGE sql STABLE AS
$$ SELECT id FROM auth.users WHERE email = p_email $$;

/**
 * 処理中の引き継ぎの ID を、RLS を迂回して引く。
 *
 * テストの中で素直に SELECT すると、その行が「読めない」立場の人からは
 * NULL になり、RPC には存在しない ID が渡る。すると所有者の判定に
 * たどり着く前に「見つからない」で弾かれ、確かめたい分岐を通らない。
 * 通ってはいるが理由が違う、といういちばん質の悪い通り方をする。
 */
CREATE OR REPLACE FUNCTION test.pending_handover(p_circle UUID)
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS
$$ SELECT id FROM public.circle_handovers
    WHERE circle_id = p_circle AND status = 'pending' $$;


-- -----------------------------------------------------------------------------
-- 検査
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION test.ok(p_cond BOOLEAN, p_label TEXT)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  IF p_cond IS NOT TRUE THEN
    RAISE EXCEPTION E'\n  ✗ %', p_label;
  END IF;
  INSERT INTO test.log (label) VALUES (p_label);
  RAISE NOTICE '  ✓ %', p_label;
END;
$$;

CREATE OR REPLACE FUNCTION test.eq(p_got ANYELEMENT, p_want ANYELEMENT, p_label TEXT)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  IF p_got IS DISTINCT FROM p_want THEN
    RAISE EXCEPTION E'\n  ✗ %\n      期待: %\n      実際: %', p_label, p_want, p_got;
  END IF;
  INSERT INTO test.log (label) VALUES (p_label);
  RAISE NOTICE '  ✓ % (%)', p_label, p_got;
END;
$$;

/** 問い合わせの結果が何件になるか。RLS の検証はほぼこれで足りる */
CREATE OR REPLACE FUNCTION test.count_is(p_sql TEXT, p_want BIGINT, p_label TEXT)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE v_got BIGINT;
BEGIN
  EXECUTE 'SELECT count(*) FROM (' || p_sql || ') q' INTO v_got;
  PERFORM test.eq(v_got, p_want, p_label);
END;
$$;

/** 失敗することを確かめる。書き込みが塞がっているかの検証に使う */
CREATE OR REPLACE FUNCTION test.raises(p_sql TEXT, p_label TEXT)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test.log (label) VALUES (p_label);
    RAISE NOTICE '  ✓ % — %', p_label, left(SQLERRM, 60);
    RETURN;
  END;
  RAISE EXCEPTION E'\n  ✗ %\n      通ってはいけない操作が通った', p_label;
END;
$$;

/**
 * 書き込みが「静かに0件」で終わることを確かめる。
 *
 * RLS の UPDATE / DELETE は、ポリシーに合わない行が単に見えないだけなので
 * 例外にならない。raises() で待っていると、防げていないのに通ってしまう。
 */
CREATE OR REPLACE FUNCTION test.affects_none(p_sql TEXT, p_label TEXT)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE v_n BIGINT;
BEGIN
  BEGIN
    EXECUTE p_sql;
    GET DIAGNOSTICS v_n = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test.log (label) VALUES (p_label);
    RAISE NOTICE '  ✓ % — 例外で弾かれた', p_label;
    RETURN;
  END;
  PERFORM test.eq(v_n, 0::BIGINT, p_label);
END;
$$;

CREATE OR REPLACE FUNCTION test.section(p_title TEXT)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  RAISE NOTICE E'\n■ %', p_title;
END;
$$;


-- どのロールで走っていても検査の記録を残せるようにする。
-- 権限不足で log に書けないと、検査は通っているのに件数が0になり、
-- 実行ファイル側の「1件も走っていない」判定に引っかかる。
GRANT USAGE ON SCHEMA test TO anon, authenticated;
GRANT INSERT, SELECT ON test.log TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE test.log_id_seq TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA test TO anon, authenticated;
GRANT SELECT ON auth.users TO anon, authenticated;
