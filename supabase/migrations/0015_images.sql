-- =============================================================================
-- 画像（サークル・イベント）
-- =============================================================================
-- Supabase Storage を使う。バケットの作成もポリシーも SQL で書けるので、
-- ダッシュボードでの手作業は不要。
--
-- 【公開バケットにしている理由】
--   サークルのロゴやイベントのフライヤーは元々公開される性質のもので、
--   署名付きURLにすると有効期限の管理が必要になる。
--   ただし URL を知っていれば誰でも参照できるため、機微な画像は
--   載せない前提。学内限定イベントの画像も同様。
--
-- 【書き込みの制御】
--   他のテーブルは RPC を唯一の書き込み経路にしているが、Storage への
--   アップロードは Storage API を直接叩くしかない。そのため
--   storage.objects に INSERT / UPDATE / DELETE のポリシーを書き、
--   パスから対象を判別して権限を確認する。
--
-- 【パスの規約】
--   circles/<circle_id>/<ファイル名>
--   events/<event_id>/<ファイル名>
-- =============================================================================


-- -----------------------------------------------------------------------------
-- バケット
-- -----------------------------------------------------------------------------
-- 5MB / 画像形式のみ。Storage 側で弾けるものはアプリに到達させない。
-- -----------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'images', 'images', true, 5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;


-- -----------------------------------------------------------------------------
-- 画像を保存する列
-- -----------------------------------------------------------------------------
-- URL ではなくバケット内のパスを持つ。プロジェクトの URL が変わっても
-- 追随でき、公開／非公開を後から切り替えても壊れないため。
-- -----------------------------------------------------------------------------

ALTER TABLE circles ADD COLUMN IF NOT EXISTS image_path TEXT;
ALTER TABLE events  ADD COLUMN IF NOT EXISTS image_path TEXT;

COMMENT ON COLUMN circles.image_path IS
  'images バケット内のパス。例: circles/<id>/logo.png';


-- -----------------------------------------------------------------------------
-- パスから書き込み権限を判定する
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.app_can_write_image(p_path TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_kind TEXT;
  v_id   UUID;
BEGIN
  v_kind := split_part(p_path, '/', 1);

  -- 不正な UUID でも例外にせず、単に権限なしとして扱う
  BEGIN
    v_id := split_part(p_path, '/', 2)::uuid;
  EXCEPTION WHEN others THEN
    RETURN false;
  END;

  IF v_kind = 'circles' THEN
    RETURN public.app_is_circle_admin(v_id);
  ELSIF v_kind = 'events' THEN
    RETURN public.app_can_manage_event(v_id);
  END IF;

  RETURN false;
END;
$$;


-- -----------------------------------------------------------------------------
-- Storage のポリシー
-- -----------------------------------------------------------------------------
-- 公開バケットなので読み取りは誰でも可。書き込みのみ制限する。
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS images_read   ON storage.objects;
DROP POLICY IF EXISTS images_insert ON storage.objects;
DROP POLICY IF EXISTS images_update ON storage.objects;
DROP POLICY IF EXISTS images_delete ON storage.objects;

CREATE POLICY images_read ON storage.objects
  FOR SELECT USING (bucket_id = 'images');

CREATE POLICY images_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'images' AND public.app_can_write_image(name));

CREATE POLICY images_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'images' AND public.app_can_write_image(name))
  WITH CHECK (bucket_id = 'images' AND public.app_can_write_image(name));

CREATE POLICY images_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'images' AND public.app_can_write_image(name));


-- -----------------------------------------------------------------------------
-- 画像パスの登録（アップロード後に呼ぶ）
-- -----------------------------------------------------------------------------
-- パスの妥当性も確認する。アップロード先とは別の対象を指す値を
-- 書き込めないようにするため。
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_circle_image(
  p_circle_id UUID,
  p_path      TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.app_is_circle_admin(p_circle_id) THEN
    RAISE EXCEPTION '画像を設定できるのはサークル管理者のみです';
  END IF;

  IF p_path IS NOT NULL
     AND p_path NOT LIKE 'circles/' || p_circle_id::text || '/%' THEN
    RAISE EXCEPTION '画像のパスが不正です';
  END IF;

  UPDATE public.circles SET image_path = p_path WHERE id = p_circle_id;
END;
$$;


CREATE OR REPLACE FUNCTION public.set_event_image(
  p_event_id UUID,
  p_path     TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.app_can_manage_event(p_event_id) THEN
    RAISE EXCEPTION '画像を設定できるのはイベントの主催者のみです';
  END IF;

  IF p_path IS NOT NULL
     AND p_path NOT LIKE 'events/' || p_event_id::text || '/%' THEN
    RAISE EXCEPTION '画像のパスが不正です';
  END IF;

  UPDATE public.events SET image_path = p_path WHERE id = p_event_id;
END;
$$;
