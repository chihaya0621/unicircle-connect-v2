-- =============================================================================
-- 学外に出さないイベントを、本当に出さないようにする
-- =============================================================================
-- 0025 で events.public_listed を足し、アプリ側の問い合わせはこの列で
-- 絞るようにした。しかし RLS ポリシーは 0008 のまま、visibility='public'
-- だけを見ていた。
--
-- つまり画面には出ないが、匿名キーで REST を直接叩けば読めた。
-- 大学が「学外には出さない」と決めた行事（入試、防災訓練、図書館
-- ガイダンスなど）が、URL を組み立てれば誰にでも見えていたことになる。
--
-- アプリ側で絞っているから大丈夫、という考え方がそもそも間違いだった。
-- 可視範囲はデータベース側で表現する、という方針を自分で破っていた。
-- 見つけたのは supabase/tests/01_rls.sql。
-- =============================================================================

DROP POLICY IF EXISTS events_select ON events;
CREATE POLICY events_select ON events
  FOR SELECT USING (
    CASE
      -- 学内の人（学生・職員）はこれまでどおり。
      -- public は学内公開の意味も兼ねているので、ここは変えない。
      WHEN public.app_role() IN ('student', 'staff') THEN
        visibility = 'public'
        OR public.event_visible_to_university(id, public.app_university_id())

      -- 学外の人（未ログイン・一般アカウント）には、
      -- 大学が学外に出すと決めたものだけ。
      ELSE
        visibility = 'public' AND public_listed
    END
  );


-- -----------------------------------------------------------------------------
-- 確認
-- -----------------------------------------------------------------------------
-- 学外に出さない公開イベントが何件あるか。これがそのまま、
-- これまで意図せず読めていた件数になる。

SELECT
  count(*) FILTER (WHERE visibility = 'public' AND public_listed)       AS 学外に出す,
  count(*) FILTER (WHERE visibility = 'public' AND NOT public_listed)   AS 学内だけに留める,
  count(*) FILTER (WHERE visibility <> 'public')                        AS 限定公開
FROM events;
