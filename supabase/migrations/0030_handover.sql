-- =============================================================================
-- 代替わり（引き継ぎ）
-- =============================================================================
-- 最初に挙げた困りごとのうち、これだけが手つかずだった。
--   「先輩が卒業したら、名簿のオーナー権限ごと消えた」
--
-- 役職を変える RPC（0026 の set_circle_member_role）はすでにある。
-- しかしそれは「係を変える」操作であって、「代を継ぐ」ことではない。
-- 代替わりには、役職の移動のほかに次の3つが要る。
--
--   1. 相手の承諾。断れない引き継ぎは引き継ぎではない。役職の変更は
--      管理者が一方的にできるが、代表を押し付けられると困る
--   2. 引き継ぎメモ。次の代が最初に読む場所。口頭で消える情報を残す
--   3. 年度。いつの代なのかが分からないと、職員が「今年度まだ
--      代替わりしていないサークル」を把握できない
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. 年度
-- -----------------------------------------------------------------------------
-- 日本の大学の年度は4月はじまり。3月までは前年の年度として数える。

CREATE OR REPLACE FUNCTION public.app_term_year(p_at TIMESTAMPTZ DEFAULT now())
RETURNS INT
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE
    WHEN EXTRACT(MONTH FROM p_at AT TIME ZONE 'Asia/Tokyo') >= 4
      THEN EXTRACT(YEAR FROM p_at AT TIME ZONE 'Asia/Tokyo')::INT
    ELSE EXTRACT(YEAR FROM p_at AT TIME ZONE 'Asia/Tokyo')::INT - 1
  END;
$$;

ALTER TABLE circles
  ADD COLUMN IF NOT EXISTS term_year INT;

COMMENT ON COLUMN circles.term_year IS
  'いまの代が引き継いだ年度。NULL は一度も代替わりしていない（設立の代のまま）';


-- -----------------------------------------------------------------------------
-- 2. 引き継ぎの申し出
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS circle_handovers (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id    UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  -- 引き継ぐ側・継ぐ側。退会や卒業で users の行が消えても、
  -- 引き継ぎの記録そのものは残したいので SET NULL にする
  from_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  to_user_id   UUID REFERENCES users(id) ON DELETE SET NULL,
  from_name    TEXT NOT NULL,
  to_name      TEXT NOT NULL,
  -- 次の代が最初に読む申し送り
  note         TEXT,
  status       TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled')),
  term_year    INT  NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at   TIMESTAMPTZ
);

-- 申し出は同時に1件まで。複数走ると、どちらが通ったのか分からなくなる。
CREATE UNIQUE INDEX IF NOT EXISTS idx_handover_one_pending
  ON circle_handovers (circle_id) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_handover_circle
  ON circle_handovers (circle_id, created_at DESC);

-- 自分宛の申し出を探すため
CREATE INDEX IF NOT EXISTS idx_handover_to
  ON circle_handovers (to_user_id) WHERE status = 'pending';

ALTER TABLE circle_handovers ENABLE ROW LEVEL SECURITY;

-- 読めるのは、そのサークルのメンバーと、その大学の職員。
-- 申し送りには内輪の事情が書かれうるので、外には出さない。
DROP POLICY IF EXISTS circle_handovers_select ON circle_handovers;
CREATE POLICY circle_handovers_select ON circle_handovers
  FOR SELECT TO authenticated USING (
    public.app_is_circle_member(circle_id)
    OR EXISTS (
      SELECT 1 FROM public.circles c
       WHERE c.id = circle_id AND public.app_is_staff_of(c.university_id)
    )
  );


-- -----------------------------------------------------------------------------
-- 3. 引き継ぎを申し出る
-- -----------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.request_handover(UUID, UUID, TEXT);
CREATE OR REPLACE FUNCTION public.request_handover(
  p_circle_id UUID,
  p_to_user   UUID,
  p_note      TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_from   UUID := auth.uid();
  v_fname  TEXT;
  v_tname  TEXT;
  v_circle TEXT;
  v_id     UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.circle_members
     WHERE circle_id = p_circle_id AND user_id = v_from
       AND role = 'admin' AND status = 'active'
  ) THEN
    RAISE EXCEPTION '引き継げるのは、このサークルの管理者だけです';
  END IF;

  IF p_to_user = v_from THEN
    RAISE EXCEPTION '自分自身には引き継げません';
  END IF;

  -- 継ぐ相手は在籍しているメンバーに限る。外の人を代表に据えられると、
  -- 名簿に載っていない人がサークルを握ることになる。
  IF NOT EXISTS (
    SELECT 1 FROM public.circle_members
     WHERE circle_id = p_circle_id AND user_id = p_to_user AND status = 'active'
  ) THEN
    RAISE EXCEPTION '引き継ぎ先は、在籍しているメンバーから選んでください';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.circle_handovers
     WHERE circle_id = p_circle_id AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'すでに引き継ぎの申し出が出ています';
  END IF;

  SELECT name INTO v_fname FROM public.users WHERE id = v_from;
  SELECT name INTO v_tname FROM public.users WHERE id = p_to_user;
  SELECT name INTO v_circle FROM public.circles WHERE id = p_circle_id;

  INSERT INTO public.circle_handovers
    (circle_id, from_user_id, to_user_id, from_name, to_name, note, term_year)
  VALUES (
    p_circle_id, v_from, p_to_user,
    coalesce(v_fname, '不明'), coalesce(v_tname, '不明'),
    nullif(btrim(coalesce(p_note, '')), ''),
    public.app_term_year()
  )
  RETURNING id INTO v_id;

  PERFORM public.app_notify(
    p_to_user, 'request_received',
    format('%s の代表を引き継いでほしいと依頼がありました', coalesce(v_circle, 'サークル')),
    format('%s さんからの申し出です。受けるかどうかを選べます。', coalesce(v_fname, '管理者')),
    '/circles/' || p_circle_id::text
  );

  RETURN v_id;
