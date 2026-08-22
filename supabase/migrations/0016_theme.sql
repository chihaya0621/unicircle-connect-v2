-- =============================================================================
-- 表示テーマの個人設定
-- =============================================================================
-- 見た目の好みは人によるので、ユーザーごとに選べるようにする。
--
-- 保存先を Cookie ではなく DB にしているのは、端末を変えても設定が
-- 保たれるようにするため。サーバー側で読んで html に属性を付けるので、
-- 切り替え時にちらつかない（localStorage だと一瞬既定のテーマが見える）。
-- =============================================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS theme TEXT NOT NULL DEFAULT 'glass';

-- 既存行にも既定値が入るので、そのあとに制約を付ける
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_theme_check;
ALTER TABLE users
  ADD CONSTRAINT users_theme_check CHECK (theme IN ('glass', 'pop'));

COMMENT ON COLUMN users.theme IS
  'glass=グラスモーフィズム / pop=フラットで彩度の高いポップスタイル';


-- -----------------------------------------------------------------------------
-- テーマの変更
-- -----------------------------------------------------------------------------
-- 対象は常に自分自身。0008 の方針どおり、書き込みは RPC のみ。
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_my_theme(p_theme TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'ログインが必要です';
  END IF;

  IF p_theme NOT IN ('glass', 'pop') THEN
    RAISE EXCEPTION 'テーマの指定が不正です';
  END IF;

  UPDATE public.users SET theme = p_theme WHERE id = auth.uid();
END;
$$;
