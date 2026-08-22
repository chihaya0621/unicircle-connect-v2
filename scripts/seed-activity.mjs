/**
 * 通知の動きを確かめるためのデモ操作。
 *
 *   npm run db:activity
 *
 * テストユーザーとして実際にログインし、アプリと同じ RPC を呼ぶ。
 * 画面から操作した場合とまったく同じ経路を通るので、通知トリガーも
 * 本番同様に動作する。SQL を直接叩くのとは違い、権限判定も実際に効く。
 *
 * 前提:
 *   - npm run db:users でテストユーザーが作成済み
 *   - supabase/promote_staff.sql を実行済み
 *   - migrations/0014_notifications.sql まで適用済み
 *
 * 何度実行しても壊れないが、そのぶん通知は増える。
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

import { DEV_PASSWORD } from "../lib/dev-users.mjs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!URL_ || !KEY) {
  console.error("`.env.local` に Supabase の接続情報がありません。");
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** メールアドレスでログインしたクライアントを返す */
async function login(email) {
  const sb = createClient(URL_, KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await sb.auth.signInWithPassword({
    email,
    password: DEV_PASSWORD,
  });
  if (error) throw new Error(`${email} のログインに失敗: ${error.message}`);
  return { sb, uid: data.user.id, email };
}

/** RPC を呼んで結果を1行で報告する */
async function call(actor, label, fn) {
  const { data, error } = await fn(actor.sb);
  if (error) {
    console.log(`  ✗ ${label}\n      ${error.message}`);
    return null;
  }
  console.log(`  ✓ ${label}`);
  return data;
}

// --- 事前チェック --------------------------------------------------------
{
  const probe = createClient(URL_, KEY);
  const { error } = await probe.from("notifications").select("id").limit(1);
  if (error) {
    console.error(
      "notifications テーブルがありません。\n" +
        "先に supabase/migrations/0014_notifications.sql を実行してください。",
    );
    process.exit(1);
  }
}

console.log("テストユーザーとしてログインします…\n");

const staff = await login("staff1@aozora.test");
const a = await login("student1@aozora.test");
const b = await login("student2@aozora.test");
const c = await login("student3@aozora.test");

const stamp = new Date().toISOString().slice(5, 16).replace("T", " ");
const soon = (days, hour = 18) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};

console.log("\n── サークル設立 ──");
const circleId = await call(b, "学生Bが「写真同好会」を設立申請", (sb) =>
  sb.rpc("create_circle", {
    p_name: `写真同好会 ${stamp}`,
    p_description: "デモ用に作成されたサークルです。",
    p_scope: "university",
  }),
);
console.log("      → 青空大学の職員に「申請が届きました」");

if (circleId) {
  await sleep(300);
  await call(staff, "職員が設立を承認", (sb) =>
    sb.rpc("decide_circle", { p_circle_id: circleId, p_approve: true }),
  );
  console.log("      → 学生B（管理者）に「承認されました」");

  console.log("\n── 参加申請 ──");
  await sleep(300);
  await call(c, "学生Cが参加を申請", (sb) =>
    sb.rpc("request_join_circle", { p_circle_id: circleId }),
  );
  console.log("      → 学生B（管理者）に「参加申請が届きました」");

  await sleep(300);
  await call(b, "学生Bが参加を承認", (sb) =>
    sb.rpc("decide_circle_member", {
      p_circle_id: circleId,
      p_user_id: c.uid,
      p_approve: true,
    }),
  );
  console.log("      → 学生Cに「参加が承認されました」");

  console.log("\n── 掲示板 ──");
  await sleep(300);
  await call(b, "学生Bがお知らせを投稿（固定）", (sb) =>
    sb.rpc("create_circle_post", {
      p_circle_id: circleId,
      p_body: "【重要】今週末に撮影会を行います。集合は9時、正門前です。",
      p_pinned: true,
    }),
  );
  await call(b, "学生Bが通常の投稿", (sb) =>
    sb.rpc("create_circle_post", {
      p_circle_id: circleId,
      p_body: "レンズを貸してくれる人いませんか？",
    }),
  );
  console.log("      → メンバー（学生C）に「新しい投稿」");

  console.log("\n── サークルのイベント ──");
  await sleep(300);
  await call(b, "学生Bがサークルイベントを作成", (sb) =>
    sb.rpc("create_event", {
      p_title: `撮影会 ${stamp}`,
      p_event_date: soon(5, 9),
      p_description: "正門前集合。カメラを持参してください。",
      p_visibility: "internal",
      p_circle_id: circleId,
    }),
  );
  console.log("      → メンバー（学生C）に「新しいイベント」");
}

console.log("\n── 大学公式イベント ──");
await sleep(300);
await call(staff, "職員が大学公式イベントを作成", (sb) =>
  sb.rpc("create_event", {
    p_title: `キャンパス見学会 ${stamp}`,
    p_event_date: soon(10, 13),
    p_description: "在学生向けの施設案内です。",
    p_visibility: "public",
  }),
);
console.log("      → 青空大学の学生全員に「新しいイベント」");

console.log("\n── 施設予約 ──");
const { data: facilities } = await a.sb
  .from("facilities")
  .select("id, name")
  .eq("is_available", true)
  .limit(1);

if (facilities?.length) {
  const facility = facilities[0];
  // 重複しないよう、実行のたびに違う時間帯を選ぶ
  const offset = 20 + (new Date().getMinutes() % 30);
  const reservationId = await call(
    a,
    `学生Aが「${facility.name}」を予約申請`,
    (sb) =>
      sb.rpc("create_reservation", {
        p_facility_id: facility.id,
        p_start: soon(offset, 10),
        p_end: soon(offset, 12),
        p_purpose: "デモ用の予約です",
      }),
  );
  console.log("      → 青空大学の職員に「予約申請が届きました」");

  if (reservationId) {
    await sleep(300);
    await call(staff, "職員が予約を承認", (sb) =>
      sb.rpc("decide_reservation", {
        p_reservation_id: reservationId,
        p_approve: true,
      }),
    );
    console.log("      → 学生Aに「予約が承認されました」");
  }
} else {
  console.log("  － 予約できる施設が見つかりませんでした");
}

// --- 結果 ----------------------------------------------------------------
console.log("\n── 各ユーザーの未読通知 ──");
for (const actor of [staff, a, b, c]) {
  const { count } = await actor.sb
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);
  console.log(`  ${actor.email.padEnd(24)} 未読 ${count ?? 0} 件`);
}

for (const actor of [staff, a, b, c]) await actor.sb.auth.signOut();

console.log("\n各アカウントでログインして、ヘッダーの🔔を確認してください。");
