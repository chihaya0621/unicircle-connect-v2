-- =============================================================================
-- デモ用の活動データ
-- =============================================================================
-- seed_demo.sql のあとに実行します。
-- サークルの活動記録・掲示板・出欠・施設予約を埋めて、
-- 画面がひととおり賑わった状態を作ります。
--
-- 何度実行しても増えません（決定的なUUID + ON CONFLICT DO NOTHING）。
--
-- 【通知について】
-- イベント作成と掲示板投稿にはトリガーが付いているので、この SQL を流すと
-- 通知も大量に生成されます。SQL Editor 上では auth.uid() が NULL のため
-- 「自分の操作は通知しない」判定が効かず、投稿者本人にも届きます。
-- 実際のアプリ操作では本人には届きません。
-- =============================================================================


-- -----------------------------------------------------------------------------
-- サークルのイベント（過去4回 + 今後2回）
-- -----------------------------------------------------------------------------
-- 活動記録は「開催が終わったイベント」を出すので、過去を厚めに入れる。
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  past_titles TEXT[] := ARRAY[
    '定例ミーティング','週末練習','新歓イベント','合同練習会','作品講評会',
    '勉強会','親睦会','大会に向けた強化練習','OB訪問','学内発表会'
  ];
  future_titles TEXT[] := ARRAY[
    '次回定例会','秋の合宿説明会','体験会','公開練習','企画会議'
  ];
  c        RECORD;
  i        INT;
  n        INT := 0;
  v_id     UUID;
  v_when   TIMESTAMPTZ;
