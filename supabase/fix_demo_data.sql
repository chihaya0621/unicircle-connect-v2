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
--   4. 展示会で来場者が試しに入れた予約が、承認待ちのまま残っていた
--   5. 学外向けイベントに会場と申込み方法が無かった（0032 の後に流す）
--   6. サークルに分野が無かった（0033 の後に流す）
--   7. 学外に載せているのに、紹介文や連絡先が空のサークルがあった
--
-- 5〜7 は seed を入れ直した後にも流す（seed は分野や会場を持たない）。
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


-- 4. 展示会で試された予約を片づける ---------------------------------------------
-- 2026-08-26 16:07、展示会の来場者がデモ用アカウント student7（山本太郎）で
-- 入れたもの（目的の欄は「嫌がらせ」）。
-- テント（2張）を 8/28 1:00 から 50時間。承認待ちのまま残っていた。
DELETE FROM facility_reservations
 WHERE id = '06e003bc-cf74-4577-a6db-830eae9578ec';



-- 5. 学外向けイベントの会場と申込み方法 ------------------------------------------
-- 大学主催のものは、その大学で最初に登録したキャンパスを会場にする。
-- 申込み方法は行事の種類で決める。書かれていないものだけ埋める。
UPDATE events e
   SET venue = coalesce(
         (SELECT c.name || coalesce('（' || c.address || '）', '')
            FROM campuses c
           WHERE c.university_id = e.host_university_id
           ORDER BY c.created_at, c.name
           LIMIT 1),
         (SELECT u.name || ' キャンパス' FROM universities u
           WHERE u.id = e.host_university_id))
 WHERE e.host_university_id IS NOT NULL
   AND e.visibility = 'public'
   AND e.venue IS NULL;

UPDATE events
   SET how_to_join = CASE
         WHEN title LIKE '%オープンキャンパス%'
           THEN '事前の申込みは不要です。当日、正門の受付にお越しください。保護者の方もご一緒にどうぞ。'
         WHEN title LIKE '%見学会%'
           THEN '事前申込み制です。大学の公式サイトの申込みフォームから、前日までにお申し込みください。'
         WHEN title LIKE '%大学祭%' OR title LIKE '%学園祭%'
           THEN '申込み不要・入場無料です。'
         WHEN title LIKE '%公開講座%'
           THEN '事前申込み制（先着順）です。大学の公式サイトからお申し込みください。'
         ELSE '主催の大学の窓口にお問い合わせください。'
       END
 WHERE host_university_id IS NOT NULL
   AND visibility = 'public'
   AND how_to_join IS NULL;


-- 6. サークルの分野 -------------------------------------------------------------
-- 名前から推し量る。「写真研究会」を学術にしないよう、文化・音楽を先に見る。
UPDATE circles
   SET category = CASE
         WHEN name ~ '(ボランティア|手話|子ども食堂|防災|environment|環境|地域|福祉)' THEN 'volunteer'
         WHEN name ~ '(国際|留学|模擬国連|英語|ESS)' THEN 'international'
         WHEN name ~ '(軽音|吹奏|合唱|ジャズ|アカペラ|オーケストラ|管弦|音楽|バンド|ギター|マンドリン|邦楽|和太鼓|ピアノ)' THEN 'music'
         WHEN name ~ '(写真|美術|茶道|華道|落語|演劇|文芸|映画|漫画|アニメ|ボードゲーム|書道|囲碁|将棋|料理|クイズ|eスポーツ)' THEN 'culture'
         WHEN name ~ '(テニス|フットサル|バスケ|バドミントン|陸上|弓道|ヨット|アルティメット|スキー|サッカー|野球|バレー|水泳|ラグビー|卓球|剣道|柔道|空手|ダンス|自動車|登山|ボート|ハンドボール|ランニング|サイクリング|ゴルフ|体操|チア|スポーツ)' THEN 'sports'
         WHEN name ~ '(プログラミング|ロボット|天文|数理|経済|科学|数学|法学|コンピュータ|情報|研究会|研究部)' THEN 'academic'
         ELSE 'other'
       END
 WHERE category IS NULL;


-- 7. 学外に載せているサークルの紹介文と連絡先 -------------------------------------
-- 紹介文は、学内向けの説明があればそれを使う。連絡先は架空のアドレスにする。
UPDATE circles
   SET public_intro = coalesce(
         nullif(btrim(description), ''),
         '新しいメンバーを募集しています。見学はいつでも歓迎です。まずは気軽に連絡してください。')
 WHERE status = 'approved' AND public_listed
   AND nullif(btrim(coalesce(public_intro, '')), '') IS NULL;

UPDATE circles
   SET public_contact = 'mail: circle-' || left(replace(id::text, '-', ''), 8) || '@example.com'
 WHERE status = 'approved' AND public_listed
   AND nullif(btrim(coalesce(public_contact, '')), '') IS NULL;

COMMIT;


-- 確認 -----------------------------------------------------------------------
-- 期待する値: 確認用で学外に出るもの 0 / 深夜の予約 0 / 深夜のイベント 0 / 試された予約 0
--             会場の無い学外向けイベント 0 / 分野の無いサークル 0 / 紹介か連絡先の無い掲載サークル 0
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
  (SELECT count(*) FROM facility_reservations WHERE purpose = '嫌がらせ')     AS 試された予約,
  (SELECT count(*) FROM events
    WHERE host_university_id IS NOT NULL AND visibility = 'public'
      AND (venue IS NULL OR how_to_join IS NULL))                             AS 会場の無い学外向けイベント,
  (SELECT count(*) FROM circles WHERE category IS NULL)                       AS 分野の無いサークル,
  (SELECT count(*) FROM circles
    WHERE status = 'approved' AND public_listed
      AND (nullif(btrim(coalesce(public_intro, '')), '') IS NULL
        OR nullif(btrim(coalesce(public_contact, '')), '') IS NULL))          AS 紹介か連絡先の無い掲載サークル;
