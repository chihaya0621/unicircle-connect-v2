-- =============================================================================
-- デモ用の大量データ
-- =============================================================================
-- カレンダーの見え方を確かめるための、開発専用データ。
-- setup_all.sql（基本のシード含む）のあとに実行してください。
--
-- 何度実行しても安全。固定UUID + ON CONFLICT DO NOTHING にしている。
--
-- イベントの日時は「実行時点」からの相対で入れるので、
-- いつ流しても当月前後にデータが載る。
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 大学を追加（既存3校 + 3校 = 6校）
-- -----------------------------------------------------------------------------

INSERT INTO universities (id, name) VALUES
  ('a0000000-0000-4000-8000-000000000004', '桜丘大学'),
  ('a0000000-0000-4000-8000-000000000005', '北都大学'),
  ('a0000000-0000-4000-8000-000000000006', '西陵学院大学')
ON CONFLICT (id) DO NOTHING;


-- -----------------------------------------------------------------------------
-- サークルを追加
-- -----------------------------------------------------------------------------
-- scope を混ぜてある:
--   university … 自大学のみ
--   scoped     … 指定大学のみ（下で circle_universities に登録）
--   public     … インカレ
-- -----------------------------------------------------------------------------

INSERT INTO circles (id, university_id, name, description, status, scope) VALUES
  -- 青空大学
  ('c0000000-0000-4000-8000-000000000011','a0000000-0000-4000-8000-000000000001',
   'テニスサークル SMASH','週3回コートで活動。初心者歓迎です。','approved','university'),
  ('c0000000-0000-4000-8000-000000000012','a0000000-0000-4000-8000-000000000001',
   '写真研究会','散歩しながら撮影。月1で講評会をやっています。','approved','university'),
  ('c0000000-0000-4000-8000-000000000013','a0000000-0000-4000-8000-000000000001',
   '国際交流サークル WAVE','留学生との交流イベントを企画。','approved','public'),
  ('c0000000-0000-4000-8000-000000000014','a0000000-0000-4000-8000-000000000001',
   'ボードゲーム同好会','毎週金曜に集まって遊んでいます。','approved','university'),
  -- 海原大学
  ('c0000000-0000-4000-8000-000000000021','a0000000-0000-4000-8000-000000000002',
   'ジャズ研究会','ビッグバンドとコンボの両方で活動。','approved','university'),
  ('c0000000-0000-4000-8000-000000000022','a0000000-0000-4000-8000-000000000002',
   '合唱団 うみなり','定期演奏会に向けて練習中。','approved','scoped'),
  ('c0000000-0000-4000-8000-000000000023','a0000000-0000-4000-8000-000000000002',
   'アルティメット部','フリスビー競技。経験者募集中。','approved','public'),
  -- 山手工科大学
  ('c0000000-0000-4000-8000-000000000031','a0000000-0000-4000-8000-000000000003',
   'ロボット製作部','NHK学生ロボコンを目指しています。','approved','university'),
  ('c0000000-0000-4000-8000-000000000032','a0000000-0000-4000-8000-000000000003',
   '競技プログラミング部','ICPC参加。週1で精進会。','approved','public'),
  ('c0000000-0000-4000-8000-000000000033','a0000000-0000-4000-8000-000000000003',
   '自動車部','整備とジムカーナ。','approved','university'),
  -- 桜丘大学
  ('c0000000-0000-4000-8000-000000000041','a0000000-0000-4000-8000-000000000004',
   '茶道部','週2回のお稽古。作法から丁寧に教えます。','approved','university'),
  ('c0000000-0000-4000-8000-000000000042','a0000000-0000-4000-8000-000000000004',
   'バスケットボール部','リーグ戦に向けて活動中。','approved','scoped'),
  -- 北都大学
  ('c0000000-0000-4000-8000-000000000051','a0000000-0000-4000-8000-000000000005',
   'スキー部','冬季は合宿中心。','approved','university'),
  ('c0000000-0000-4000-8000-000000000052','a0000000-0000-4000-8000-000000000005',
   '映画研究会','自主制作と上映会。','approved','public'),
  -- 西陵学院大学
  ('c0000000-0000-4000-8000-000000000061','a0000000-0000-4000-8000-000000000006',
   'ボランティアサークル つなぐ','地域清掃と子ども食堂の運営。','approved','public'),
  -- 承認待ちのものも1つ混ぜる（職員の承認キュー確認用）
  ('c0000000-0000-4000-8000-000000000062','a0000000-0000-4000-8000-000000000001',
   'eスポーツ同好会','設立申請中です。','pending','university')
