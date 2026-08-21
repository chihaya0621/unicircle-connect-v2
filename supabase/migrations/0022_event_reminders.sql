-- =============================================================================
-- 参加イベントのリマインド
-- =============================================================================
-- 参加登録したイベントについて、開始の何分前に知らせるかを
-- イベントごと・利用者ごとに決められるようにする。
--
-- 【なぜ既存のトリガー方式ではないか】
-- 既存の通知は「状態が変わった瞬間」に作られる。リマインドは
-- 「時刻が来たら」なので、変化を捉えるトリガーでは表現できない。
-- 予約表（event_reminders）を持ち、定期実行で期限の来たものを配る。
--
-- 【app_notify を経由しない理由】
-- app_notify は p_user_id = auth.uid() のとき送信を止める。
-- 自分の操作の結果を自分に通知しないための仕組みだが、リマインドは
-- 本人が本人のために仕掛けるものなので、この判定に掛かると必ず消える。
-- 受け取り設定だけ自分で確認して、notifications へ直接入れる。
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. 通知の種類を増やす
-- -----------------------------------------------------------------------------

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'approval_result',
    'request_received',
    'board_post',
    'new_event',
    'event_reminder'
  ));

ALTER TABLE notification_preferences
  ADD COLUMN IF NOT EXISTS event_reminder BOOLEAN NOT NULL DEFAULT true;


-- -----------------------------------------------------------------------------
-- 2. 受け取り設定の更新（引数が1つ増える）
-- -----------------------------------------------------------------------------
-- CREATE OR REPLACE は引数の並びが違うと「置き換え」ではなく
-- 「多重定義の追加」になる。古い4引数版が残ると、どちらが呼ばれるか
-- 分からなくなるので先に落とす（0003 で踏んだのと同じ問題）。

DROP FUNCTION IF EXISTS public.update_notification_preferences(
  BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN
);

