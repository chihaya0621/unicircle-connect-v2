-- =============================================================================
-- 0036: サークル協賛
-- =============================================================================
-- 企業は、学生に自社を知ってもらいたい。サークルは、遠征や機材、
-- 発表会の費用が足りない。いまの企業のアカウントは、サークルとイベントを
-- 見るだけで、学生の活動と関わる手段が無かった。
--
-- 流れ:
--   1. サークルの管理者が、協賛の募集を出す（使い道・目標額・お返し・期限）
--   2. その大学の職員が中身を確かめて、判子を押す（承認）。募集は大学の
--      名前とともに外へ出るので、却下もできる
--   3. 企業（一般のアカウント）が、公開された募集に申し込む
--   4. サークルの管理者が申し込みを受けると成立し、サークルのページに
--      協賛企業の名前が出る
--
-- お金のやり取りはアプリの外で行う。ここで扱うのは、募集・確認・申し込み・
-- 成立の記録まで。申し込みの金額は、当事者（企業・サークルの管理者・
-- 大学の職員）にだけ見せる。外に出すのは企業の名前だけ。
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. 募集
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS sponsorship_requests (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id    UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  title        TEXT NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 60),
  -- 何に使うか。企業がいちばん知りたいところ
  purpose      TEXT NOT NULL CHECK (char_length(btrim(purpose)) BETWEEN 1 AND 1000),
  -- 目標額（円）。決めていなければ NULL
  amount_goal  INT CHECK (amount_goal IS NULL OR amount_goal BETWEEN 1000 AND 10000000),
  -- 協賛へのお返し。ロゴの掲載、イベントでの紹介など
  returns      TEXT CHECK (returns IS NULL OR char_length(returns) <= 500),
  deadline     DATE NOT NULL,
  -- pending: 大学の確認待ち / open: 募集中 / rejected: 大学が見送った /
  -- closed: サークルが締め切った
  status       TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'open', 'rejected', 'closed')),
  created_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at   TIMESTAMPTZ,
  closed_at    TIMESTAMPTZ,
  -- 確かめた職員の名前と印影の写し。承認の記録（approvals）は大学の外の人に
  -- 読ませないので、「大学が確かめた」ことを募集に写して見せる
  checked_by_name    TEXT,
  checked_seal_text  TEXT,
  checked_seal_shape TEXT
               CHECK (checked_seal_shape IS NULL OR checked_seal_shape IN ('circle', 'square'))
);

CREATE INDEX IF NOT EXISTS idx_sponsorship_requests_circle
  ON sponsorship_requests (circle_id, created_at DESC);

-- 公開の一覧は「募集中で締め切り前」を締め切りの近い順に出す
CREATE INDEX IF NOT EXISTS idx_sponsorship_requests_open
  ON sponsorship_requests (deadline) WHERE status = 'open';

ALTER TABLE sponsorship_requests ENABLE ROW LEVEL SECURITY;

-- 確認待ちと見送りは、そのサークルのメンバーと大学の職員だけ。
-- 募集中と締め切り後は、サークルが見える人なら誰でも読める。
-- サークルが見えるかどうかは、circles の RLS にそのまま任せる
-- （一般と未ログインには、公開設定のサークルだけが見える）。
DROP POLICY IF EXISTS sponsorship_requests_select ON sponsorship_requests;
CREATE POLICY sponsorship_requests_select ON sponsorship_requests
  FOR SELECT USING (
    public.app_is_circle_member(circle_id)
    OR EXISTS (
      SELECT 1 FROM public.circles c
       WHERE c.id = circle_id AND public.app_is_staff_of(c.university_id)
    )
    OR (
      status IN ('open', 'closed')
      AND EXISTS (SELECT 1 FROM public.circles c WHERE c.id = circle_id)
    )
  );

GRANT SELECT ON sponsorship_requests TO anon, authenticated;


