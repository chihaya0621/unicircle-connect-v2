-- =============================================================================
-- 【破壊的】データベース初期化スクリプト
-- =============================================================================
--
--  ⚠️  このスクリプトは public スキーマの全テーブルとデータを削除します。
--  ⚠️  実行すると元に戻せません。作り直す意図があるときだけ実行してください。
--
-- 実行順:
--   1. このファイル（作り直す場合のみ）
--   2. supabase/migrations/0000_initial_schema.sql
--   3. supabase/migrations/0001_handle_new_user.sql
--   4. (任意) supabase/seed.sql
--
-- =============================================================================


-- -----------------------------------------------------------------------------
-- セクション1: トリガーと関数の削除
-- -----------------------------------------------------------------------------
-- 先にトリガーを外さないと、後段の削除処理が auth.users の変更に
-- 反応して失敗することがある。
-- -----------------------------------------------------------------------------

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.promote_to_staff(text, uuid) CASCADE;


-- -----------------------------------------------------------------------------
-- セクション2: テーブルの削除
-- -----------------------------------------------------------------------------
-- CASCADE で依存関係ごと落とすため、削除順は気にしなくてよい。
-- -----------------------------------------------------------------------------

DROP TABLE IF EXISTS public.facility_reservations CASCADE;
DROP TABLE IF EXISTS public.facilities           CASCADE;
DROP TABLE IF EXISTS public.events               CASCADE;
DROP TABLE IF EXISTS public.circle_members       CASCADE;
DROP TABLE IF EXISTS public.circles              CASCADE;
DROP TABLE IF EXISTS public.staff_profiles       CASCADE;
DROP TABLE IF EXISTS public.student_profiles     CASCADE;
DROP TABLE IF EXISTS public.users                CASCADE;
DROP TABLE IF EXISTS public.universities         CASCADE;


-- -----------------------------------------------------------------------------
-- セクション3: 【任意・要判断】既存アカウントの削除
-- -----------------------------------------------------------------------------
--
--  ⚠️  以下は登録済みユーザー（ログイン情報）をすべて消します。
--
-- 上のセクション2だけでは auth.users は残ります。その場合、
-- 旧アカウントでログインはできるが public.users に行が無いため
-- アプリ側では未ログイン扱いになる、という中途半端な状態になります。
--
-- 完全に作り直すなら以下のコメントを外して実行してください。
-- テストアカウントしか無いなら外して問題ありません。
-- 消したくないアカウントがある場合はコメントのままにして、
-- 後述の補完SQL（README参照）で public.users を作り直してください。
-- -----------------------------------------------------------------------------

-- DELETE FROM auth.users;


-- -----------------------------------------------------------------------------
-- 確認
-- -----------------------------------------------------------------------------

SELECT
  (SELECT count(*) FROM information_schema.tables
     WHERE table_schema = 'public') AS remaining_public_tables,
  (SELECT count(*) FROM auth.users) AS remaining_auth_users;
