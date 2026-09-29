-- =============================================================================
-- 0035: 公開デモを、毎晩「保存しておいた状態」に戻す
-- =============================================================================
-- 公開デモは誰でも職員として入れて、書き込める。来場者が足したものや
-- 書き換えたものは、そのまま次の人にも見える。書き込みを制限するのではなく、
-- 毎晩、保存しておいた状態に戻す。
--
-- ・保存（demo_snapshot）は手で1回だけ取る。いまあるデモ用のデータが、
--   そのまま「元の状態」になる。戻すときに消えるのは、保存したあとで
--   足された・変えられたものだけ。
-- ・アカウント（auth.users と public.users の行）は消さない。あとから
--   登録した人は、次の朝も同じアカウントで入れる。保存したときからある
--   アカウントは、名前・役割・テーマ・プロフィール・印影を元に戻す。
-- ・保存が無いときは何もしない。空の状態に戻してしまわないため。
-- ・戻すあいだはトリガーと外部キーを止める（session_replication_role）。
--   通知が一斉に飛んだり、承認の記録の連なりが付け直されたりしない。
--   承認の記録は、保存したときのハッシュのまま戻るので、検証も通る。
--
-- 本物の大学で使う環境では、保存を取らなければ何も起きない。
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS demo_seed;
REVOKE ALL ON SCHEMA demo_seed FROM public, anon, authenticated;

COMMENT ON SCHEMA demo_seed IS
  '公開デモの「元の状態」。demo_snapshot() が取り、demo_reset() が戻す。';


-- -----------------------------------------------------------------------------
-- 1. 戻す対象
-- -----------------------------------------------------------------------------
-- 中身の表は丸ごと入れ替える。アカウントの表（users・student_profiles・
-- staff_profiles）は行を消さずに、保存したときからある人の分だけ戻す。
-- 表を足したらここにも足すこと。足し忘れは supabase/tests/04_demo_reset.sql が落とす。

CREATE OR REPLACE FUNCTION public.demo_content_tables()
RETURNS text[]
LANGUAGE sql IMMUTABLE
AS $$
  SELECT ARRAY[
    'universities', 'campuses',
    'circles', 'circle_members', 'circle_universities', 'circle_posts',
    'circle_handovers', 'circle_favorites', 'watched_universities',
    'events', 'event_universities', 'event_participants', 'event_reminders',
    'facilities', 'facility_reservations', 'approvals',
    'notifications', 'notification_preferences'
  ]::text[]
$$;

CREATE OR REPLACE FUNCTION public.demo_account_tables()
RETURNS text[]
LANGUAGE sql IMMUTABLE
AS $$
  SELECT ARRAY['users', 'student_profiles', 'staff_profiles']::text[]
$$;


-- 保存したあとで列が足されても戻せるよう、両方にある列だけを書き写す
CREATE OR REPLACE FUNCTION public.demo_shared_columns(p_table text)
RETURNS text
LANGUAGE sql STABLE
SET search_path = public, pg_temp
AS $$
  SELECT string_agg(quote_ident(c.column_name), ', ' ORDER BY c.ordinal_position)
    FROM information_schema.columns c
   WHERE c.table_schema = 'public'
     AND c.table_name = p_table
     AND EXISTS (
       SELECT 1 FROM information_schema.columns s
        WHERE s.table_schema = 'demo_seed'
          AND s.table_name = p_table
          AND s.column_name = c.column_name)
$$;


-- -----------------------------------------------------------------------------
-- 2. 保存する（手で1回だけ）
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.demo_snapshot()
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  t text;
  n bigint;
  total bigint := 0;
BEGIN
  -- 前の保存は捨てて取り直す
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'demo_seed' LOOP
    EXECUTE format('DROP TABLE demo_seed.%I', t);
  END LOOP;

  FOREACH t IN ARRAY public.demo_content_tables() || public.demo_account_tables() LOOP
    EXECUTE format('CREATE TABLE demo_seed.%I AS TABLE public.%I', t, t);
    EXECUTE format('SELECT count(*) FROM demo_seed.%I', t) INTO n;
    total := total + n;
  END LOOP;

  CREATE TABLE demo_seed.taken_at AS SELECT now() AS at;

  RETURN format('%s 行を保存しました（%s）', total,
    to_char(now() AT TIME ZONE 'Asia/Tokyo', 'YYYY-MM-DD HH24:MI'));
END;
$$;


-- -----------------------------------------------------------------------------
-- 3. 戻す（毎晩）
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.demo_reset()
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  t text;
  cols text;
  r record;
  v_at timestamptz;
