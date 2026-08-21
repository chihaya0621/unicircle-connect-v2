# -*- coding: utf-8 -*-
"""公開ディレクトリ用のデモデータを生成する。

架空の大学・キャンパス・サークルを作る。実在の大学と紛れないよう、
名前はすべて造語の組み合わせにしている。
UUID は添字から決め打ちにして、何度流しても増えないようにする。
"""
import random

random.seed(20260822)

PREF = {
    "北海道": ["札幌市", "函館市"], "宮城県": ["仙台市"], "福島県": ["郡山市"],
    "茨城県": ["つくば市"], "埼玉県": ["さいたま市"], "千葉県": ["千葉市", "船橋市"],
    "東京都": ["文京区", "世田谷区", "八王子市", "武蔵野市"],
    "神奈川県": ["横浜市", "川崎市", "相模原市"],
    "新潟県": ["新潟市"], "石川県": ["金沢市"], "長野県": ["松本市"],
    "静岡県": ["静岡市", "浜松市"], "愛知県": ["名古屋市", "豊橋市"],
    "京都府": ["京都市"], "大阪府": ["大阪市", "堺市", "吹田市"],
    "兵庫県": ["神戸市", "西宮市"], "奈良県": ["奈良市"],
    "岡山県": ["岡山市"], "広島県": ["広島市"], "香川県": ["高松市"],
    "愛媛県": ["松山市"], "福岡県": ["福岡市", "北九州市"],
    "熊本県": ["熊本市"], "鹿児島県": ["鹿児島市"], "沖縄県": ["那覇市"],
}

HEAD = [
    ("あさひ", "旭洋"), ("あおば", "青葉"), ("うみかぜ", "海風"), ("かがみ", "香雅美"),
    ("きたうら", "北浦"), ("こもれび", "木洩陽"), ("さくらみち", "桜路"), ("しおざき", "汐崎"),
    ("すずかぜ", "涼風"), ("そらの", "空野"), ("たかしろ", "高城"), ("つきしま", "月島"),
    ("なぎさ", "渚"), ("にしはら", "西原"), ("はくれい", "白嶺"), ("ひかりが", "光ヶ丘"),
    ("ふじさわ", "藤沢野"), ("ほしぞら", "星空"), ("まつかぜ", "松風"), ("みなみの", "南野"),
    ("むさしの", "武蔵野原"), ("もりおか", "杜丘"), ("やまなみ", "山並"), ("ゆうひ", "夕陽"),
    ("よしの", "芳野"), ("りんどう", "竜胆"), ("わかば", "若葉"), ("あまみ", "天見"),
    ("いすず", "五十鈴"), ("うずしお", "渦潮"), ("えのしま", "江ノ洲"), ("おうか", "桜霞"),
    ("かえで", "楓"), ("きりの", "霧野"), ("くさなぎ", "草薙原"), ("けやき", "欅"),
    ("こはま", "小浜野"), ("さわらび", "早蕨"), ("しらかば", "白樺"), ("すみれ", "菫"),
]
TAIL = [
    ("だいがく", "大学"), ("がくいんだいがく", "学院大学"), ("こうかだいがく", "工科大学"),
    ("こくさいだいがく", "国際大学"), ("じょしだいがく", "女子大学"), ("かがくだいがく", "科学大学"),
]

CIRCLE_POOL = [
    ("軽音楽部", "音楽"), ("吹奏楽団", "音楽"), ("合唱団", "音楽"), ("ジャズ研究会", "音楽"),
    ("アカペラサークル", "音楽"), ("テニスサークル", "スポーツ"), ("フットサル部", "スポーツ"),
    ("バスケットボール同好会", "スポーツ"), ("バドミントン部", "スポーツ"), ("陸上競技部", "スポーツ"),
    ("弓道部", "スポーツ"), ("ヨット部", "スポーツ"), ("アルティメット部", "スポーツ"),
    ("写真研究会", "文化"), ("美術部", "文化"), ("茶道部", "文化"), ("華道部", "文化"),
    ("落語研究会", "文化"), ("演劇部", "文化"), ("文芸部", "文化"), ("映画研究会", "文化"),
    ("プログラミング同好会", "学術"), ("ロボット研究会", "学術"), ("天文部", "学術"),
    ("数理科学研究会", "学術"), ("経済学研究会", "学術"), ("模擬国連", "学術"),
    ("ボランティアサークル", "社会"), ("国際交流サークル", "社会"), ("environment 研究会", "社会"),
    ("手話サークル", "社会"), ("子ども食堂サポート", "社会"), ("防災ボランティア", "社会"),
]

