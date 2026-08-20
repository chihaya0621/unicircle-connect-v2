/**
 * 開発用テストユーザーを一括作成する。
 *
 *   npm run db:users
 *
 * 匿名キーの signUp を使うため service_role キーは不要。
 * users / student_profiles は handle_new_user トリガーが自動生成する。
 *
 * 名簿の定義は lib/dev-users.mjs にある（クイックログインUIと共有）。
 *
 * 何度実行しても安全。作成済みのアカウントはスキップするので、
 * レート制限で途中終了しても、再実行すれば続きから作成される。
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "node:fs";

import { DEV_PASSWORD, buildDevUsers } from "../lib/dev-users.mjs";

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

/** 連続作成の間隔(ms)。Supabase 側のレート制限を避けるため空ける。 */
const BASE_DELAY = 700;
/** レート制限に当たったときの待機の上限(ms) */
const MAX_BACKOFF = 60_000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const isAlreadyRegistered = (message) =>
  /already|registered|exists/i.test(message);
const isRateLimited = (message, status) =>
  status === 429 || /rate limit|too many|security purposes/i.test(message);

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const users = buildDevUsers();

console.log(`${users.length} 件のテストユーザーを処理します。`);
console.log("（作成済みのものはスキップします）\n");

const created = [];
const skipped = [];
const failed = [];

for (const u of users) {
  let backoff = 5_000;
  let done = false;

  // レート制限に当たったら待って再試行する。
  // 数十件をまとめて作ると Supabase 側の上限に触れるため。
  while (!done) {
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

    if (!error) {
      if (data.user) {
        created.push(u);
        console.log(`  ✓ ${u.email.padEnd(28)} ${u.name}`);
      }
      done = true;
    } else if (isAlreadyRegistered(error.message)) {
      skipped.push(u);
      done = true;
    } else if (isRateLimited(error.message, error.status)) {
      console.log(
        `  … レート制限のため ${Math.round(backoff / 1000)} 秒待機します (${u.email})`,
      );
      await sleep(backoff);
      backoff = Math.min(backoff * 2, MAX_BACKOFF);
    } else {
      failed.push({ ...u, reason: error.message });
      console.log(`  ✗ ${u.email} — ${error.message}`);
      done = true;
    }
  }

  await sleep(BASE_DELAY);
}

// 最後に作ったアカウントのセッションが残るのでログアウトしておく
await supabase.auth.signOut();

console.log(
  `\n作成 ${created.length} / スキップ ${skipped.length} / 失敗 ${failed.length}`,
);

if (failed.length > 0) {
  console.log(
    "\n失敗したアカウントがあります。時間をおいて再実行すると続きから作成されます。",
  );
}

// --- 職員昇格用の SQL ---------------------------------------------------
const toPromote = users.filter((u) => u.promoteTo === "staff");
writeFileSync(
  new URL("../supabase/promote_staff.sql", import.meta.url),
  [
    "-- 職員アカウントへの昇格（Supabase SQL Editor で実行してください）",
    "-- staff はセルフサインアップできない設計のため、この手順が必要です。",
    ...toPromote.map(
      (u) => `select public.promote_to_staff('${u.email}', '${u.university_id}');`,
    ),
    "",
  ].join("\n"),
);

// --- 一覧を Markdown で出力 ---------------------------------------------
const byUniversity = new Map();
for (const u of users) {
  const list = byUniversity.get(u.universityName) ?? [];
  list.push(u);
  byUniversity.set(u.universityName, list);
}

const sections = [...byUniversity.entries()].map(([university, list]) => {
  const rows = list.map((u) => {
    const role = u.promoteTo ?? u.role;
    const label = { student: "学生", staff: "職員", general: "一般" }[role];
    return `| ${u.email} | ${u.name} | ${label} |`;
  });
  return `### ${university}\n\n| メールアドレス | 氏名 | ロール |\n| --- | --- | --- |\n${rows.join("\n")}`;
});

writeFileSync(
  new URL("../docs/dev-users.md", import.meta.url),
  `# 開発用テストユーザー

\`npm run db:users\` で作成される開発専用アカウントの一覧です。
**パスワードは全員共通で \`${DEV_PASSWORD}\` です。**

> 開発用のダミーアカウントです。本番環境では絶対に使わないでください。
> メールアドレスは \`.test\` ドメイン（RFC 2606 の予約ドメイン）なので、
> 実在のアドレスに誤送信されることはありません。

合計 ${users.length} 名。

${sections.join("\n\n")}

## 職員アカウントについて

\`staff\` はセルフサインアップできない設計（権限昇格を防ぐため）なので、
スクリプトはいったん \`general\` として作成します。
\`supabase/promote_staff.sql\` を SQL Editor で実行して昇格させてください。

## ユーザーの切り替え

開発サーバーではログイン画面に「開発用クイックログイン」パネルが出ます。
一覧から選ぶだけで切り替わります。\`NODE_ENV=production\` では表示されません。
`,
);

console.log("\n生成しました:");
console.log("  docs/dev-users.md          … アカウント一覧");
console.log("  supabase/promote_staff.sql … 職員昇格用SQL");
console.log("\n次の手順: supabase/promote_staff.sql を SQL Editor で実行してください。");
