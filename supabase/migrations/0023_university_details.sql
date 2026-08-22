-- =============================================================================
-- 大学マスタの拡充とキャンパス
-- =============================================================================
-- 多くの大学が載ることを想定すると、公開のサークル一覧に全大学を
-- 平坦に並べるのは成り立たない。都道府県 → 大学 → サークル と
-- 辿れるようにするため、大学に所在地を持たせる。
--
-- あわせてキャンパスを別テーブルにする。複数キャンパスを持つ大学では、
-- サークルの拠点がどこなのかが名前だけでは分からないため。
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. 大学の属性
-- -----------------------------------------------------------------------------
-- prefecture は表記ゆれがあると絞り込みが壊れるので、47都道府県に限る。
-- name_kana は並び順のため。漢字の localeCompare は読みを当てられず、
-- 「青空大学」と「海原大学」の前後すら安定しない。

ALTER TABLE universities
  ADD COLUMN IF NOT EXISTS prefecture  TEXT,
  ADD COLUMN IF NOT EXISTS name_kana   TEXT,
  ADD COLUMN IF NOT EXISTS website_url TEXT;

ALTER TABLE universities DROP CONSTRAINT IF EXISTS universities_prefecture_check;
ALTER TABLE universities ADD CONSTRAINT universities_prefecture_check
  CHECK (prefecture IS NULL OR prefecture IN (
    '北海道','青森県','岩手県','宮城県','秋田県','山形県','福島県',
    '茨城県','栃木県','群馬県','埼玉県','千葉県','東京都','神奈川県',
    '新潟県','富山県','石川県','福井県','山梨県','長野県',
    '岐阜県','静岡県','愛知県','三重県',
    '滋賀県','京都府','大阪府','兵庫県','奈良県','和歌山県',
    '鳥取県','島根県','岡山県','広島県','山口県',
    '徳島県','香川県','愛媛県','高知県',
    '福岡県','佐賀県','長崎県','熊本県','大分県','宮崎県','鹿児島県','沖縄県'
  ));

CREATE INDEX IF NOT EXISTS idx_universities_prefecture
  ON universities(prefecture);

COMMENT ON COLUMN universities.prefecture  IS '所在地の都道府県。公開一覧の絞り込みに使う。';
COMMENT ON COLUMN universities.name_kana   IS '並び順のための読み。';
COMMENT ON COLUMN universities.website_url IS '公式サイト。公開ページから案内する。';


-- -----------------------------------------------------------------------------
-- 2. キャンパス
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS campuses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  address       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (university_id, name)
);

CREATE INDEX IF NOT EXISTS idx_campuses_university ON campuses(university_id);

COMMENT ON TABLE campuses IS
  '大学のキャンパス。サークルの拠点を示すのに使う。管理するのはその大学の職員。';

ALTER TABLE campuses ENABLE ROW LEVEL SECURITY;

-- 大学と同じく誰でも読める。どこで活動しているかは公開情報。
DROP POLICY IF EXISTS campuses_select ON campuses;
CREATE POLICY campuses_select ON campuses FOR SELECT USING (true);

GRANT SELECT ON campuses TO anon, authenticated;


-- -----------------------------------------------------------------------------
-- 3. サークルの拠点
-- -----------------------------------------------------------------------------
-- 「そのサークルの大学のキャンパスか」は複合外部キーでも表せるが、
-- ON DELETE SET NULL が両方の列を NULL にしてしまい、
-- キャンパスを消すとサークルの所属大学まで外れる。
-- 単純な外部キーにして、大学の一致は書き込み口の関数で担保する。
-- circles には UPDATE ポリシーが無く、書き込めるのは関数だけなので、
-- 実質的にはここが唯一の入口になる。

ALTER TABLE circles
  ADD COLUMN IF NOT EXISTS campus_id UUID REFERENCES campuses(id) ON DELETE SET NULL;

COMMENT ON COLUMN circles.campus_id IS
  '主な活動拠点。同じ大学のキャンパスであることは update_circle_public_profile が確認する。';


-- -----------------------------------------------------------------------------
-- 4. キャンパスの管理（その大学の職員のみ）
-- -----------------------------------------------------------------------------