-- -----------------------------------------------------------------------------
-- 2. 申し込み
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS sponsorship_offers (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id   UUID NOT NULL REFERENCES sponsorship_requests(id) ON DELETE CASCADE,
  -- 担当者のアカウントが消えても、協賛した事実は残す
  sponsor_id   UUID REFERENCES users(id) ON DELETE SET NULL,
  sponsor_name TEXT NOT NULL CHECK (char_length(btrim(sponsor_name)) BETWEEN 1 AND 60),
  sponsor_url  TEXT CHECK (sponsor_url IS NULL OR sponsor_url ~ '^https?://'),
  amount       INT  NOT NULL CHECK (amount BETWEEN 1000 AND 10000000),
  message      TEXT CHECK (message IS NULL OR char_length(message) <= 1000),
  -- pending: 返事待ち / accepted: 成立 / declined: サークルが見送った /
  -- withdrawn: 企業が取り下げた
  status       TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'accepted', 'declined', 'withdrawn')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at   TIMESTAMPTZ
);

-- 同じ企業の担当者が、同じ募集に返事待ちの申し込みを2つ出せないように
CREATE UNIQUE INDEX IF NOT EXISTS idx_sponsorship_offers_one_pending
  ON sponsorship_offers (request_id, sponsor_id) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_sponsorship_offers_request
  ON sponsorship_offers (request_id, created_at);

CREATE INDEX IF NOT EXISTS idx_sponsorship_offers_sponsor
  ON sponsorship_offers (sponsor_id, created_at DESC);

ALTER TABLE sponsorship_offers ENABLE ROW LEVEL SECURITY;

-- 金額と添えた言葉は当事者だけのもの。申し込んだ本人、そのサークルの
-- 管理者、大学の職員だけが読める。部員や外の人には、成立した企業の
-- 名前だけを list_circle_sponsors で見せる。
DROP POLICY IF EXISTS sponsorship_offers_select ON sponsorship_offers;
CREATE POLICY sponsorship_offers_select ON sponsorship_offers
  FOR SELECT TO authenticated USING (
    sponsor_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.sponsorship_requests r
        JOIN public.circles c ON c.id = r.circle_id
       WHERE r.id = request_id
         AND (public.app_is_circle_admin(r.circle_id)
              OR public.app_is_staff_of(c.university_id))
    )
  );

REVOKE ALL ON sponsorship_offers FROM anon;
GRANT SELECT ON sponsorship_offers TO authenticated;


-- -----------------------------------------------------------------------------
-- 3. 承認の記録に「協賛の募集」を足す
-- -----------------------------------------------------------------------------
-- 職員の確認は、設立や廃止と同じく判子で記録し、記録の連なり（0029）にも
-- 乗せる。誰がいつ確かめたかを、あとから書き換えられないようにする。

ALTER TABLE approvals DROP CONSTRAINT IF EXISTS approvals_target_type_check;
ALTER TABLE approvals ADD CONSTRAINT approvals_target_type_check
  CHECK (target_type IN ('circle', 'circle_closure', 'reservation', 'sponsorship'));

-- 協賛の記録を読めるのは、その募集を読める人（メンバーと職員）
DROP POLICY IF EXISTS approvals_select ON approvals;
CREATE POLICY approvals_select ON approvals
  FOR SELECT TO authenticated USING (
    CASE target_type
      WHEN 'reservation' THEN EXISTS (
        SELECT 1 FROM facility_reservations r WHERE r.id = target_id)
      WHEN 'sponsorship' THEN EXISTS (
        SELECT 1 FROM sponsorship_requests s WHERE s.id = target_id)
      ELSE EXISTS (
        SELECT 1 FROM circles c WHERE c.id = target_id)
    END
  );

