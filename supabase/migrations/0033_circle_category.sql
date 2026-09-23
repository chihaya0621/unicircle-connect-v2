-- =============================================================================
-- 0033: サークルの分野
-- =============================================================================
-- 「ボランティア系を探したい」ときに、検索語を当てるしかなかった。
-- 名前に「ボランティア」と入っていない団体（子ども食堂の手伝い、
-- 清掃活動など）は見つからない。分野を1つ持たせて、一覧で絞れるようにする。
--
-- 分野はアプリ側の一覧（lib/circle-categories.ts）と同じ値に限る。
-- 未設定（NULL）も許す。既存のサークルに一斉に付けることはしない。
-- =============================================================================

ALTER TABLE circles
  ADD COLUMN IF NOT EXISTS category TEXT;

ALTER TABLE circles DROP CONSTRAINT IF EXISTS circles_category_check;
ALTER TABLE circles ADD CONSTRAINT circles_category_check CHECK (
  category IS NULL OR category IN (
    'sports', 'music', 'culture', 'academic', 'volunteer', 'international', 'other'
  )
);

CREATE INDEX IF NOT EXISTS idx_circles_category ON circles(category);

COMMENT ON COLUMN circles.category IS
  '分野。一覧の絞り込みに使う。値は lib/circle-categories.ts と揃える。';


/** 分野を設定する（サークル管理者のみ）。NULL で未設定に戻す */
CREATE OR REPLACE FUNCTION public.set_circle_category(
  p_circle_id UUID,
  p_category  TEXT
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.app_is_circle_admin(p_circle_id) THEN
    RAISE EXCEPTION 'サークルの管理者のみ変更できます';
  END IF;

  -- 値の検査は CHECK 制約に任せる。ここで二重に持つと食い違う
  UPDATE public.circles
     SET category = nullif(btrim(coalesce(p_category, '')), '')
   WHERE id = p_circle_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_circle_category(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_circle_category(uuid, text) TO authenticated;