BEGIN
  -- 保存が無ければ何もしない。空の状態に戻してしまわないため
  IF to_regclass('demo_seed.taken_at') IS NULL THEN
    RAISE NOTICE 'デモの保存が無いので、何もしませんでした。';
    RETURN 'skipped: 保存がありません';
  END IF;
  SELECT at INTO v_at FROM demo_seed.taken_at;

  -- 送ったリマインドは、送ったままにしておく。戻すと、まだ始まっていない
  -- イベントのリマインドが、次の定期実行でもう一度送られてしまう
  IF to_regclass('pg_temp.demo_sent') IS NOT NULL THEN
    DROP TABLE pg_temp.demo_sent;
  END IF;
  CREATE TEMP TABLE demo_sent ON COMMIT DROP AS
    SELECT user_id, event_id, notified_at
      FROM public.event_reminders WHERE notified_at IS NOT NULL;

  -- トリガーと外部キーを止める。このトランザクションが終われば元に戻る
  SET LOCAL session_replication_role = replica;

  -- 中身の表: 保存したときの行に入れ替える
  FOREACH t IN ARRAY public.demo_content_tables() LOOP
    cols := public.demo_shared_columns(t);
    EXECUTE format('DELETE FROM public.%I', t);
    EXECUTE format('INSERT INTO public.%I (%s) SELECT %s FROM demo_seed.%I', t, cols, cols, t);
  END LOOP;

  -- アカウント: 行は消さない。保存したときからある人の分だけ戻す
  UPDATE public.users u
     SET name = s.name, role = s.role, theme = s.theme
    FROM demo_seed.users s
   WHERE s.id = u.id;

  FOREACH t IN ARRAY ARRAY['student_profiles', 'staff_profiles'] LOOP
    cols := public.demo_shared_columns(t);
    EXECUTE format(
      'DELETE FROM public.%I p WHERE p.user_id IN (SELECT id FROM demo_seed.users)', t);
    EXECUTE format(
      'INSERT INTO public.%I (%s) SELECT %s FROM demo_seed.%I s
        WHERE EXISTS (SELECT 1 FROM public.users u WHERE u.id = s.user_id)',
      t, cols, cols, t);
  END LOOP;

  -- 保存したあとで消えたアカウントを指す行を片づける。外部キーを止めて
  -- 戻したので、ここで直さないと、居ない人を指す行が残る
  FOR r IN
    SELECT c.conrelid::regclass AS tbl, a.attname AS col, c.confdeltype AS act
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
     WHERE c.contype = 'f'
       AND c.confrelid = 'public.users'::regclass
       AND c.conrelid::regclass::text = ANY (public.demo_content_tables())
  LOOP
    IF r.act = 'n' THEN
      EXECUTE format(
        'UPDATE %s t SET %I = NULL WHERE t.%I IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = t.%I)',
        r.tbl, r.col, r.col, r.col);
    ELSE
      EXECUTE format(
        'DELETE FROM %s t WHERE t.%I IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = t.%I)',
        r.tbl, r.col, r.col);
    END IF;
  END LOOP;

  UPDATE public.event_reminders e
     SET notified_at = s.notified_at
    FROM demo_sent s
   WHERE e.user_id = s.user_id AND e.event_id = s.event_id
     AND e.notified_at IS NULL;

  -- 止めたトリガーを、ここで戻しておく。SQL Editor で続けて流す文まで
  -- トリガーが止まったままになると、通知や記録の連なりが作られない
  SET LOCAL session_replication_role = origin;

  RETURN format('%s に保存した状態に戻しました',
    to_char(v_at AT TIME ZONE 'Asia/Tokyo', 'YYYY-MM-DD HH24:MI'));
END;
$$;


-- -----------------------------------------------------------------------------
-- 4. 実行権限
-- -----------------------------------------------------------------------------
-- 画面からは呼ばせない。管理画面の SQL と、定期実行からだけ呼ぶ。

REVOKE EXECUTE ON FUNCTION public.demo_snapshot() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.demo_reset() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.demo_shared_columns(text) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.demo_content_tables() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.demo_account_tables() FROM public, anon, authenticated;


-- -----------------------------------------------------------------------------
-- 5. 定期実行の登録（毎日 日本時間 3:30）
-- -----------------------------------------------------------------------------
-- pg_cron が有効でなければ登録を飛ばす。保存が無いうちは、動いても何もしない。
-- 止めたいときは: SELECT cron.unschedule('demo-reset');

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE
      'pg_cron が有効でないため、デモを戻す定期実行は登録しませんでした。';
    RETURN;
  END IF;

  PERFORM cron.unschedule(jobid)
     FROM cron.job WHERE jobname = 'demo-reset';

  -- pg_cron の時刻は UTC。18:30 UTC は日本時間の翌 3:30
  PERFORM cron.schedule(
    'demo-reset',
    '30 18 * * *',
    'SELECT public.demo_reset();'
  );

  RAISE NOTICE 'デモを戻す定期実行を、毎日 日本時間 3:30 に登録しました。';
END;
$$;
