-- =============================================================================
-- 公開デモのデータを整える（展示の前に1回流す）
-- =============================================================================
-- 評価で見つかった、データ側の問題をまとめて直す。どれも表示の仕組みは正しく、
-- 入っている値がずれていた。seed の側も同じ日に直してあるので、入れ直した
-- 環境ではこのファイルは要らない。
--
--   1. 【確認用】のサークルとイベントが、学外の一覧に出ていた
--   2. 予約が日本時間の 21時・0時・3時 に入っていた（UTC の時刻で作っていた）
--   3. イベントが流した時刻のまま（深夜3時台など）になっていた
--   4. 公開デモから入った「嫌がらせ」という目的の予約が残っていた
--
-- 何度流しても結果は同じ。途中で失敗したら全部取り消される。
-- =============================================================================

BEGIN;

-- 1. 確認用は学内だけに見せる -------------------------------------------------
UPDATE circles SET public_listed = false
 WHERE id::text LIKE 'd0000000-0000-4000-8000-%';

UPDATE events SET public_listed = false
 WHERE id::text LIKE 'd1000000-0000-4000-8000-%';


-- 2. 予約の時刻を日本時間に直す -----------------------------------------------
-- seed は 12時・15時・18時のつもりで、UTC のまま 9時間ずれていた。
-- 時刻で絞っているので、2回目以降は何も変わらない。
UPDATE facility_reservations
   SET start_time = start_time - interval '9 hours',
       end_time   = end_time   - interval '9 hours'
 WHERE id::text LIKE 'a2000000-0000-4000-8000-%'
   AND extract(hour FROM start_time AT TIME ZONE 'Asia/Tokyo') IN (21, 0, 3);


-- 3. イベントの時刻を昼間に寄せる ---------------------------------------------
-- 日付（日本時間）は変えず、時刻だけ 10:00〜17:30 のどこかにする。
-- どの時刻になるかは ID から決まるので、流し直しても同じになる。
-- 画面から作ったイベントは秒が 0 で、昼間に入っているので対象にならない。
UPDATE events
   SET event_date =
       ((event_date AT TIME ZONE 'Asia/Tokyo')::date
        + make_interval(hours => 10 + (hashtext(id::text) & 7),
                        mins  => 30 * ((hashtext(id::text) >> 3) & 1)))
       AT TIME ZONE 'Asia/Tokyo'
 WHERE extract(hour FROM event_date AT TIME ZONE 'Asia/Tokyo') NOT BETWEEN 8 AND 21
    OR extract(second FROM event_date) <> 0;


-- 4. いたずらの予約を消す -----------------------------------------------------
-- 2026-08-26 16:07 に、デモ用アカウント student7（山本太郎）で入ったもの。
-- テント（2張）を 8/28 1:00 から 50時間。承認待ちのまま残っていた。
DELETE FROM facility_reservations
 WHERE id = '06e003bc-cf74-4577-a6db-830eae9578ec';

COMMIT;


-- 確認 -----------------------------------------------------------------------
-- 期待する値: 確認用で学外に出るもの 0 / 深夜の予約 0 / 深夜のイベント 0 / 嫌がらせ 0
SELECT
  (SELECT count(*) FROM circles
    WHERE id::text LIKE 'd0000000-0000-4000-8000-%' AND public_listed)       AS 確認用サークル_学外,
  (SELECT count(*) FROM events
    WHERE id::text LIKE 'd1000000-0000-4000-8000-%' AND public_listed)       AS 確認用イベント_学外,
  (SELECT count(*) FROM facility_reservations
    WHERE extract(hour FROM start_time AT TIME ZONE 'Asia/Tokyo')
          NOT BETWEEN 8 AND 21)                                               AS 深夜の予約,
  (SELECT count(*) FROM events
    WHERE extract(hour FROM event_date AT TIME ZONE 'Asia/Tokyo')
          NOT BETWEEN 8 AND 21)                                               AS 深夜のイベント,
  (SELECT count(*) FROM facility_reservations WHERE purpose = '嫌がらせ')     AS 嫌がらせ;