INTRO = {
    "音楽": "週に2回、部室とスタジオで練習しています。初心者からでも始められるよう、パート別の練習日を設けています。学園祭と定期演奏会が年2回の大きな舞台です。",
    "スポーツ": "経験者も初心者も一緒に活動しています。ケガを防ぐことを第一に、練習の前後は必ず全員でストレッチを行います。年に数回、近隣の大学と合同で練習試合を組んでいます。",
    "文化": "作品づくりと発表を軸に活動しています。週1回の集まりでは、お互いの作品を持ち寄って感想を交わします。展示や上演は学園祭のほか、学外の企画にも参加しています。",
    "学術": "興味のあるテーマを持ち寄って、輪読と制作を並行して進めています。成果は学内発表会で共有し、学外のコンテストにも挑戦しています。他学部からの参加も歓迎です。",
    "社会": "学内だけで完結しない活動を心がけています。地域の団体と連携した企画を月1回のペースで実施しており、参加の頻度は各自の予定に合わせて調整できます。",
}
SCHEDULE = ["毎週火曜 18:00 / 第1部室", "毎週水・金 17:30 / 体育館", "毎週木曜 16:30 / 学生会館3F",
            "隔週土曜 13:00 / 学外練習場", "毎週月曜 18:30 / 音楽練習室", "週2回（曜日は学期ごとに調整）"]

out = []
w = out.append
w("-- =============================================================================")
w("-- 公開ディレクトリのデモデータ（自動生成）")
w("-- =============================================================================")
w("-- 都道府県 → 大学 → サークル の導線を確かめるための架空データ。")
w("-- 実在の大学と紛れないよう、名前はすべて造語の組み合わせにしている。")
w("-- UUID は添字から決め打ちなので、何度流しても増えない。")
w("--")
w("-- 生成: scripts/gen_public_seed.py")
w("-- =============================================================================")
w("")

def uid(prefix, n):
    return "%s-0000-4000-8000-%012d" % (prefix, n)

prefs = list(PREF.keys())
unis = []
used_names = set()
for i in range(40):
    kana_h, kanji_h = HEAD[i]
    kana_t, kanji_t = random.choice(TAIL)
    name = kanji_h + kanji_t
    if name in used_names:
        continue
    used_names.add(name)
    pref = prefs[i % len(prefs)]
    unis.append({
        "id": uid("b1000000", i + 1),
        "name": name,
        "kana": kana_h + kana_t,
        "pref": pref,
        "url": "https://example.com/university/%d" % (i + 1),
    })

w("INSERT INTO universities (id, name, name_kana, prefecture, website_url) VALUES")
rows = ["  ('%s', '%s', '%s', '%s', '%s')" % (u["id"], u["name"], u["kana"], u["pref"], u["url"]) for u in unis]
w(",\n".join(rows))
w("ON CONFLICT (id) DO NOTHING;")
w("")

# キャンパス。3校に1校は2拠点、うち一部は県をまたぐ
campuses = []
cn = 0
for idx, u in enumerate(unis):
    cn += 1
    campuses.append({"id": uid("b2000000", cn), "uni": u["id"], "name": "本部キャンパス",
                     "pref": u["pref"], "addr": random.choice(PREF[u["pref"]]) + "○○1-1"})
    if idx % 3 == 0:
        cn += 1
        # 半分は隣の県に置く。県をまたぐ大学を意図的に作る
        # 一覧は北から南の順なので、隣を取れば近い県になる。
        # 末尾のときだけ手前に寄せる（沖縄の隣が北海道になるのを避ける）
        if idx % 6 == 0:
            pos = prefs.index(u["pref"])
            other = prefs[pos + 1] if pos + 1 < len(prefs) else prefs[pos - 1]
        else:
            other = u["pref"]
        city = random.choice(PREF[other])
        campuses.append({"id": uid("b2000000", cn), "uni": u["id"], "name": city + "キャンパス",
                         "pref": other, "addr": city + "△△2-3"})

w("INSERT INTO campuses (id, university_id, name, address, prefecture) VALUES")
rows = ["  ('%s', '%s', '%s', '%s', '%s')" % (c["id"], c["uni"], c["name"], c["addr"], c["pref"]) for c in campuses]
w(",\n".join(rows))
w("ON CONFLICT DO NOTHING;")
w("")

by_uni = {}
for c in campuses:
    by_uni.setdefault(c["uni"], []).append(c)