CREATE OR REPLACE FUNCTION public.update_notification_preferences(
  p_approval_result  BOOLEAN,
  p_request_received BOOLEAN,
  p_board_post       BOOLEAN,
  p_new_event        BOOLEAN,
  p_event_reminder   BOOLEAN DEFAULT true
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
    (user_id, approval_result, request_received, board_post, new_event,
     event_reminder, updated_at)
  VALUES (
    auth.uid(),
    coalesce(p_approval_result, true),
    coalesce(p_request_received, true),
    coalesce(p_board_post, true),
    coalesce(p_new_event, true),
    coalesce(p_event_reminder, true),
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    approval_result  = EXCLUDED.approval_result,
    request_received = EXCLUDED.request_received,
    board_post       = EXCLUDED.board_post,
    new_event        = EXCLUDED.new_event,
    event_reminder   = EXCLUDED.event_reminder,
    updated_at       = NOW();
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_notification_preferences(
  BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.update_notification_preferences(
  BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN) TO authenticated;

-- app_notify の受け取り判定にも新しい種類を足す
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
  IF p_user_id = auth.uid() THEN RETURN; END IF;

  SELECT CASE p_type
    WHEN 'approval_result'  THEN np.approval_result
    WHEN 'request_received' THEN np.request_received
    WHEN 'board_post'       THEN np.board_post
    WHEN 'new_event'        THEN np.new_event
    WHEN 'event_reminder'   THEN np.event_reminder
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
-- 3. リマインドの予約表
-- -----------------------------------------------------------------------------
-- 1イベントにつき1件。複数の時刻を仕掛けたくなったら主キーを崩す。

CREATE TABLE IF NOT EXISTS event_reminders (
  user_id      UUID NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  event_id     UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  /** 開始の何分前に知らせるか */
  lead_minutes INT  NOT NULL CHECK (lead_minutes BETWEEN 5 AND 10080),
  /** 送信済みなら時刻。時刻を変えたら NULL に戻して送り直す */
  notified_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, event_id)
);

COMMENT ON TABLE event_reminders IS
  '参加イベントのリマインド予約。定期実行で期限の来たものを通知に変える。';

-- 定期実行が「まだ送っていないもの」だけを走査できるようにする
CREATE INDEX IF NOT EXISTS idx_event_reminders_pending
  ON event_reminders(event_id) WHERE notified_at IS NULL;

ALTER TABLE event_reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS event_reminders_select ON event_reminders;
CREATE POLICY event_reminders_select ON event_reminders
  FOR SELECT TO authenticated USING (user_id = auth.uid());

REVOKE ALL ON event_reminders FROM anon;
GRANT SELECT ON event_reminders TO authenticated;


-- -----------------------------------------------------------------------------
-- 4. 設定する
-- -----------------------------------------------------------------------------

/**
 * リマインドの設定・解除。p_lead_minutes に NULL を渡すと解除。
 *
 * 参加登録しているイベントにしか仕掛けられない。参加していない
 * イベントに仕掛けられると、開始時刻を知る手段として使えてしまう。
 */
CREATE OR REPLACE FUNCTION public.set_event_reminder(
  p_event_id     UUID,
  p_lead_minutes INT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_date TIMESTAMPTZ;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'ログインが必要です';
  END IF;

  IF p_lead_minutes IS NULL THEN
    DELETE FROM public.event_reminders
     WHERE user_id = auth.uid() AND event_id = p_event_id;
    RETURN;
  END IF;

  IF p_lead_minutes < 5 OR p_lead_minutes > 10080 THEN
    RAISE EXCEPTION 'リマインドは5分前から1週間前までの間で指定してください';
  END IF;

  SELECT event_date INTO v_date FROM public.events WHERE id = p_event_id;
  IF v_date IS NULL THEN
    RAISE EXCEPTION 'イベントが見つかりません';
  END IF;
  IF v_date < now() THEN
    RAISE EXCEPTION '終了したイベントには設定できません';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.event_participants
     WHERE event_id = p_event_id
       AND user_id = auth.uid()
       AND status = 'going'
  ) THEN
    RAISE EXCEPTION '参加登録しているイベントにのみ設定できます';
  END IF;

  INSERT INTO public.event_reminders (user_id, event_id, lead_minutes)
  VALUES (auth.uid(), p_event_id, p_lead_minutes)
  ON CONFLICT (user_id, event_id) DO UPDATE
    SET lead_minutes = EXCLUDED.lead_minutes,
        -- 時刻を変えたら送り直せるように未送信へ戻す
        notified_at  = NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_event_reminder(UUID, INT) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_event_reminder(UUID, INT) TO authenticated;


-- -----------------------------------------------------------------------------
-- 5. 期限の来たリマインドを配る
-- -----------------------------------------------------------------------------

/**
 * 送信した件数を返す。定期実行から呼ぶ。
 *
 * 参加を取り消した人には送らない（結合条件で status='going' を要求）。
 * 終了済みのイベントにも送らない。設定を切っている人にも送らない。
 */
CREATE OR REPLACE FUNCTION public.deliver_due_event_reminders()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count INT;
BEGIN
  -- 実行が重なっても二重に送らない。前の回がまだ走っていれば何もしない
  IF NOT pg_try_advisory_xact_lock(hashtext('deliver_due_event_reminders')) THEN
    RETURN 0;
  END IF;

  WITH due AS (
    SELECT r.user_id, r.event_id, e.title, e.event_date
      FROM public.event_reminders r
      JOIN public.events e ON e.id = r.event_id
      JOIN public.event_participants p
        ON p.event_id = r.event_id
       AND p.user_id  = r.user_id
       AND p.status   = 'going'
      LEFT JOIN public.notification_preferences np ON np.user_id = r.user_id
     WHERE r.notified_at IS NULL
       AND e.event_date > now()
       AND now() >= e.event_date - make_interval(mins => r.lead_minutes)
       AND coalesce(np.event_reminder, true)
  ),
  sent AS (
    INSERT INTO public.notifications (user_id, type, title, body, link)
    SELECT d.user_id,
           'event_reminder',
           d.title || ' がまもなく始まります',
           to_char(d.event_date AT TIME ZONE 'Asia/Tokyo',
                   'MM"月"DD"日" HH24:MI') || ' 開始',
           '/events/' || d.event_id
      FROM due d
    RETURNING 1
  ),
  marked AS (
    UPDATE public.event_reminders r
       SET notified_at = now()
      FROM due d
     WHERE r.user_id = d.user_id AND r.event_id = d.event_id
    RETURNING 1
  )
  SELECT count(*)::INT INTO v_count FROM marked;

  RETURN coalesce(v_count, 0);
END;
$$;

-- 呼ぶのは定期実行だけ。利用者から直接叩ける必要はない
REVOKE EXECUTE ON FUNCTION public.deliver_due_event_reminders()
  FROM public, anon, authenticated;


-- -----------------------------------------------------------------------------
-- 6. 定期実行の登録
-- -----------------------------------------------------------------------------
-- pg_cron が有効でなければ登録を飛ばす。ここで失敗させると
-- 上の定義まで巻き戻ってしまうため。

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE
      'pg_cron が有効でないため、リマインドの定期実行は登録しませんでした。'
      'Supabase の Database > Extensions で pg_cron を有効にしてから、'
      'このファイルを流し直してください。';
    RETURN;
  END IF;

  PERFORM cron.unschedule(jobid)
     FROM cron.job WHERE jobname = 'deliver-event-reminders';

  PERFORM cron.schedule(
    'deliver-event-reminders',
    '*/5 * * * *',
    'SELECT public.deliver_due_event_reminders();'
  );

  RAISE NOTICE 'リマインドの定期実行を5分間隔で登録しました。';
END;
$$;
