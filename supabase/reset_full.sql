-- =============================================================================
-- 【破壊的・完全版】public スキーマを丸ごと作り直す
-- =============================================================================
--
--  ⚠️  public スキーマ内のテーブル・ビュー・関数・型をすべて削除します。
--  ⚠️  実行すると元に戻せません。
--
-- reset.sql との違い:
--   reset.sql      … 要件定義書に載っているテーブル名を明示して削除する。
--                     それ以外の名前のテーブル（旧スキーマの残骸など）は残る。
--   reset_full.sql … public スキーマごと削除して作り直す。名前が何であれ消える。
--
-- 旧プロジェクトを流用していて、以前のスキーマの残骸がある場合はこちらを使います。
--
-- 実行順:
--   1. このファイル
--   2. supabase/migrations/0000_initial_schema.sql
--   3. supabase/migrations/0001_handle_new_user.sql
--   4. (任意) supabase/seed.sql
--
-- =============================================================================


-- -----------------------------------------------------------------------------
-- セクション1: トリガーの削除
-- -----------------------------------------------------------------------------
-- トリガーは auth スキーマ側に付いているため、public を落としても残る。
-- 先に明示的に外しておく。
-- -----------------------------------------------------------------------------

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;


-- -----------------------------------------------------------------------------
-- セクション2: public スキーマの再作成
-- -----------------------------------------------------------------------------
-- Supabase では拡張機能は extensions スキーマに入っているため、
-- public を落としても拡張は壊れない。
--
-- 権限の付与は Supabase の標準構成に合わせている。これを忘れると
-- PostgREST（anon / authenticated 経由のAPI）がテーブルを読めなくなる。
-- -----------------------------------------------------------------------------

DROP SCHEMA public CASCADE;
CREATE SCHEMA public;

GRANT USAGE  ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL    ON SCHEMA public TO postgres, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON FUNCTIONS TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;

COMMENT ON SCHEMA public IS 'standard public schema';


-- -----------------------------------------------------------------------------
-- セクション3: 【任意・要判断】既存アカウントの削除
-- -----------------------------------------------------------------------------
--
--  ⚠️  登録済みユーザー（ログイン情報）をすべて消します。
--
-- public スキーマを消しても auth.users は残ります。その場合、
-- 旧アカウントでログインはできるが public.users に行が無いため
-- アプリ側では未ログイン扱いになる、という状態になります。
--
-- テストアカウントしか無いなら、以下のコメントを外してください。
-- -----------------------------------------------------------------------------

-- DELETE FROM auth.users;


-- -----------------------------------------------------------------------------
-- 確認
-- -----------------------------------------------------------------------------
-- remaining_public_tables が 0 になっていれば成功です。
-- -----------------------------------------------------------------------------

SELECT
  (SELECT count(*) FROM information_schema.tables
     WHERE table_schema = 'public') AS remaining_public_tables,
  (SELECT count(*) FROM auth.users) AS remaining_auth_users;