ON CONFLICT (id) DO NOTHING;

-- scoped サークルの対象大学
INSERT INTO circle_universities (circle_id, university_id) VALUES
  -- 合唱団 うみなり（海原）… 青空・桜丘と合同
  ('c0000000-0000-4000-8000-000000000022','a0000000-0000-4000-8000-000000000001'),
  ('c0000000-0000-4000-8000-000000000022','a0000000-0000-4000-8000-000000000004'),
  -- バスケ部（桜丘）… 北都と合同
  ('c0000000-0000-4000-8000-000000000042','a0000000-0000-4000-8000-000000000005')
ON CONFLICT DO NOTHING;


-- -----------------------------------------------------------------------------
-- 施設・備品を各大学に追加
-- -----------------------------------------------------------------------------

INSERT INTO facilities (id, university_id, name, category, is_available)
SELECT
  ('f1000000-0000-4000-8000-' || lpad((row_number() over ())::text, 12, '0'))::uuid,
  u.id, f.name, f.category, true
FROM universities u
CROSS JOIN (VALUES
  ('大講義室', 'facility'),
  ('多目的ホール', 'facility'),
  ('グラウンド', 'facility'),
  ('マイクセット', 'equipment'),
  ('ノートPC', 'equipment')
) AS f(name, category)
WHERE u.id <> 'a0000000-0000-4000-8000-000000000001'  -- 青空は基本シードで登録済み
ON CONFLICT (id) DO NOTHING;


-- -----------------------------------------------------------------------------
-- イベントを大量に生成
-- -----------------------------------------------------------------------------
-- 実行時点の前後2か月に散らす。visibility も混ぜる。
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  v_titles TEXT[] := ARRAY[
    '新歓説明会','定期演奏会','練習試合','合同合宿の説明会','作品展示会',
    'LT大会','交流ランチ会','体験入部デー','OB・OG交流会','ミーティング',
    '学内リーグ戦','ワークショップ','上映会','清掃ボランティア','技術講習会'
  ];
  v_uni_titles TEXT[] := ARRAY[
    'オープンキャンパス','履修相談会','キャリアガイダンス','健康診断',
    '防災訓練','学位授与式説明会','図書館ガイダンス','留学説明会'
  ];
  v_vis TEXT[] := ARRAY['internal','public','internal','scoped','public'];
  c RECORD;
  u RECORD;
  v_id UUID;
  i INT;
  v_offset INT;
  v_visibility TEXT;
  n INT := 0;