-- 記録の検証にも、協賛の募集を足す（0029 の定義に分岐を1つ足しただけ）
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
  ELSIF p_target_type = 'sponsorship' THEN
    IF NOT EXISTS (SELECT 1 FROM public.sponsorship_requests WHERE id = p_target_id) THEN
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
-- 4. 募集を出す（サークルの管理者）
-- -----------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.request_sponsorship(UUID, TEXT, TEXT, INT, TEXT, DATE);
CREATE OR REPLACE FUNCTION public.request_sponsorship(
  p_circle_id   UUID,
  p_title       TEXT,
  p_purpose     TEXT,
  p_amount_goal INT,
  p_returns     TEXT,
  p_deadline    DATE
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  c      RECORD;
  v_id   UUID;
  v_today DATE := (now() AT TIME ZONE 'Asia/Tokyo')::DATE;
  v_staff UUID;
BEGIN
  IF NOT public.app_is_circle_admin(p_circle_id) THEN
    RAISE EXCEPTION '協賛を募集できるのは、このサークルの管理者だけです';
  END IF;

  SELECT * INTO c FROM public.circles WHERE id = p_circle_id;
  IF c.status IS DISTINCT FROM 'approved' THEN
    RAISE EXCEPTION '設立が承認されたサークルだけが、協賛を募集できます';
  END IF;
  IF c.closure_requested_at IS NOT NULL THEN
    RAISE EXCEPTION '廃止を申請中のサークルは、協賛を募集できません';
  END IF;

  IF p_deadline IS NULL OR p_deadline < v_today OR p_deadline > v_today + 365 THEN
    RAISE EXCEPTION '締め切りは、今日から1年以内の日付にしてください';
  END IF;

  -- 確認待ちと募集中は、同時に3件まで。職員の確認の手間と、企業から見た
  -- 分かりやすさのため。終わったものは締め切ってから出し直す
  IF (SELECT count(*) FROM public.sponsorship_requests
       WHERE circle_id = p_circle_id AND status IN ('pending', 'open')) >= 3 THEN
    RAISE EXCEPTION '確認待ちと募集中の募集は、同時に3件までです';
  END IF;

  INSERT INTO public.sponsorship_requests
    (circle_id, title, purpose, amount_goal, returns, deadline, created_by)
  VALUES (
    p_circle_id,
    btrim(p_title),
    btrim(p_purpose),
    p_amount_goal,
    nullif(btrim(coalesce(p_returns, '')), ''),
    p_deadline,
    auth.uid()
  )
  RETURNING id INTO v_id;

  FOR v_staff IN
    SELECT sp.user_id FROM public.staff_profiles sp
      JOIN public.users u ON u.id = sp.user_id
     WHERE sp.university_id = c.university_id AND u.role = 'staff'
  LOOP
    PERFORM public.app_notify(
      v_staff, 'request_received',
      '協賛の募集の確認が届きました',
      format('%s「%s」', c.name, btrim(p_title)),
      '/staff'
    );
  END LOOP;

  RETURN v_id;
END;
$$;


-- -----------------------------------------------------------------------------
-- 5. 募集を確かめる（大学の職員）
-- -----------------------------------------------------------------------------
-- 1人の判子で決まる。協賛は大学の事務の手続きではなく、外へ出してよいかの
-- 確認なので、設立のように複数人はそろえない。

DROP FUNCTION IF EXISTS public.decide_sponsorship(UUID, BOOLEAN, TEXT);
CREATE OR REPLACE FUNCTION public.decide_sponsorship(
  p_request_id UUID,
  p_approve    BOOLEAN,
  p_comment    TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  s        RECORD;
  v_circle RECORD;
  v_result TEXT;
  v_name   TEXT;
  v_seal   TEXT;
  v_shape  TEXT;
  v_admin  UUID;
BEGIN
  SELECT * INTO s FROM public.sponsorship_requests
   WHERE id = p_request_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '募集が見つかりません';
  END IF;

  SELECT id, name, university_id INTO v_circle
    FROM public.circles WHERE id = s.circle_id;

  IF NOT public.app_is_staff_of(v_circle.university_id) THEN
    RAISE EXCEPTION '確かめられるのは、このサークルの大学の職員だけです';
  END IF;

  IF s.status <> 'pending' THEN
    RAISE EXCEPTION 'この募集はすでに確認が済んでいます';
  END IF;

  v_result := public.app_record_approval(
    'sponsorship', p_request_id, p_approve, 1, p_comment);

  SELECT approver_name, seal_text, seal_shape
    INTO v_name, v_seal, v_shape
    FROM public.approvals
   WHERE target_type = 'sponsorship'
     AND target_id = p_request_id
     AND approver_id = auth.uid();

  UPDATE public.sponsorship_requests
     SET status = CASE WHEN v_result = 'approved' THEN 'open' ELSE 'rejected' END,
         decided_at = now(),
         checked_by_name    = v_name,
         checked_seal_text  = v_seal,
         checked_seal_shape = v_shape
   WHERE id = p_request_id;

  FOR v_admin IN
    SELECT user_id FROM public.circle_members
     WHERE circle_id = s.circle_id AND role = 'admin' AND status = 'active'
  LOOP
    PERFORM public.app_notify(
      v_admin, 'approval_result',
      CASE WHEN v_result = 'approved'
        THEN format('協賛の募集「%s」が公開されました', s.title)
        ELSE format('協賛の募集「%s」は見送られました', s.title)
      END,
      nullif(btrim(coalesce(p_comment, '')), ''),
      '/circles/' || s.circle_id::text
    );
  END LOOP;

  RETURN CASE WHEN v_result = 'approved' THEN 'open' ELSE 'rejected' END;
END;
$$;


-- -----------------------------------------------------------------------------
-- 6. 協賛を申し込む（企業）
-- -----------------------------------------------------------------------------
-- 申し込めるのは一般のアカウントだけ。学生と職員は、大学の中の立場で
-- 使っているので、企業の名前で申し込む入口にはしない。

DROP FUNCTION IF EXISTS public.offer_sponsorship(UUID, TEXT, TEXT, INT, TEXT);
CREATE OR REPLACE FUNCTION public.offer_sponsorship(
  p_request_id   UUID,
  p_sponsor_name TEXT,
  p_sponsor_url  TEXT,
  p_amount       INT,
  p_message      TEXT
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  s       RECORD;
  v_circle RECORD;
  v_id    UUID;
  v_today DATE := (now() AT TIME ZONE 'Asia/Tokyo')::DATE;
  v_admin UUID;
  v_url   TEXT := nullif(btrim(coalesce(p_sponsor_url, '')), '');
BEGIN
  IF public.app_role() IS DISTINCT FROM 'general' THEN
    RAISE EXCEPTION '協賛を申し込めるのは、企業・一般のアカウントだけです';
  END IF;

  SELECT * INTO s FROM public.sponsorship_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION '募集が見つかりません';
  END IF;

  -- SECURITY DEFINER は RLS を迂回するので、一般のアカウントから見える
  -- 募集か（公開設定の承認済みサークルか）を、ここで確かめる
  SELECT id, name, status, public_listed INTO v_circle
    FROM public.circles WHERE id = s.circle_id;
  IF v_circle.status IS DISTINCT FROM 'approved' OR NOT coalesce(v_circle.public_listed, false) THEN
    RAISE EXCEPTION '募集が見つかりません';
  END IF;

  IF s.status <> 'open' OR s.deadline < v_today THEN
    RAISE EXCEPTION 'この募集は受け付けを終えています';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.sponsorship_offers
     WHERE request_id = p_request_id AND sponsor_id = auth.uid() AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'この募集には、返事を待っている申し込みがあります';
  END IF;

  IF v_url IS NOT NULL AND v_url !~ '^https?://' THEN
    RAISE EXCEPTION 'Web サイトは http:// か https:// で始まる URL で入力してください';
  END IF;

  INSERT INTO public.sponsorship_offers
    (request_id, sponsor_id, sponsor_name, sponsor_url, amount, message)
  VALUES (
    p_request_id, auth.uid(), btrim(p_sponsor_name), v_url, p_amount,
    nullif(btrim(coalesce(p_message, '')), '')
  )
  RETURNING id INTO v_id;

  FOR v_admin IN
    SELECT user_id FROM public.circle_members
     WHERE circle_id = s.circle_id AND role = 'admin' AND status = 'active'
  LOOP
    PERFORM public.app_notify(
      v_admin, 'request_received',
      format('%s に協賛の申し込みが届きました', v_circle.name),
      format('%s から「%s」へ', btrim(p_sponsor_name), s.title),
      '/circles/' || s.circle_id::text
    );
  END LOOP;

  RETURN v_id;
END;
$$;


-- -----------------------------------------------------------------------------
-- 7. 申し込みに答える（サークルの管理者）
-- -----------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.respond_sponsorship_offer(UUID, BOOLEAN);
CREATE OR REPLACE FUNCTION public.respond_sponsorship_offer(
  p_offer_id UUID,
  p_accept   BOOLEAN
)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  o        RECORD;
  s        RECORD;
  v_circle TEXT;
BEGIN
  SELECT * INTO o FROM public.sponsorship_offers
   WHERE id = p_offer_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '申し込みが見つかりません';
  END IF;

  SELECT * INTO s FROM public.sponsorship_requests WHERE id = o.request_id;

  IF NOT public.app_is_circle_admin(s.circle_id) THEN
    RAISE EXCEPTION '答えられるのは、このサークルの管理者だけです';
  END IF;

  IF o.status <> 'pending' THEN
    RAISE EXCEPTION 'この申し込みは、すでに決着しています';
  END IF;

  UPDATE public.sponsorship_offers
     SET status = CASE WHEN p_accept THEN 'accepted' ELSE 'declined' END,
         decided_at = now()
   WHERE id = p_offer_id;

  SELECT name INTO v_circle FROM public.circles WHERE id = s.circle_id;

  PERFORM public.app_notify(
    o.sponsor_id, 'approval_result',
    CASE WHEN p_accept
      THEN format('%s への協賛が成立しました', coalesce(v_circle, 'サークル'))
      ELSE format('%s への協賛は見送られました', coalesce(v_circle, 'サークル'))
    END,
    format('「%s」への申し込みです。', s.title),
    '/sponsorships/' || s.id::text
  );

  RETURN CASE WHEN p_accept THEN 'accepted' ELSE 'declined' END;
END;
$$;


-- -----------------------------------------------------------------------------
-- 8. 申し込みを取り下げる（企業）
-- -----------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.withdraw_sponsorship_offer(UUID);
CREATE OR REPLACE FUNCTION public.withdraw_sponsorship_offer(p_offer_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE o RECORD;
BEGIN
  SELECT * INTO o FROM public.sponsorship_offers
   WHERE id = p_offer_id
   FOR UPDATE;

  IF NOT FOUND OR o.sponsor_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION '取り下げられるのは、申し込んだ本人だけです';
  END IF;

  IF o.status <> 'pending' THEN
    RAISE EXCEPTION 'この申し込みは、すでに決着しています';
  END IF;

  UPDATE public.sponsorship_offers
     SET status = 'withdrawn', decided_at = now()
   WHERE id = p_offer_id;
END;
$$;


-- -----------------------------------------------------------------------------
-- 9. 募集を締め切る（サークルの管理者）
-- -----------------------------------------------------------------------------
-- 締め切ったあとは新しい申し込みを受けない。返事待ちの申し込みには、
-- そのまま答えられる（締め切りの前に届いたものなので）。

DROP FUNCTION IF EXISTS public.close_sponsorship(UUID);
CREATE OR REPLACE FUNCTION public.close_sponsorship(p_request_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE s RECORD;
BEGIN
  SELECT * INTO s FROM public.sponsorship_requests
   WHERE id = p_request_id
   FOR UPDATE;

  IF NOT FOUND OR NOT public.app_is_circle_admin(s.circle_id) THEN
    RAISE EXCEPTION '締め切れるのは、このサークルの管理者だけです';
  END IF;

  IF s.status <> 'open' THEN
    RAISE EXCEPTION '募集中のものだけ締め切れます';
  END IF;

  UPDATE public.sponsorship_requests
     SET status = 'closed', closed_at = now()
   WHERE id = p_request_id;
END;
$$;


-- -----------------------------------------------------------------------------
-- 10. 協賛企業の名前（だれでも）
-- -----------------------------------------------------------------------------
-- 申し込みの行は当事者にしか読ませないので、外に出してよい項目（企業の
-- 名前と URL、どの募集への協賛か）だけを返す。サークルが見えるかどうかは
-- circles_select（0021）と同じ条件で確かめる。

DROP FUNCTION IF EXISTS public.list_circle_sponsors(UUID);
CREATE OR REPLACE FUNCTION public.list_circle_sponsors(p_circle_id UUID)
RETURNS TABLE (
  sponsor_name  TEXT,
  sponsor_url   TEXT,
  request_title TEXT,
  accepted_at   TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT o.sponsor_name, o.sponsor_url, r.title, o.decided_at
    FROM public.sponsorship_offers o
    JOIN public.sponsorship_requests r ON r.id = o.request_id
    JOIN public.circles c ON c.id = r.circle_id
   WHERE r.circle_id = p_circle_id
     AND o.status = 'accepted'
     AND (
       public.app_is_circle_member(c.id)
       OR public.app_is_staff_of(c.university_id)
       OR (c.status = 'approved'
           AND (public.app_role() IN ('student', 'staff') OR c.public_listed))
     )
   ORDER BY o.decided_at;
$$;


-- -----------------------------------------------------------------------------
-- 11. 実行権限
-- -----------------------------------------------------------------------------

DO $$
DECLARE f TEXT;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'request_sponsorship(uuid,text,text,integer,text,date)',
    'decide_sponsorship(uuid,boolean,text)',
    'offer_sponsorship(uuid,text,text,integer,text)',
    'respond_sponsorship_offer(uuid,boolean)',
    'withdraw_sponsorship_offer(uuid)',
    'close_sponsorship(uuid)'
  ] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM public, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.list_circle_sponsors(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.list_circle_sponsors(uuid) TO anon, authenticated;


-- -----------------------------------------------------------------------------
-- 12. 毎晩デモを戻す対象に足す（0035）
-- -----------------------------------------------------------------------------
-- 足し忘れると、来場者が出した募集や申し込みが、次の日にも残る。
-- supabase/tests/04_demo_reset.sql が足し忘れを落とす。
-- 流したあとで select public.demo_snapshot(); を取り直すこと。新しい表の
-- 保存が無いままだと、毎晩の戻しが途中で失敗し、何も戻らない。

CREATE OR REPLACE FUNCTION public.demo_content_tables()
RETURNS text[]
LANGUAGE sql IMMUTABLE
AS $$
  SELECT ARRAY[
    'universities', 'campuses',
    'circles', 'circle_members', 'circle_universities', 'circle_posts',
    'circle_handovers', 'circle_favorites', 'watched_universities',
    'events', 'event_universities', 'event_participants', 'event_reminders',
    'facilities', 'facility_reservations', 'approvals',
    'notifications', 'notification_preferences',
    'sponsorship_requests', 'sponsorship_offers'
  ]::text[]
$$;

REVOKE EXECUTE ON FUNCTION public.demo_content_tables() FROM public, anon, authenticated;


-- -----------------------------------------------------------------------------
-- 確認
-- -----------------------------------------------------------------------------

SELECT
  (SELECT count(*) FROM sponsorship_requests) AS 協賛の募集,
  (SELECT count(*) FROM sponsorship_offers)   AS 協賛の申し込み,
  'sponsorship_requests' = ANY (public.demo_content_tables()) AS デモを戻す対象;