/** 追加・更新。p_id が NULL なら追加。大学は職員自身の所属で固定する。 */
CREATE OR REPLACE FUNCTION public.upsert_campus(
  p_id      UUID,
  p_name    TEXT,
  p_address TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_university UUID := public.app_university_id();
  v_name       TEXT := btrim(coalesce(p_name, ''));
  v_id         UUID;
BEGIN
  IF public.app_role() IS DISTINCT FROM 'staff' OR v_university IS NULL THEN
    RAISE EXCEPTION 'キャンパスを管理できるのは大学職員のみです';
  END IF;
  IF v_name = '' THEN
    RAISE EXCEPTION 'キャンパス名を入力してください';
  END IF;
  IF char_length(v_name) > 60 THEN
    RAISE EXCEPTION 'キャンパス名は60文字までです';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.campuses (university_id, name, address)
    VALUES (v_university, v_name, nullif(btrim(coalesce(p_address, '')), ''))
    RETURNING id INTO v_id;
    RETURN v_id;
  END IF;

  UPDATE public.campuses
     SET name    = v_name,
         address = nullif(btrim(coalesce(p_address, '')), '')
   WHERE id = p_id
     -- 他大学のキャンパスは触れない
     AND university_id = v_university
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'キャンパスが見つかりません';
  END IF;
  RETURN v_id;
END;
$$;

/** 削除。参照しているサークルの campus_id は外部キーで NULL に戻る。 */
CREATE OR REPLACE FUNCTION public.delete_campus(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_university UUID := public.app_university_id();
BEGIN
  IF public.app_role() IS DISTINCT FROM 'staff' OR v_university IS NULL THEN
    RAISE EXCEPTION 'キャンパスを管理できるのは大学職員のみです';
  END IF;

  DELETE FROM public.campuses
   WHERE id = p_id AND university_id = v_university;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.upsert_campus(UUID, TEXT, TEXT) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.delete_campus(UUID)             FROM public, anon;
GRANT EXECUTE ON FUNCTION public.upsert_campus(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_campus(UUID)             TO authenticated;


-- -----------------------------------------------------------------------------
-- 5. 公開プロフィールに拠点を足す
-- -----------------------------------------------------------------------------
-- 引数が増えるので、多重定義にならないよう古い版を先に落とす。

DROP FUNCTION IF EXISTS public.update_circle_public_profile(
  UUID, BOOLEAN, TEXT, TEXT, TEXT
);

CREATE OR REPLACE FUNCTION public.update_circle_public_profile(
  p_circle_id UUID,
  p_listed    BOOLEAN,
  p_intro     TEXT DEFAULT NULL,
  p_schedule  TEXT DEFAULT NULL,
  p_contact   TEXT DEFAULT NULL,
  p_campus_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_university UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'ログインが必要です';
  END IF;

  IF NOT public.app_is_circle_admin(p_circle_id) THEN
    RAISE EXCEPTION 'このサークルの管理者のみ編集できます';
  END IF;

  IF char_length(coalesce(p_intro, '')) > 1000 THEN
    RAISE EXCEPTION '活動紹介は1000文字までです';
  END IF;
  IF char_length(coalesce(p_schedule, '')) > 200 THEN
    RAISE EXCEPTION '活動日・場所は200文字までです';
  END IF;
  IF char_length(coalesce(p_contact, '')) > 200 THEN
    RAISE EXCEPTION '連絡先は200文字までです';
  END IF;

  SELECT university_id INTO v_university FROM public.circles WHERE id = p_circle_id;

  -- よその大学のキャンパスを拠点にはできない
  IF p_campus_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.campuses c
     WHERE c.id = p_campus_id AND c.university_id = v_university
  ) THEN
    RAISE EXCEPTION 'そのキャンパスは選べません';
  END IF;

  UPDATE public.circles
     SET public_listed   = coalesce(p_listed, TRUE),
         public_intro    = nullif(btrim(coalesce(p_intro, '')), ''),
         public_schedule = nullif(btrim(coalesce(p_schedule, '')), ''),
         public_contact  = nullif(btrim(coalesce(p_contact, '')), ''),
         campus_id       = p_campus_id
   WHERE id = p_circle_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_circle_public_profile(
  UUID, BOOLEAN, TEXT, TEXT, TEXT, UUID) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.update_circle_public_profile(
  UUID, BOOLEAN, TEXT, TEXT, TEXT, UUID) TO authenticated;


-- -----------------------------------------------------------------------------
-- 6. 既存データの補完
-- -----------------------------------------------------------------------------
-- 都道府県が空だと、公開の一覧で全大学が「未設定」に落ちて絞り込みの
-- 意味が無くなる。デモ用の大学にだけ、未設定のときに限って埋める。
-- 実運用の大学を上書きしないよう、ID を指定して当てている。

UPDATE universities SET prefecture = v.pref, name_kana = v.kana
  FROM (VALUES
    ('a0000000-0000-4000-8000-000000000001'::uuid, '東京都',   'あおぞらだいがく'),
    ('a0000000-0000-4000-8000-000000000002'::uuid, '神奈川県', 'うなばらだいがく'),
    ('a0000000-0000-4000-8000-000000000003'::uuid, '東京都',   'やまてこうかだいがく'),
    ('a0000000-0000-4000-8000-000000000004'::uuid, '大阪府',   'さくらがおかだいがく'),
    ('a0000000-0000-4000-8000-000000000005'::uuid, '北海道',   'ほくとだいがく'),
    ('a0000000-0000-4000-8000-000000000006'::uuid, '福岡県',   'せいりょうがくいんだいがく')
  ) AS v(id, pref, kana)
 WHERE universities.id = v.id AND universities.prefecture IS NULL;

-- 各大学に本部キャンパスを1つ用意しておく。複数拠点の大学は職員が足す。
INSERT INTO campuses (university_id, name)
SELECT u.id, '本部キャンパス'
  FROM universities u
 WHERE NOT EXISTS (SELECT 1 FROM campuses c WHERE c.university_id = u.id);
