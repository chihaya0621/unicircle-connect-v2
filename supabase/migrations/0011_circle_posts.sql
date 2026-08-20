-- =============================================================================
-- サークル掲示板
-- =============================================================================
-- サークル内の連絡・相談の場。所属メンバーだけが読み書きできる。
--
-- 「お知らせ」と「掲示板」を別テーブルにはしない。実態は同じ投稿で、
-- 違いは「上に固定するかどうか」だけなので、is_pinned で表現する。
-- 固定できるのは管理者のみ。
--
-- 【権限】
--   閲覧 … そのサークルの active メンバーのみ
--   投稿 … 同上（連絡が管理者からの一方通行にならないようにする）
--   固定 … 管理者のみ
--   削除 … 投稿者本人、または管理者
-- =============================================================================

CREATE TABLE IF NOT EXISTS circle_posts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id  UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  -- 投稿者が退会・削除されても投稿は残す（連絡の履歴が欠けると困るため）
  author_id  UUID REFERENCES users(id) ON DELETE SET NULL,
  body       TEXT NOT NULL CHECK (btrim(body) <> ''),
  is_pinned  BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 一覧は「サークルごとに、固定を先頭、あとは新しい順」で引く
CREATE INDEX IF NOT EXISTS idx_circle_posts_circle
  ON circle_posts(circle_id, is_pinned DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_circle_posts_author ON circle_posts(author_id);

ALTER TABLE circle_posts ENABLE ROW LEVEL SECURITY;

-- 読み取りのみポリシーを作る。書き込みは RPC 経由に限る（0008 の方針）。
DROP POLICY IF EXISTS circle_posts_select ON circle_posts;
CREATE POLICY circle_posts_select ON circle_posts
  FOR SELECT TO authenticated USING (
    public.app_is_circle_member(circle_id)
  );


-- -----------------------------------------------------------------------------
-- 投稿
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_circle_post(
  p_circle_id UUID,
  p_body      TEXT,
  p_pinned    BOOLEAN DEFAULT false
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid  UUID := auth.uid();
  v_body TEXT;
  v_id   UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'ログインが必要です';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.circle_members
    WHERE circle_id = p_circle_id AND user_id = v_uid AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'このサークルのメンバーのみ投稿できます';
  END IF;

  v_body := nullif(btrim(coalesce(p_body, '')), '');
  IF v_body IS NULL THEN
    RAISE EXCEPTION '本文を入力してください';
  END IF;
  IF length(v_body) > 2000 THEN
    RAISE EXCEPTION '本文は2000文字以内で入力してください';
  END IF;

  -- 固定は管理者だけの操作。メンバーが指定しても無視する。
  IF p_pinned AND NOT EXISTS (
    SELECT 1 FROM public.circle_members
    WHERE circle_id = p_circle_id AND user_id = v_uid
      AND role = 'admin' AND status = 'active'
  ) THEN
    p_pinned := false;
  END IF;

  INSERT INTO public.circle_posts (circle_id, author_id, body, is_pinned)
  VALUES (p_circle_id, v_uid, v_body, coalesce(p_pinned, false))
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;


-- -----------------------------------------------------------------------------
-- 削除（投稿者本人、または管理者）
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.delete_circle_post(p_post_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid    UUID := auth.uid();
  v_author UUID;
  v_circle UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'ログインが必要です';
  END IF;

  SELECT author_id, circle_id INTO v_author, v_circle
  FROM public.circle_posts WHERE id = p_post_id;

  IF v_circle IS NULL THEN
    RAISE EXCEPTION '投稿が見つかりません';
  END IF;

  IF v_author IS DISTINCT FROM v_uid
     AND NOT EXISTS (
       SELECT 1 FROM public.circle_members
       WHERE circle_id = v_circle AND user_id = v_uid
         AND role = 'admin' AND status = 'active'
     ) THEN
    RAISE EXCEPTION 'この投稿を削除する権限がありません';
  END IF;

  DELETE FROM public.circle_posts WHERE id = p_post_id;
END;
$$;


-- -----------------------------------------------------------------------------
-- 固定の切り替え（管理者のみ）
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_post_pinned(
  p_post_id UUID,
  p_pinned  BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid    UUID := auth.uid();
  v_circle UUID;
BEGIN
  SELECT circle_id INTO v_circle FROM public.circle_posts WHERE id = p_post_id;
  IF v_circle IS NULL THEN
    RAISE EXCEPTION '投稿が見つかりません';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.circle_members
    WHERE circle_id = v_circle AND user_id = v_uid
      AND role = 'admin' AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'お知らせに設定できるのはサークル管理者のみです';
  END IF;

  UPDATE public.circle_posts SET is_pinned = coalesce(p_pinned, false)
  WHERE id = p_post_id;
END;
$$;
