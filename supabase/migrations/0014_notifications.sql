-- =============================================================================
-- 通知
-- =============================================================================
-- アプリ内通知。ヘッダーのベルと通知一覧に出す。
--
-- 【生成箇所】
--   RPC の中ではなくトリガーで作る。RPC に書くと、後から書き込み経路を
--   追加したときに通知の実装を入れ忘れる。状態の変化そのものを捉える方が
--   取りこぼしがない。
--
-- 【自分の操作は通知しない】
--   承認した本人や投稿者本人に「承認されました」「投稿がありました」と
--   届いても意味がないので、auth.uid() と一致する相手には送らない。
-- =============================================================================

CREATE TABLE IF NOT EXISTS notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL CHECK (type IN (
    'approval_result',   -- 承認・却下の結果
    'request_received',  -- 自分への申請が届いた
    'board_post',        -- 掲示板の新着投稿
    'new_event'          -- 新しいイベントの告知
  )),
  title      TEXT NOT NULL,
  body       TEXT,
  /** 遷移先。アプリ内の相対パス */
  link       TEXT,
  read_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 未読の絞り込みと新着順の取得が主な用途
CREATE INDEX IF NOT EXISTS idx_notifications_user
  ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread
  ON notifications(user_id) WHERE read_at IS NULL;


-- -----------------------------------------------------------------------------
-- 通知設定（種類ごとの受け取り可否）
-- -----------------------------------------------------------------------------
-- 行が無い場合はすべて受け取る扱いにする。全ユーザーぶんを先に作らなくて
-- 済むよう、既定値を「行の不在」で表現している。
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id          UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  approval_result  BOOLEAN NOT NULL DEFAULT true,
  request_received BOOLEAN NOT NULL DEFAULT true,
  board_post       BOOLEAN NOT NULL DEFAULT true,
  new_event        BOOLEAN NOT NULL DEFAULT true,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE notifications             ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notifications_select ON notifications;
CREATE POLICY notifications_select ON notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS notification_preferences_select ON notification_preferences;
CREATE POLICY notification_preferences_select ON notification_preferences
  FOR SELECT TO authenticated USING (user_id = auth.uid());


