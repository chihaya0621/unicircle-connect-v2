-- =============================================================================
-- 印影と、承認記録の連なり
-- =============================================================================
-- 紙の決裁では、誰が通したかは「印影」で分かる。氏名の文字列より、
-- 押された跡そのものが記録になっている。同じものをこちらにも持たせる。
--
-- あわせて、承認の記録を1件ずつ前の記録のハッシュで繋ぐ。途中の1行を
-- 書き換えると、そこから後ろのハッシュが合わなくなるので気づける。
-- 公開鍵の署名までは踏み込まない。ここで防ぎたいのは「後から静かに
-- 書き換えられること」であって、なりすましの否認防止ではないため。
-- 本気でやるなら職員ごとの鍵が要るが、それは鍵の配布と失効の話になり、
-- 大学の運用に乗るかどうかから決める必要がある。
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. 職員の印影
-- -----------------------------------------------------------------------------
-- 画像は持たない。文字と形だけを持って、描画は画面側でやる。
-- 画像にすると、保存・配信・差し替えの経路が増えるわりに、
-- 表示できる内容は「文字が入った丸」から変わらない。

ALTER TABLE staff_profiles
  ADD COLUMN IF NOT EXISTS seal_text TEXT;

ALTER TABLE staff_profiles
  ADD COLUMN IF NOT EXISTS seal_shape TEXT NOT NULL DEFAULT 'circle';

ALTER TABLE staff_profiles DROP CONSTRAINT IF EXISTS staff_profiles_seal_text_check;
ALTER TABLE staff_profiles ADD CONSTRAINT staff_profiles_seal_text_check
  CHECK (seal_text IS NULL OR char_length(btrim(seal_text)) BETWEEN 1 AND 4);

ALTER TABLE staff_profiles DROP CONSTRAINT IF EXISTS staff_profiles_seal_shape_check;
ALTER TABLE staff_profiles ADD CONSTRAINT staff_profiles_seal_shape_check
  CHECK (seal_shape IN ('circle', 'square'));

COMMENT ON COLUMN staff_profiles.seal_text IS
  '印影に彫る文字（1〜4字）。未設定なら氏名の頭2字を使う';


-- -----------------------------------------------------------------------------
-- 2. 承認の記録に、印影と連なりを足す
-- -----------------------------------------------------------------------------

-- 押した時点の印影。氏名と同じく、後から職員が印影を変えても
-- 過去に押した跡は変わらないようにする。
ALTER TABLE approvals ADD COLUMN IF NOT EXISTS seal_text  TEXT;
ALTER TABLE approvals ADD COLUMN IF NOT EXISTS seal_shape TEXT;

-- 連なり。prev_hash は同じ案件の1つ前の row_hash。
ALTER TABLE approvals ADD COLUMN IF NOT EXISTS prev_hash TEXT;
ALTER TABLE approvals ADD COLUMN IF NOT EXISTS row_hash  TEXT;

COMMENT ON COLUMN approvals.row_hash IS
  '前の記録のハッシュを含めて計算する。1行書き換えると後続が合わなくなる';


-- -----------------------------------------------------------------------------
-- 3. ハッシュの計算
-- -----------------------------------------------------------------------------
-- sha256(bytea) は PostgreSQL 11 以降の組み込み。pgcrypto を入れなくて済む。
--
-- 区切りに \x1f（情報区切り文字）を使う。単純に連結すると、
-- 「氏名="AB" 所見="C"」と「氏名="A" 所見="BC"」が同じ文字列になり、
-- 違う記録から同じハッシュが出てしまう。

