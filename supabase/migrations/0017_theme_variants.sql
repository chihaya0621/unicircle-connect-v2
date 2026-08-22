-- =============================================================================
-- テーマの配色バリエーションを追加し、既定を pop にする
-- =============================================================================
-- 構造（角丸・影・ボタン形状）は pop 系で共通、配色だけが違う4種と、
-- 質感の異なる glass の計5種から選べるようにする。
-- =============================================================================

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_theme_check;
ALTER TABLE users
  ADD CONSTRAINT users_theme_check
  CHECK (theme IN ('pop', 'citrus', 'mint', 'berry', 'glass'));

-- 既定を pop に。既に glass を明示的に選んだ人の設定は変えない。
ALTER TABLE users ALTER COLUMN theme SET DEFAULT 'pop';

COMMENT ON COLUMN users.theme IS
  'pop/citrus/mint/berry=フラットなポップ系（配色違い） / glass=グラスモーフィズム';


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

  IF p_theme NOT IN ('pop', 'citrus', 'mint', 'berry', 'glass') THEN
    RAISE EXCEPTION 'テーマの指定が不正です';
  END IF;

  UPDATE public.users SET theme = p_theme WHERE id = auth.uid();
END;
$$;
