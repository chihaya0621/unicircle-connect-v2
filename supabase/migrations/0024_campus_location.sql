-- =============================================================================
-- キャンパスに所在地を持たせる
-- =============================================================================
-- 0023 では都道府県を大学に持たせたが、これだと県をまたいで
-- キャンパスを構える大学が、片方の県からしか見つからない。
-- 「神奈川県」を選んだ人に、横浜キャンパスを持つ東京の大学が出てこない。
--
-- 大学の行を分けて「○○大学（横浜キャンパス）」という名前にする手もあるが、
-- それをすると同じ大学が複数行になり、サークル・職員・施設が
-- どちらにぶら下がるのかが決まらなくなる。
-- 大学は1行のまま、所在地をキャンパス側に持たせる。
-- 「○○大学（横浜キャンパス）」という見せ方は、画面で組み立てればよい。
--
-- universities.prefecture は残す。本部の所在地として意味があり、
-- キャンパスの所在地が未設定のときの既定値にも使う。
-- =============================================================================

ALTER TABLE campuses
  ADD COLUMN IF NOT EXISTS prefecture TEXT;

ALTER TABLE campuses DROP CONSTRAINT IF EXISTS campuses_prefecture_check;
ALTER TABLE campuses ADD CONSTRAINT campuses_prefecture_check
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

CREATE INDEX IF NOT EXISTS idx_campuses_prefecture ON campuses(prefecture);

COMMENT ON COLUMN campuses.prefecture IS
  'キャンパスの所在地。公開一覧はこちらで絞る。大学の prefecture は本部の所在地。';

-- 既存のキャンパスは、大学の所在地を引き継ぐ
UPDATE campuses c
   SET prefecture = u.prefecture
  FROM universities u
 WHERE c.university_id = u.id AND c.prefecture IS NULL;


-- -----------------------------------------------------------------------------
-- 管理関数に所在地を足す
-- -----------------------------------------------------------------------------
-- 引数が増えるので、多重定義にならないよう古い版を先に落とす。

DROP FUNCTION IF EXISTS public.upsert_campus(UUID, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.upsert_campus(
  p_id         UUID,
  p_name       TEXT,
  p_address    TEXT DEFAULT NULL,
  p_prefecture TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_university UUID := public.app_university_id();
  v_name       TEXT := btrim(coalesce(p_name, ''));
  v_pref       TEXT := nullif(btrim(coalesce(p_prefecture, '')), '');
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

  -- 所在地の指定が無ければ大学の所在地を引き継ぐ。
  -- 値の妥当性は CHECK 制約が受け持つ。
  IF v_pref IS NULL THEN
    SELECT prefecture INTO v_pref FROM public.universities WHERE id = v_university;
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.campuses (university_id, name, address, prefecture)
    VALUES (v_university, v_name, nullif(btrim(coalesce(p_address, '')), ''), v_pref)
    RETURNING id INTO v_id;
    RETURN v_id;
  END IF;

  UPDATE public.campuses
     SET name       = v_name,
         address    = nullif(btrim(coalesce(p_address, '')), ''),
         prefecture = v_pref
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

REVOKE EXECUTE ON FUNCTION public.upsert_campus(UUID, TEXT, TEXT, TEXT)
  FROM public, anon;
GRANT EXECUTE ON FUNCTION public.upsert_campus(UUID, TEXT, TEXT, TEXT)
  TO authenticated;
