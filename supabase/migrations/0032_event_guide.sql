-- =============================================================================
-- 0032: イベントの会場と、参加・申込みの方法
-- =============================================================================
-- 学外向けのイベントを高校生が開いても、日時と説明しか無く、
-- 「どこへ行けばいいか」「申し込みが要るか」が分からなかった。
-- その2つを独立した欄として持つ。説明文に混ぜると、書く人ごとに
-- 書き方がばらばらになり、読む側が探すことになる。
--
-- 書き込みは既存の create_event / update_event を変えず、別の関数で行う。
-- 引数を足すと古い形の関数が残って（オーバーロード）、呼び分けが曖昧になるため。
-- =============================================================================

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS venue       TEXT,
  ADD COLUMN IF NOT EXISTS how_to_join TEXT;

COMMENT ON COLUMN events.venue IS
  '会場。建物や教室、キャンパスの所在地など。';
COMMENT ON COLUMN events.how_to_join IS
  '参加・申込みの方法。申込みが要るか、どこから申し込むか。';


/**
 * 会場と参加方法を保存する。空文字は「未記入」に戻す。
 * 主催者だけが書ける（update_event と同じ判定）。
 */
CREATE OR REPLACE FUNCTION public.set_event_guide(
  p_event_id    UUID,
  p_venue       TEXT,
  p_how_to_join TEXT
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_venue TEXT := nullif(btrim(coalesce(p_venue, '')), '');
  v_how   TEXT := nullif(btrim(coalesce(p_how_to_join, '')), '');
BEGIN
  IF NOT public.app_can_manage_event(p_event_id) THEN
    RAISE EXCEPTION 'このイベントの主催者のみ編集できます';
  END IF;
  IF char_length(v_venue) > 200 THEN
    RAISE EXCEPTION '会場は200文字以内で入力してください';
  END IF;
  IF char_length(v_how) > 500 THEN
    RAISE EXCEPTION '参加・申込みの方法は500文字以内で入力してください';
  END IF;

  UPDATE public.events
     SET venue = v_venue, how_to_join = v_how
   WHERE id = p_event_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_event_guide(uuid, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_event_guide(uuid, text, text) TO authenticated;
