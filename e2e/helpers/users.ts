/**
 * テストで使う登場人物と、決め打ちのデータ。
 *
 * 開発用の名簿（lib/dev-users.mjs）から選んでいる。E2E 専用の
 * アカウントを別に作らないのは、作ったぶんだけ公開デモの一覧に
 * 並んでしまい、来場者が何を選べばいいか分からなくなるため。
 */
export const PASSWORD = "devpassword123";

export const USERS = {
  student: { email: "student1@aozora.test", name: "佐藤太郎" },
  staff: { email: "staff1@aozora.test", name: "青空職員太郎" },
  general: { email: "general1@example.test", name: "一般太郎" },
} as const;

export type Role = keyof typeof USERS;

/** 保存したログイン状態の置き場 */
export const statePath = (role: Role) => `e2e/.auth/${role}.json`;

/**
 * 学生1が管理者をしているサークル。在籍5名。
 *
 * seed_demo.sql が固定 UUID で作るので、流し直しても変わらない。
 * 画面から探させると、名前が変わっただけでテストが落ちる。
 */
export const CIRCLE = {
  id: "c0000000-0000-4000-8000-000000000001",
  name: "軽音楽部",
} as const;

/**
 * 学外にも出している大学主催のイベント。seed.sql の固定 UUID。
 *
 * 一覧からリンクを探して押す作りにすると、並び順や件数が変わるだけで
 * 落ちる。確かめたいのは「遷移できること」ではなく「そこで何が出るか」
 * なので、行き先は決め打ちにする。
 */
export const PUBLIC_EVENT = {
  id: "e0000000-0000-4000-8000-000000000001",
  title: "オープンキャンパス2026",
} as const;

/** 役割ごとの、ログイン直後の着地点（lib/home.ts と対応） */
export const HOME = {
  student: "/calendar",
  staff: "/staff",
  general: "/circles",
} as const;