-- -----------------------------------------------------------------------------
-- 通知を1件作る（内部用）
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.app_notify(
  p_user_id UUID,
  p_type    TEXT,
  p_title   TEXT,
  p_body    TEXT DEFAULT NULL,
  p_link    TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_wants BOOLEAN;
BEGIN
  IF p_user_id IS NULL THEN RETURN; END IF;

  -- 自分の操作の結果を自分に通知しない
  IF p_user_id = auth.uid() THEN RETURN; END IF;

  -- 設定行が無ければ受け取る（既定は全ON）
  SELECT CASE p_type
    WHEN 'approval_result'  THEN np.approval_result
    WHEN 'request_received' THEN np.request_received
    WHEN 'board_post'       THEN np.board_post
    WHEN 'new_event'        THEN np.new_event
    ELSE true
  END INTO v_wants
  FROM public.notification_preferences np
  WHERE np.user_id = p_user_id;

  IF v_wants IS FALSE THEN RETURN; END IF;

  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (p_user_id, p_type, p_title, p_body, p_link);
END;
$$;


-- -----------------------------------------------------------------------------
-- サークル参加申請 → 管理者へ / 承認・却下 → 本人へ
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.notify_circle_member_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_circle TEXT;
  v_name   TEXT;
  admin_id UUID;
BEGIN
  SELECT name INTO v_circle FROM public.circles WHERE id = NEW.circle_id;

  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    SELECT name INTO v_name FROM public.users WHERE id = NEW.user_id;
    FOR admin_id IN
      SELECT user_id FROM public.circle_members
      WHERE circle_id = NEW.circle_id AND role = 'admin' AND status = 'active'
    LOOP
      PERFORM public.app_notify(
        admin_id, 'request_received',
        v_circle || ' に参加申請が届きました',
        coalesce(v_name, '') || ' さんが参加を希望しています',
        '/circles/' || NEW.circle_id
      );
    END LOOP;

  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status <> 'pending' THEN
    PERFORM public.app_notify(
      NEW.user_id, 'approval_result',
      v_circle || ' への参加が' ||
        CASE WHEN NEW.status = 'active' THEN '承認されました' ELSE '見送られました' END,
      NULL,
      '/circles/' || NEW.circle_id
    );
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_circle_member ON circle_members;
CREATE TRIGGER trg_notify_circle_member
  AFTER INSERT OR UPDATE OF status ON circle_members
  FOR EACH ROW EXECUTE FUNCTION public.notify_circle_member_change();


-- -----------------------------------------------------------------------------
-- サークル設立申請 → 職員へ / 承認・却下 → 管理者へ
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.notify_circle_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE target UUID;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    FOR target IN
      SELECT sp.user_id FROM public.staff_profiles sp
      JOIN public.users u ON u.id = sp.user_id
      WHERE sp.university_id = NEW.university_id AND u.role = 'staff'
    LOOP
      PERFORM public.app_notify(
        target, 'request_received',
        'サークル設立の申請が届きました',
        NEW.name, '/circles'
      );
    END LOOP;

  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status <> 'pending' THEN
    FOR target IN
      SELECT user_id FROM public.circle_members
      WHERE circle_id = NEW.id AND role = 'admin' AND status = 'active'
    LOOP
      PERFORM public.app_notify(
        target, 'approval_result',
        NEW.name || ' の設立が' ||
          CASE WHEN NEW.status = 'approved' THEN '承認されました' ELSE '見送られました' END,
        NULL, '/circles/' || NEW.id
      );
    END LOOP;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_circle ON circles;
CREATE TRIGGER trg_notify_circle
  AFTER INSERT OR UPDATE OF status ON circles
  FOR EACH ROW EXECUTE FUNCTION public.notify_circle_change();


-- -----------------------------------------------------------------------------
-- 施設予約 申請 → 職員へ / 承認・却下 → 予約者へ
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.notify_reservation_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_facility TEXT;
  v_univ     UUID;
  target     UUID;
BEGIN
  SELECT name, university_id INTO v_facility, v_univ
  FROM public.facilities WHERE id = NEW.facility_id;

  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    FOR target IN
      SELECT sp.user_id FROM public.staff_profiles sp
      JOIN public.users u ON u.id = sp.user_id
      WHERE sp.university_id = v_univ AND u.role = 'staff'
    LOOP
      PERFORM public.app_notify(
        target, 'request_received',
        '施設の予約申請が届きました',
        coalesce(v_facility, '施設'), '/reservations'
      );
    END LOOP;

  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status <> 'pending' THEN
    -- 予約主体の排他的関連に合わせて宛先を決める
    IF NEW.booked_by_user_id IS NOT NULL THEN
      PERFORM public.app_notify(
        NEW.booked_by_user_id, 'approval_result',
        coalesce(v_facility, '施設') || ' の予約が' ||
          CASE WHEN NEW.status = 'approved' THEN '承認されました' ELSE '見送られました' END,
        NULL, '/reservations'
      );
    ELSE
      FOR target IN
        SELECT user_id FROM public.circle_members
        WHERE circle_id = NEW.group_circle_id AND status = 'active'
      LOOP
        PERFORM public.app_notify(
          target, 'approval_result',
          coalesce(v_facility, '施設') || ' の予約が' ||
            CASE WHEN NEW.status = 'approved' THEN '承認されました' ELSE '見送られました' END,
          NULL, '/reservations'
        );
      END LOOP;
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_reservation ON facility_reservations;
CREATE TRIGGER trg_notify_reservation
  AFTER INSERT OR UPDATE OF status ON facility_reservations
  FOR EACH ROW EXECUTE FUNCTION public.notify_reservation_change();


-- -----------------------------------------------------------------------------
-- 掲示板の新着 → サークルのメンバーへ
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.notify_circle_post()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_circle TEXT;
  target   UUID;
BEGIN
  SELECT name INTO v_circle FROM public.circles WHERE id = NEW.circle_id;

  FOR target IN
    SELECT user_id FROM public.circle_members
    WHERE circle_id = NEW.circle_id AND status = 'active'
  LOOP
    PERFORM public.app_notify(
      target, 'board_post',
      v_circle || (CASE WHEN NEW.is_pinned THEN ' のお知らせ' ELSE ' に新しい投稿' END),
      left(NEW.body, 80),
      '/board'
    );
  END LOOP;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_circle_post ON circle_posts;
CREATE TRIGGER trg_notify_circle_post
  AFTER INSERT ON circle_posts
  FOR EACH ROW EXECUTE FUNCTION public.notify_circle_post();


-- -----------------------------------------------------------------------------
-- 新しいイベント → サークルのメンバー / 主催大学の学生へ
-- -----------------------------------------------------------------------------
-- scoped イベントで対象に含まれる他大学の学生には送らない。
-- 「見えること」と「通知されること」は別で、他大学の予定まで
-- 通知されると多すぎるため。見たい人はカレンダーの設定で追える。
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.notify_new_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_host TEXT;
  target UUID;
BEGIN
  IF NEW.host_circle_id IS NOT NULL THEN
    SELECT name INTO v_host FROM public.circles WHERE id = NEW.host_circle_id;
    FOR target IN
      SELECT user_id FROM public.circle_members
      WHERE circle_id = NEW.host_circle_id AND status = 'active'
    LOOP
      PERFORM public.app_notify(
        target, 'new_event',
        v_host || ' のイベント: ' || NEW.title,
        to_char(NEW.event_date AT TIME ZONE 'Asia/Tokyo', 'MM月DD日 HH24:MI'),
        '/events/' || NEW.id
      );
    END LOOP;
  ELSE
    SELECT name INTO v_host FROM public.universities WHERE id = NEW.host_university_id;
    FOR target IN
      SELECT sp.user_id FROM public.student_profiles sp
      WHERE sp.university_id = NEW.host_university_id
    LOOP
      PERFORM public.app_notify(
        target, 'new_event',
        coalesce(v_host, '大学') || ' のイベント: ' || NEW.title,
        to_char(NEW.event_date AT TIME ZONE 'Asia/Tokyo', 'MM月DD日 HH24:MI'),
        '/events/' || NEW.id
      );
    END LOOP;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_new_event ON events;
CREATE TRIGGER trg_notify_new_event
  AFTER INSERT ON events
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_event();


-- -----------------------------------------------------------------------------
-- 既読・設定の操作
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.mark_notifications_read(p_ids UUID[] DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'ログインが必要です';
  END IF;

  -- 引数を省略するとすべて既読にする
  UPDATE public.notifications
  SET read_at = NOW()
  WHERE user_id = auth.uid()
    AND read_at IS NULL
    AND (p_ids IS NULL OR id = ANY(p_ids));
END;
$$;


CREATE OR REPLACE FUNCTION public.update_notification_preferences(
  p_approval_result  BOOLEAN,
  p_request_received BOOLEAN,
  p_board_post       BOOLEAN,
  p_new_event        BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'ログインが必要です';
  END IF;

  INSERT INTO public.notification_preferences
    (user_id, approval_result, request_received, board_post, new_event, updated_at)
  VALUES (
    auth.uid(), coalesce(p_approval_result, true), coalesce(p_request_received, true),
    coalesce(p_board_post, true), coalesce(p_new_event, true), NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    approval_result  = excluded.approval_result,
    request_received = excluded.request_received,
    board_post       = excluded.board_post,
    new_event        = excluded.new_event,
    updated_at       = NOW();
END;
$$;
