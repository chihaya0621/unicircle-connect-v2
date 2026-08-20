/**
 * 開発用テストユーザーを一括作成する。
 *
 *   npm run db:users
 *
 * 匿名キーの signUp を使うため service_role キーは不要。
 * users / student_profiles は handle_new_user トリガーが自動生成する。
 *
 * staff はセルフサインアップできない設計なので、いったん general として
 * 作成し、最後に出力される SQL を SQL Editor で実行して昇格させる。
 *
 * 何度実行しても安全。既に存在するアカウントはスキップする。
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "node:fs";

// .env.local を読む（Next.js を通さず単体で動かすため）
const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((line) => line.includes("="))
    .map((line) => {
      const i = line.indexOf("=");
      return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
    }),
);

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("`.env.local` に Supabase の接続情報がありません。");
  process.exit(1);
}

/** 全テストユーザー共通のパスワード。開発専用。 */
export const DEV_PASSWORD = "devpassword123";

/** seed.sql の固定 UUID と対応 */
const UNIVERSITIES = [
  { key: "aozora", id: "a0000000-0000-4000-8000-000000000001", name: "青空大学" },
  { key: "umihara", id: "a0000000-0000-4000-8000-000000000002", name: "海原大学" },
  { key: "yamate", id: "a0000000-0000-4000-8000-000000000003", name: "山手工科大学" },
];

/** 既存ユーザーに合わせた「苗字 + 太郎/次郎/…」の命名 */
const SURNAMES = ["佐藤", "鈴木", "高橋", "伊藤", "渡辺", "中村", "小林", "加藤"];
const ORDINALS = ["太郎", "次郎", "三郎", "四郎", "五郎"];

function buildUsers() {
  const users = [];
  let n = 0;

  // 各大学に学生3名
  for (const uni of UNIVERSITIES) {
    for (let i = 1; i <= 3; i++) {
      users.push({
        email: `student${i}@${uni.key}.test`,
        name: `${SURNAMES[n % SURNAMES.length]}${ORDINALS[(i - 1) % ORDINALS.length]}`,
        role: "student",
        university_id: uni.id,
        universityName: uni.name,
        enrollment_year: String(2024 + (i % 3)),
      });
      n++;
    }
  }

  // 各大学に職員1名（作成時は general、あとで昇格）
  for (const uni of UNIVERSITIES) {
    users.push({
      email: `staff1@${uni.key}.test`,
      name: `職員${ORDINALS[0]}`,
      role: "general",
      promoteTo: "staff",
      university_id: uni.id,
      universityName: uni.name,
    });
  }

  // 一般ユーザー2名（大学に属さない）
  for (let i = 1; i <= 2; i++) {
    users.push({
      email: `general${i}@example.test`,
      name: `一般${ORDINALS[i - 1]}`,
      role: "general",
      universityName: "—",
    });
  }

  return users;
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const users = buildUsers();

console.log(`${users.length} 件のテストユーザーを作成します…\n`);

const created = [];
const skipped = [];
const failed = [];

for (const u of users) {
  const { data, error } = await supabase.auth.signUp({
    email: u.email,
    password: DEV_PASSWORD,
    options: {
      data: {
        name: u.name,
        role: u.role,
        university_id: u.role === "student" ? u.university_id : "",
        enrollment_year: u.enrollment_year ?? "",
      },
    },
  });

  if (error) {
    // 既に登録済みの場合はエラーになるが、これは正常な結果として扱う
    if (/already|registered|exists/i.test(error.message)) {
      skipped.push(u);
      console.log(`  - ${u.email} (登録済みのためスキップ)`);
    } else {
      failed.push({ ...u, reason: error.message });
      console.log(`  ✗ ${u.email} — ${error.message}`);
    }
  } else if (data.user) {
    created.push(u);
    console.log(`  ✓ ${u.email} — ${u.name}`);
  }

  // Supabase のサインアップにはレート制限があるため間隔を空ける
  await new Promise((r) => setTimeout(r, 600));
}

// サインアップ後は最後のアカウントのセッションが残るのでログアウトしておく
await supabase.auth.signOut();

console.log(
  `\n作成 ${created.length} / スキップ ${skipped.length} / 失敗 ${failed.length}`,
);

// --- 職員昇格用の SQL を出力 ---------------------------------------------
const toPromote = users.filter((u) => u.promoteTo === "staff");
const promoteSql = [
  "-- 職員アカウントへの昇格（Supabase SQL Editor で実行してください）",
  "-- staff はセルフサインアップできない設計のため、この手順が必要です。",
  ...toPromote.map(
    (u) => `select public.promote_to_staff('${u.email}', '${u.university_id}');`,
  ),
  "",
].join("\n");

writeFileSync(new URL("../supabase/promote_staff.sql", import.meta.url), promoteSql);

// --- 一覧を Markdown で出力 ----------------------------------------------
const rows = users.map((u) => {
  const role = u.promoteTo ?? u.role;
  const label = { student: "学生", staff: "職員", general: "一般" }[role];
  return `| ${u.email} | ${u.name} | ${label} | ${u.universityName} |`;
});

const doc = `# 開発用テストユーザー

\`npm run db:users\` で作成される開発専用アカウントの一覧です。
**パスワードは全員共通で \`${DEV_PASSWORD}\` です。**

> 開発用のダミーアカウントです。本番環境では絶対に使わないでください。
> メールアドレスは \`.test\` ドメイン（RFC 2606 の予約ドメイン）なので、
> 実在のアドレスに誤送信されることはありません。

| メールアドレス | 氏名 | ロール | 大学 |
| --- | --- | --- | --- |
${rows.join("\n")}

## 職員アカウントについて

\`staff\` はセルフサインアップできない設計（権限昇格を防ぐため）なので、
スクリプトはいったん \`general\` として作成します。
\`supabase/promote_staff.sql\` を SQL Editor で実行して昇格させてください。

## ユーザーの切り替え

開発サーバーではログイン画面に「開発用クイックログイン」パネルが出ます。
一覧から選ぶだけで切り替わります。\`NODE_ENV=production\` では表示されません。
`;

writeFileSync(new URL("../docs/dev-users.md", import.meta.url), doc);

console.log("\n生成しました:");
console.log("  docs/dev-users.md          … アカウント一覧");
console.log("  supabase/promote_staff.sql … 職員昇格用SQL");
console.log("\n次の手順: supabase/promote_staff.sql を SQL Editor で実行してください。");