BEGIN
  -- サークル主催イベント（承認済みサークルごとに3件）
  FOR c IN SELECT id, university_id FROM circles WHERE status = 'approved' LOOP
    FOR i IN 1..3 LOOP
      n := n + 1;
      v_offset := (n * 7 + i * 3) % 90 - 30;   -- -30〜+59日に散らす
      v_visibility := v_vis[1 + (n % array_length(v_vis, 1))];
      v_id := ('e1000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid;

      INSERT INTO events
        (id, host_university_id, host_circle_id, title, description,
         event_date, visibility, target_grades)
      VALUES (
        v_id, NULL, c.id,
        v_titles[1 + (n % array_length(v_titles, 1))],
        '詳細は各サークルの案内をご確認ください。',
        date_trunc('hour', now()) + (v_offset || ' days')::interval
          + ((10 + (n % 8)) || ' hours')::interval,
        v_visibility,
        CASE WHEN n % 3 = 0 THEN ARRAY['1年','2年'] ELSE NULL END
      )
      ON CONFLICT (id) DO NOTHING;

      -- scoped なら対象大学を1つ足す（主催大学以外から選ぶ）
      IF v_visibility = 'scoped' THEN
        INSERT INTO event_universities (event_id, university_id)
        SELECT v_id, x.id FROM universities x
        WHERE x.id <> c.university_id
        ORDER BY x.id LIMIT 1
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END LOOP;

  -- 大学公式イベント（大学ごとに4件）
  FOR u IN SELECT id FROM universities LOOP
    FOR i IN 1..4 LOOP
      n := n + 1;
      v_offset := (n * 5 + i * 4) % 90 - 30;
      v_visibility := CASE WHEN i % 2 = 0 THEN 'public' ELSE 'internal' END;
      v_id := ('e2000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid;

      INSERT INTO events
        (id, host_university_id, host_circle_id, title, description,
         event_date, visibility, target_grades)
      VALUES (
        v_id, u.id, NULL,
        v_uni_titles[1 + (n % array_length(v_uni_titles, 1))],
        '大学公式の行事です。',
        date_trunc('hour', now()) + (v_offset || ' days')::interval
          + ((9 + (n % 7)) || ' hours')::interval,
        v_visibility,
        CASE WHEN i = 1 THEN ARRAY['1年'] ELSE NULL END
      )
      ON CONFLICT (id) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;


-- -----------------------------------------------------------------------------
-- テストユーザーをサークルに所属させる
-- -----------------------------------------------------------------------------
-- scripts/seed-users.mjs で作ったアカウントをメールアドレスで引く。
-- 未作成の場合は何も起きない（NOT EXISTS で弾かれる）。
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  c RECORD;
  v_uid UUID;
  i INT;
  n INT;
BEGIN
  -- 承認済みサークルごとに、その大学の学生を最大5名まで所属させる。
  -- 先頭の1名を管理者にする（イベント作成・メンバー承認の確認用）。
  FOR c IN
    SELECT id, university_id FROM circles WHERE status = 'approved' ORDER BY id
  LOOP
    n := 0;
    FOR i IN 1..8 LOOP
      SELECT au.id INTO v_uid
      FROM auth.users au
      JOIN public.users pu ON pu.id = au.id
      JOIN public.student_profiles sp ON sp.user_id = au.id
      WHERE sp.university_id = c.university_id
        AND au.email LIKE 'student' || i || '@%'
      LIMIT 1;

      CONTINUE WHEN v_uid IS NULL;

      INSERT INTO circle_members (circle_id, user_id, role, status)
      VALUES (c.id, v_uid, CASE WHEN n = 0 THEN 'admin' ELSE 'member' END, 'active')
      ON CONFLICT (circle_id, user_id) DO NOTHING;

      n := n + 1;
      EXIT WHEN n >= 5;
    END LOOP;
  END LOOP;
END $$;


-- -----------------------------------------------------------------------------
-- 参加予定をいくつか作る（カレンダーの「参加予定」表示の確認用）
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  v_uid UUID;
  e RECORD;
  v_email TEXT;
BEGIN
  -- 各大学の student1〜3 に、見えている公開イベントを何件か登録する
  FOR v_email IN
    SELECT au.email FROM auth.users au
    JOIN public.student_profiles sp ON sp.user_id = au.id
    WHERE au.email ~ '^student[1-3]@'
  LOOP
    SELECT id INTO v_uid FROM auth.users WHERE email = v_email;
    CONTINUE WHEN v_uid IS NULL;
    CONTINUE WHEN NOT EXISTS (SELECT 1 FROM public.users WHERE id = v_uid);

    -- これから開催される公開イベントのうち3件に参加登録する
    FOR e IN
      SELECT id FROM events
      WHERE event_date >= now() AND visibility = 'public'
      ORDER BY event_date LIMIT 4
    LOOP
      INSERT INTO event_participants (event_id, user_id, status)
      VALUES (e.id, v_uid, 'going')
      ON CONFLICT (event_id, user_id) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;


-- -----------------------------------------------------------------------------
-- 確認
-- -----------------------------------------------------------------------------

SELECT
  (SELECT count(*) FROM universities)        AS 大学,
  (SELECT count(*) FROM circles)             AS サークル,
  (SELECT count(*) FROM events)              AS イベント,
  (SELECT count(*) FROM events
     WHERE event_date >= now())              AS 今後のイベント,
  (SELECT count(*) FROM facilities)          AS 施設,
  (SELECT count(*) FROM circle_members)      AS 所属,
  (SELECT count(*) FROM event_participants)  AS 参加予定;