END;
$$;


-- -----------------------------------------------------------------------------
-- 4. 申し出に答える
-- -----------------------------------------------------------------------------
-- 受けたときに起きること:
--   継ぐ人が管理者になり、譲る人は一般のメンバーに降りる。
--   サークルの年度が、申し出を出した年度に更新される。
--
-- 譲る人を退会させないのは、代表を降りたあとも在籍し続けるのが普通だから。
-- 抜けたいなら既存の leave_circle を使う。そのときは管理者が
-- 新代表に移っているので、「最後の管理者は抜けられない」にも引っかからない。

DROP FUNCTION IF EXISTS public.respond_handover(UUID, BOOLEAN);
CREATE OR REPLACE FUNCTION public.respond_handover(
  p_handover_id UUID,
  p_accept      BOOLEAN
)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  h        RECORD;
  v_circle TEXT;
BEGIN
  SELECT * INTO h FROM public.circle_handovers
   WHERE id = p_handover_id AND status = 'pending'
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'この申し出はすでに決着しています';
  END IF;

  IF h.to_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION '答えられるのは、指名された本人だけです';
  END IF;

  SELECT name INTO v_circle FROM public.circles WHERE id = h.circle_id;

  IF NOT p_accept THEN
    UPDATE public.circle_handovers
       SET status = 'declined', decided_at = now()
     WHERE id = p_handover_id;

    PERFORM public.app_notify(
      h.from_user_id, 'approval_result',
      format('%s の引き継ぎは見送られました', coalesce(v_circle, 'サークル')),
      format('%s さんが申し出を受けませんでした。', h.to_name),
      '/circles/' || h.circle_id::text
    );
    RETURN 'declined';
  END IF;

  UPDATE public.circle_members
     SET role = 'admin'
   WHERE circle_id = h.circle_id AND user_id = h.to_user_id;

  UPDATE public.circle_members
     SET role = 'member'
   WHERE circle_id = h.circle_id AND user_id = h.from_user_id;

  UPDATE public.circles
     SET term_year = h.term_year
   WHERE id = h.circle_id;

  UPDATE public.circle_handovers
     SET status = 'accepted', decided_at = now()
   WHERE id = p_handover_id;

  PERFORM public.app_notify(
    h.from_user_id, 'approval_result',
    format('%s の引き継ぎが成立しました', coalesce(v_circle, 'サークル')),
    format('%s さんが代表になりました。', h.to_name),
    '/circles/' || h.circle_id::text
  );

  RETURN 'accepted';
END;
$$;


-- -----------------------------------------------------------------------------
-- 5. 申し出を取り下げる
-- -----------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.cancel_handover(UUID);
CREATE OR REPLACE FUNCTION public.cancel_handover(p_handover_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE h RECORD;
BEGIN
  SELECT * INTO h FROM public.circle_handovers
   WHERE id = p_handover_id AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'この申し出はすでに決着しています';
  END IF;

  IF h.from_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION '取り下げられるのは、申し出た本人だけです';
  END IF;

  UPDATE public.circle_handovers
     SET status = 'cancelled', decided_at = now()
   WHERE id = p_handover_id;
END;
$$;


-- -----------------------------------------------------------------------------
-- 6. 実行権限
-- -----------------------------------------------------------------------------

DO $$
DECLARE f TEXT;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'request_handover(uuid,uuid,text)',
    'respond_handover(uuid,boolean)',
    'cancel_handover(uuid)'
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
  public.app_term_year()                                        AS 今年度,
  (SELECT count(*) FROM circles WHERE term_year IS NULL)         AS 未代替わり,
  (SELECT count(*) FROM circle_handovers WHERE status='pending') AS 申し出中;