circle_rows = []
n = 0
for u in unis:
    picked = random.sample(CIRCLE_POOL, random.randint(5, 9))
    for cname, genre in picked:
        n += 1
        camp = random.choice(by_uni[u["id"]] + [None])
        scope = "public" if random.random() < 0.18 else "university"
        listed = "false" if random.random() < 0.06 else "true"
        intro = INTRO[genre]
        sched = random.choice(SCHEDULE)
        contact = "circle%d@example.com" % n
        circle_rows.append(
            "  ('%s', '%s', '%s', '%s', 'approved', '%s', %s, %s, '%s', '%s', '%s')"
            % (uid("b3000000", n), u["id"], cname, "%sの%sサークルです。" % (u["name"], genre),
               scope, ("'%s'" % camp["id"]) if camp else "NULL", listed,
               intro, sched, contact))

w("INSERT INTO circles (id, university_id, name, description, status, scope, campus_id,")
w("                     public_listed, public_intro, public_schedule, public_contact) VALUES")
w(",\n".join(circle_rows))
w("ON CONFLICT (id) DO NOTHING;")
w("")
# -----------------------------------------------------------------------------
# イベント
# -----------------------------------------------------------------------------
# 学外向け（オープンキャンパス・学園祭など）と学内向け（防災訓練・
# ガイダンスなど）を混ぜる。未ログインに出るのは前者だけになる。

OPEN = [
    ("オープンキャンパス", "学部紹介、模擬授業、キャンパスツアーを行います。高校生の方はどなたでも参加できます。保護者の方の同伴も歓迎します。"),
    ("大学祭", "模擬店、ステージ企画、研究展示を行います。地域の皆さまもぜひお越しください。入場無料です。"),
    ("公開講座", "教員による一般向けの講座です。専門知識は不要で、どなたでも受講できます。"),
    ("キャンパス見学会", "施設と設備をご案内します。在学生が案内役を務めます。"),
]
INTERNAL = [
    ("防災訓練", "全学の避難訓練を実施します。授業は一時中断します。"),
    ("図書館ガイダンス", "文献検索の使い方を説明します。"),
    ("履修相談会", "履修登録の相談を受け付けます。"),
    ("健康診断", "学年別の日程で実施します。"),
    ("就職ガイダンス", "就職活動の進め方を説明します。"),
]

event_rows = []
n_ev = 0
for u in unis:
    # 学外向け: 各大学2〜3件
    for title, desc in random.sample(OPEN, random.randint(2, 3)):
        n_ev += 1
        days = random.randint(3, 300)
        event_rows.append(
            "  ('%s', '%s', NULL, '%s%d', '%s', now() + interval '%d days', "
            "'public', ARRAY['高校生','一般'], true)"
            % (uid("b4000000", n_ev), u["id"], title, 2026, desc, days))
    # 学内向け: 各大学2〜4件
    for title, desc in random.sample(INTERNAL, random.randint(2, 4)):
        n_ev += 1
        days = random.randint(3, 200)
        vis = "public" if random.random() < 0.5 else "internal"
        event_rows.append(
            "  ('%s', '%s', NULL, '%s', '%s', now() + interval '%d days', "
            "'%s', NULL, false)"
            % (uid("b4000000", n_ev), u["id"], title, desc, days, vis))

# サークル主催。未ログインには出ないが、学生の一覧では件数が増える
CIRCLE_EVENTS = ["新歓ライブ", "練習試合", "定期演奏会", "作品展示会", "合宿説明会", "もくもく会"]
for row in circle_rows:
    if random.random() > 0.35:
        continue
    cid = row.split("'")[1]
    n_ev += 1
    days = random.randint(2, 120)
    event_rows.append(
        "  ('%s', NULL, '%s', '%s', 'メンバー向けの案内です。', "
        "now() + interval '%d days', 'public', NULL, false)"
        % (uid("b4000000", n_ev), cid, random.choice(CIRCLE_EVENTS), days))

w("INSERT INTO events (id, host_university_id, host_circle_id, title, description,")
w("                    event_date, visibility, target_grades, public_listed) VALUES")
w(",\n".join(event_rows))
w("ON CONFLICT (id) DO NOTHING;")
w("")
w("-- 確認用")
w("SELECT")
w("  (SELECT count(*) FROM universities) AS universities,")
w("  (SELECT count(*) FROM campuses)     AS campuses,")
w("  (SELECT count(DISTINCT prefecture) FROM campuses) AS prefectures,")
w("  (SELECT count(*) FROM circles WHERE status='approved') AS circles,")
w("  (SELECT count(*) FROM events WHERE event_date > now()) AS events,")
w("  (SELECT count(*) FROM events WHERE event_date > now() AND public_listed) AS public_events;")

open("supabase/seed_public_directory.sql", "w", encoding="utf-8").write("\n".join(out) + "\n")
print("大学 %d / キャンパス %d / サークル %d" % (len(unis), len(campuses), n))
print("県またぎの大学:", sum(1 for u in unis if len({c['pref'] for c in by_uni[u['id']]}) > 1))