BEGIN
  FOR c IN SELECT id, university_id, name FROM circles WHERE status = 'approved' ORDER BY id
  LOOP
    -- 過去の活動 4件（3日〜80日前に散らす）
    FOR i IN 1..4 LOOP
      n := n + 1;
      v_id := ('e3000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid;
      v_when := date_trunc('hour', now())
                - ((3 + (n * 7 + i * 5) % 78) || ' days')::interval
                + ((14 + (n % 5)) || ' hours')::interval;

      INSERT INTO events
        (id, host_university_id, host_circle_id, title, description,
         event_date, visibility, target_grades)
      VALUES (
        v_id, NULL, c.id,
        past_titles[1 + (n % array_length(past_titles, 1))],
        '活動の記録として残しているイベントです。',
        v_when, 'internal', NULL
      )
      ON CONFLICT (id) DO NOTHING;
    END LOOP;

    -- これからの予定 2件
    FOR i IN 1..2 LOOP
      n := n + 1;
      v_id := ('e3000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid;
      v_when := date_trunc('hour', now())
                + ((2 + (n * 3 + i * 4) % 40) || ' days')::interval
                + ((13 + (n % 6)) || ' hours')::interval;

      INSERT INTO events
        (id, host_university_id, host_circle_id, title, description,
         event_date, visibility, target_grades)
      VALUES (
        v_id, NULL, c.id,
        future_titles[1 + (n % array_length(future_titles, 1))],
        '参加登録をお願いします。',
        v_when,
        CASE WHEN n % 4 = 0 THEN 'public' ELSE 'internal' END,
        NULL
      )
      ON CONFLICT (id) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;


-- -----------------------------------------------------------------------------
-- 大学公式イベントを追加
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  titles TEXT[] := ARRAY[
    '学生生活ガイダンス','就職セミナー','healthチェック','研究室公開',
    '学園祭実行委員会 説明会','奨学金相談会','国際交流ウィーク'
  ];
  u     RECORD;
  i     INT;
  n     INT := 0;
  v_id  UUID;
BEGIN
  FOR u IN SELECT id FROM universities ORDER BY id LOOP
    FOR i IN 1..3 LOOP
      n := n + 1;
      v_id := ('e4000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid;

      INSERT INTO events
        (id, host_university_id, host_circle_id, title, description,
         event_date, visibility, target_grades)
      VALUES (
        v_id, u.id, NULL,
        titles[1 + (n % array_length(titles, 1))],
        '大学が主催する行事です。',
        date_trunc('hour', now())
          + (((n * 5 + i * 3) % 70 - 25) || ' days')::interval
          + ((10 + (n % 6)) || ' hours')::interval,
        CASE WHEN i = 1 THEN 'public' ELSE 'internal' END,
        CASE WHEN i = 2 THEN ARRAY['3年','4年'] ELSE NULL END
      )
      ON CONFLICT (id) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;


-- -----------------------------------------------------------------------------
-- 参加登録と出欠
-- -----------------------------------------------------------------------------
-- サークル主催イベントに、そのサークルのメンバーを登録する。
-- 全員ではなく一部にして、参加率が100%にならないようにする。
--
-- 開催済みのイベントには出欠も記録する。
-- 「未記録」も混ぜて、記録漏れがある状態も再現する。
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  e        RECORD;
  m        RECORD;
  seq      INT;
  is_past  BOOLEAN;
BEGIN
  FOR e IN
    SELECT id, host_circle_id, event_date FROM events
    WHERE host_circle_id IS NOT NULL
  LOOP
    is_past := e.event_date < now();
    seq := 0;

    FOR m IN
      SELECT user_id FROM circle_members
      WHERE circle_id = e.host_circle_id AND status = 'active'
      ORDER BY user_id
    LOOP
      seq := seq + 1;
      -- 4人に3人が参加登録する
      CONTINUE WHEN seq % 4 = 0;

      INSERT INTO event_participants (event_id, user_id, status, attended)
      VALUES (
        e.id, m.user_id, 'going',
        CASE
          WHEN NOT is_past THEN NULL             -- これからの予定は未記録
          WHEN seq % 5 = 0 THEN NULL             -- 記録漏れも再現する
          WHEN seq % 3 = 0 THEN false            -- 登録したが欠席
          ELSE true                              -- 出席
        END
      )
      ON CONFLICT (event_id, user_id) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- 大学公式イベントにも学生を参加登録させる（公開イベントのみ）
DO $$
DECLARE
  e   RECORD;
  s   RECORD;
  seq INT;
BEGIN
  FOR e IN
    SELECT id, host_university_id, event_date FROM events
    WHERE host_university_id IS NOT NULL AND visibility = 'public'
  LOOP
    seq := 0;
    FOR s IN
      SELECT user_id FROM student_profiles
      WHERE university_id = e.host_university_id
      ORDER BY user_id
    LOOP
      seq := seq + 1;
      CONTINUE WHEN seq % 3 <> 0;   -- 3人に1人

      INSERT INTO event_participants (event_id, user_id, status, attended)
      VALUES (
        e.id, s.user_id, 'going',
        CASE WHEN e.event_date < now() THEN (seq % 4 <> 0) ELSE NULL END
      )
      ON CONFLICT (event_id, user_id) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;


-- -----------------------------------------------------------------------------
-- 掲示板の投稿
-- -----------------------------------------------------------------------------
-- 管理者が「お知らせ」を1件、メンバーが通常の投稿を数件。
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  bodies TEXT[] := ARRAY[
    '今週の活動は通常どおり行います。集合場所はいつもの部室です。',
    '備品の鍵を借りてきました。必要な人は声をかけてください。',
    '次回の持ち物は筆記用具と飲み物です。動きやすい服装でお願いします。',
    '欠席の連絡はこの掲示板か、直接わたしまでお願いします。',
    '写真をアルバムにまとめました。あとで共有します。',
    '来月の予定を調整中です。都合の悪い日があれば早めに教えてください。'
  ];
  pinned TEXT := '【お知らせ】今学期の活動方針をまとめました。全員必ず目を通してください。';
  c      RECORD;
  m      RECORD;
  n      INT := 0;
  seq    INT;
  v_admin UUID;
BEGIN
  FOR c IN SELECT id FROM circles WHERE status = 'approved' ORDER BY id LOOP
    SELECT user_id INTO v_admin FROM circle_members
    WHERE circle_id = c.id AND role = 'admin' AND status = 'active' LIMIT 1;
    CONTINUE WHEN v_admin IS NULL;

    n := n + 1;
    INSERT INTO circle_posts (id, circle_id, author_id, body, is_pinned, created_at)
    VALUES (
      ('b1000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
      c.id, v_admin, pinned, true, now() - interval '20 days'
    )
    ON CONFLICT (id) DO NOTHING;

    seq := 0;
    FOR m IN
      SELECT user_id FROM circle_members
      WHERE circle_id = c.id AND status = 'active' ORDER BY user_id LIMIT 3
    LOOP
      seq := seq + 1;
      n := n + 1;
      INSERT INTO circle_posts (id, circle_id, author_id, body, is_pinned, created_at)
      VALUES (
        ('b1000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
        c.id, m.user_id,
        bodies[1 + (n % array_length(bodies, 1))],
        false,
        now() - ((seq * 3) || ' days')::interval
      )
      ON CONFLICT (id) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;


-- -----------------------------------------------------------------------------
-- 施設予約
-- -----------------------------------------------------------------------------
-- 排他制約があるので時間帯が重ならないよう、施設ごとに日をずらす。
-- 承認済み・承認待ち・却下を混ぜる。
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  purposes TEXT[] := ARRAY[
    '定例ミーティング','練習','機材の準備','説明会の下見','撮影'
  ];
  f       RECORD;
  v_user  UUID;
  v_circle UUID;
  i       INT;
  n       INT := 0;
  v_start TIMESTAMPTZ;
  v_status TEXT;
BEGIN
  FOR f IN SELECT id, university_id FROM facilities WHERE is_available ORDER BY id LOOP
    -- その大学の学生とサークルを1つずつ拾う
    SELECT sp.user_id INTO v_user FROM student_profiles sp
    WHERE sp.university_id = f.university_id ORDER BY sp.user_id LIMIT 1;
    CONTINUE WHEN v_user IS NULL;

    SELECT c.id INTO v_circle FROM circles c
    WHERE c.university_id = f.university_id AND c.status = 'approved'
    ORDER BY c.id LIMIT 1;

    FOR i IN 1..3 LOOP
      n := n + 1;
      -- 施設ごと・回ごとに別の日にして重複を避ける
      v_start := date_trunc('day', now())
                 + ((n * 2 + i) || ' days')::interval
                 + ((9 + (i * 3)) || ' hours')::interval;
      v_status := CASE i WHEN 1 THEN 'approved' WHEN 2 THEN 'pending' ELSE 'rejected' END;

      -- 予約主体の排他的関連: 個人かサークルのどちらか一方
      IF i = 2 AND v_circle IS NOT NULL THEN
        INSERT INTO facility_reservations
          (id, facility_id, group_circle_id, start_time, end_time, purpose, status)
        VALUES (
          ('a2000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
          f.id, v_circle, v_start, v_start + interval '2 hours',
          purposes[1 + (n % array_length(purposes, 1))], v_status
        )
        ON CONFLICT (id) DO NOTHING;
      ELSE
        INSERT INTO facility_reservations
          (id, facility_id, booked_by_user_id, start_time, end_time, purpose, status)
        VALUES (
          ('a2000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
          f.id, v_user, v_start, v_start + interval '2 hours',
          purposes[1 + (n % array_length(purposes, 1))], v_status
        )
        ON CONFLICT (id) DO NOTHING;
      END IF;
    END LOOP;
  END LOOP;
END $$;


-- -----------------------------------------------------------------------------
-- 確認
-- -----------------------------------------------------------------------------

SELECT
  (SELECT count(*) FROM events)                                    AS イベント,
  (SELECT count(*) FROM events WHERE event_date <  now())          AS うち開催済み,
  (SELECT count(*) FROM events WHERE event_date >= now())          AS うち今後,
  (SELECT count(*) FROM event_participants)                        AS 参加登録,
  (SELECT count(*) FROM event_participants WHERE attended IS NOT NULL) AS 出欠記録済み,
  (SELECT count(*) FROM circle_posts)                              AS 掲示板の投稿,
  (SELECT count(*) FROM facility_reservations)                     AS 施設予約,
  (SELECT count(*) FROM notifications)                             AS 通知;