CREATE OR REPLACE FUNCTION public.app_approval_hash(
  p_prev        TEXT,
  p_target_type TEXT,
  p_target_id   UUID,
  p_approver    UUID,
  p_name        TEXT,
  p_decision    TEXT,
  p_comment     TEXT,
  p_at          TIMESTAMPTZ
)
RETURNS TEXT
LANGUAGE sql IMMUTABLE
AS $$
  SELECT encode(
    sha256(convert_to(
      concat_ws(
        E'\x1f',
        coalesce(p_prev, ''),
        p_target_type,
        p_target_id::text,
        coalesce(p_approver::text, ''),
        p_name,
        p_decision,
        coalesce(p_comment, ''),
        -- 表記ゆれでハッシュが変わらないよう、時刻は UTC の固定書式に寄せる
        to_char(p_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
      ),
      'UTF8'
    )),
    'hex'
  );
$$;


-- 挿入のたびに、同じ案件の直前の記録を見て連なりを作る。
-- アプリ側で計算すると、RPC を通らない経路（将来の管理作業など）で
-- 連なりが切れる。データベース側に置いて、入り口を問わず必ず繋がるようにする。
CREATE OR REPLACE FUNCTION public.app_approvals_chain()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_prev TEXT;
BEGIN
  SELECT row_hash INTO v_prev
    FROM public.approvals
   WHERE target_type = NEW.target_type
     AND target_id   = NEW.target_id
   ORDER BY created_at DESC, id DESC
   LIMIT 1;

  NEW.prev_hash := v_prev;
  NEW.row_hash  := public.app_approval_hash(
    v_prev, NEW.target_type, NEW.target_id, NEW.approver_id,
    NEW.approver_name, NEW.decision, NEW.comment, NEW.created_at
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS approvals_chain ON approvals;
CREATE TRIGGER approvals_chain
  BEFORE INSERT ON approvals
  FOR EACH ROW EXECUTE FUNCTION public.app_approvals_chain();


-- -----------------------------------------------------------------------------
-- 4. 連なりの検証
-- -----------------------------------------------------------------------------
-- 案件ごとに、先頭から順に計算し直して突き合わせる。
-- 画面から呼んで「この決裁は改ざんされていない」と出すために使う。

CREATE OR REPLACE FUNCTION public.verify_approval_chain(
  p_target_type TEXT,
  p_target_id   UUID
)
RETURNS TABLE (ok BOOLEAN, checked INT, broken_at TIMESTAMPTZ)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  r      RECORD;
  v_prev TEXT := NULL;
  v_calc TEXT;
  v_n    INT := 0;
BEGIN
  -- SECURITY DEFINER なので RLS を迂回する。対象そのものを読める人だけに
  -- 答えるよう、ここで可視性を確かめる（approvals_select と同じ条件）。
  IF p_target_type = 'reservation' THEN
    IF NOT EXISTS (SELECT 1 FROM public.facility_reservations WHERE id = p_target_id) THEN
      RAISE EXCEPTION '対象が見つかりません';
    END IF;
  ELSE
    IF NOT EXISTS (SELECT 1 FROM public.circles WHERE id = p_target_id) THEN
      RAISE EXCEPTION '対象が見つかりません';
    END IF;
  END IF;

  FOR r IN
    SELECT * FROM public.approvals
     WHERE target_type = p_target_type AND target_id = p_target_id
     ORDER BY created_at, id
  LOOP
    v_n := v_n + 1;
    v_calc := public.app_approval_hash(
      v_prev, r.target_type, r.target_id, r.approver_id,
      r.approver_name, r.decision, r.comment, r.created_at
    );
    IF r.row_hash IS DISTINCT FROM v_calc OR r.prev_hash IS DISTINCT FROM v_prev THEN
      RETURN QUERY SELECT false, v_n, r.created_at;
      RETURN;
    END IF;
    v_prev := r.row_hash;
  END LOOP;

  RETURN QUERY SELECT true, v_n, NULL::TIMESTAMPTZ;
END;
$$;


-- -----------------------------------------------------------------------------
-- 5. 印影の設定
-- -----------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.update_my_seal(TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.update_my_seal(
  p_text  TEXT,
  p_shape TEXT
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_text TEXT := nullif(btrim(coalesce(p_text, '')), '');
BEGIN
  IF public.app_role() <> 'staff' THEN
    RAISE EXCEPTION '印影を持てるのは職員だけです';
  END IF;

  IF v_text IS NOT NULL AND char_length(v_text) > 4 THEN
    RAISE EXCEPTION '印影に彫れるのは4字までです';
  END IF;

  IF coalesce(p_shape, 'circle') NOT IN ('circle', 'square') THEN
    RAISE EXCEPTION '印影の形が不正です';
  END IF;

  UPDATE public.staff_profiles
     SET seal_text  = v_text,
         seal_shape = coalesce(p_shape, 'circle')
   WHERE user_id = auth.uid();
END;
$$;


-- -----------------------------------------------------------------------------
-- 6. 押印のときに印影を焼き付ける
-- -----------------------------------------------------------------------------
-- 引数は変わらないので置き換えで済む。SECURITY DEFINER は明示し直す
-- （0008 が ALTER で揃えているが、書き換えると INVOKER に戻るため）。

CREATE OR REPLACE FUNCTION public.app_record_approval(
  p_target_type TEXT,
  p_target_id   UUID,
  p_approve     BOOLEAN,
  p_required    INT,
  p_comment     TEXT
)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_name  TEXT;
  v_seal  TEXT;
  v_shape TEXT;
  v_count INT;
BEGIN
  SELECT u.name, s.seal_text, s.seal_shape
    INTO v_name, v_seal, v_shape
    FROM public.users u
    LEFT JOIN public.staff_profiles s ON s.user_id = u.id
   WHERE u.id = auth.uid();

  INSERT INTO public.approvals
    (target_type, target_id, approver_id, approver_name,
     decision, comment, seal_text, seal_shape)
  VALUES (
    p_target_type, p_target_id, auth.uid(), coalesce(v_name, '不明'),
    CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
    nullif(btrim(coalesce(p_comment, '')), ''),
    -- 印影を決めていない職員でも押せる。氏名の頭2字を彫った認印を渡す。
    coalesce(v_seal, left(coalesce(v_name, '印'), 2)),
    coalesce(v_shape, 'circle')
  )
  ON CONFLICT (target_type, target_id, approver_id) DO NOTHING;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'すでにこの案件を処理しています';
  END IF;

  IF NOT p_approve THEN
    RETURN 'rejected';
  END IF;

  SELECT count(*) INTO v_count
    FROM public.approvals
   WHERE target_type = p_target_type
     AND target_id = p_target_id
     AND decision = 'approved';

  RETURN CASE WHEN v_count >= p_required THEN 'approved' ELSE 'pending' END;
END;
$$;


-- -----------------------------------------------------------------------------
-- 7. 既存の記録に連なりを作る
-- -----------------------------------------------------------------------------
-- 0029 より前に押された記録は row_hash も印影も持っていない。
-- そのままだと検証が全部失敗し、承認欄も空のままになる。
-- いまの内容で一度だけ計算し、印影は氏名の頭2字で補う。
-- （遡って改ざんを検知できるわけではない。ここから先を守るための起点）

-- 印影はハッシュの計算に含めないので、先に埋めても連なりに影響しない
UPDATE public.approvals
   SET seal_text  = left(approver_name, 2),
       seal_shape = 'circle'
 WHERE seal_text IS NULL;

DO $$
DECLARE
  t      RECORD;
  r      RECORD;
  v_prev TEXT;
BEGIN
  FOR t IN
    SELECT DISTINCT target_type, target_id FROM public.approvals WHERE row_hash IS NULL
  LOOP
    v_prev := NULL;
    FOR r IN
      SELECT * FROM public.approvals
       WHERE target_type = t.target_type AND target_id = t.target_id
       ORDER BY created_at, id
    LOOP
      UPDATE public.approvals
         SET prev_hash = v_prev,
             row_hash  = public.app_approval_hash(
               v_prev, r.target_type, r.target_id, r.approver_id,
               r.approver_name, r.decision, r.comment, r.created_at)
       WHERE id = r.id
       RETURNING row_hash INTO v_prev;
    END LOOP;
  END LOOP;
END;
$$;


-- -----------------------------------------------------------------------------
-- 8. 実行権限
-- -----------------------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION public.app_approval_hash(TEXT, TEXT, UUID, UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ)
  FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.app_record_approval(TEXT, UUID, BOOLEAN, INT, TEXT)
  FROM public, anon, authenticated;

DO $$
DECLARE f TEXT;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'update_my_seal(text,text)',
    'verify_approval_chain(text,uuid)'
  ] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM public, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END;
$$;


-- -----------------------------------------------------------------------------
-- 確認
-- -----------------------------------------------------------------------------

SELECT
  (SELECT count(*) FROM approvals)                         AS 承認の記録,
  (SELECT count(*) FROM approvals WHERE row_hash IS NOT NULL) AS 連なり済み,
  (SELECT count(*) FROM approvals WHERE seal_text IS NOT NULL) AS 印影あり;
