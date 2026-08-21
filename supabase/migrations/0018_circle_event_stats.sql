-- =============================================================================
-- サークルの活動記録に出す参加人数
-- =============================================================================
-- 活動記録に「出席N人 / 参加登録N人」を出しているが、event_participants は
-- RLS により「本人の登録」と「主催者から見た参加者一覧」しか読めない。
-- そのため一般メンバーには自分の1件しか返らず、常に「1人」と表示されていた。
--
-- 「誰が参加したか」は伏せたままにしたいので RLS は緩めない。
-- 代わりに人数だけを返す関数を用意する。個人を特定できる情報は返さない。
--
-- 【RETURNS TABLE の列名について】
-- 列名は関数内で変数として扱われ、本体クエリの同名列と衝突する。
-- stat_ 接頭辞を付けて避けている（0010 で踏んだのと同じ問題）。
-- =============================================================================

CREATE OR REPLACE FUNCTION public.circle_event_stats(p_circle_id UUID)
RETURNS TABLE (
  stat_event_id   UUID,
  stat_registered INT,
  stat_present    INT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- そのサークルのメンバーだけが見られる。
  -- 部外者が任意のサークルの活動量を調べられないようにするため。
  IF NOT public.app_is_circle_member(p_circle_id) THEN
    RAISE EXCEPTION 'このサークルのメンバーのみ参照できます';
  END IF;

  RETURN QUERY
  SELECT
    e.id,
    count(*) FILTER (WHERE ep.status = 'going')::INT,
    count(*) FILTER (WHERE ep.status = 'going' AND ep.attended IS TRUE)::INT
  FROM public.events e
  LEFT JOIN public.event_participants ep ON ep.event_id = e.id
  -- 引数のサークルが主催するイベントに限る。
  -- 他サークルのイベントIDを混ぜて集計を引き出せないようにしている。
  WHERE e.host_circle_id = p_circle_id
  GROUP BY e.id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.circle_event_stats(UUID) FROM public, anon;
