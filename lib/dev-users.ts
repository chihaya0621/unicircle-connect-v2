/**
 * 開発用クイックログインが参照する名簿。
 *
 * 実体は lib/dev-users.mjs にあり、scripts/seed-users.mjs と共有している。
 * ここでは型を付けて再エクスポートするだけにとどめ、名簿の定義を
 * 二重に持たないようにしている。
 */

import {
  DEV_PASSWORD as PASSWORD,
  buildDevUsers,
  UNIVERSITIES as UNIS,
} from "@/lib/dev-users.mjs";

/** 開発環境かどうか。本番ビルドでは false に固定される。 */
export const IS_DEV = process.env.NODE_ENV !== "production";

/**
 * 公開しているデモ環境かどうか。
 *
 * 展示や採用の場で「その場で触ってもらう」ために、本番ビルドでも
 * クイックログインを開けるようにする。既定は無効で、環境変数を
 * 明示的に "1" にしたときだけ有効になる。
 *
 * 【承知のうえの取り引き】これを有効にすると、URL を知っている人は
 * 誰でも職員としてログインし、データを書き換えられる。中身が
 * 架空のデモデータであることが前提。実在の情報を入れる環境では
 * 絶対に立てないこと。
 */
export const IS_DEMO = process.env.NEXT_PUBLIC_ENABLE_DEMO_LOGIN === "1";

/** クイックログインを出すか。開発環境か、公開デモ環境のとき。 */
export const QUICK_LOGIN_ENABLED = IS_DEV || IS_DEMO;

export const DEV_PASSWORD: string = PASSWORD;

export type DevUser = {
  email: string;
  name: string;
  role: "student" | "staff" | "general";
  university: string;
};

type RosterEntry = {
  email: string;
  name: string;
  role: string;
  promoteTo?: string;
  universityName: string;
};

export const UNIVERSITIES: { key: string; id: string; name: string }[] = UNIS;

export const DEV_USERS: DevUser[] = (buildDevUsers() as RosterEntry[]).map(
  (u) => ({
    email: u.email,
    name: u.name,
    // 作成時は general でも、昇格予定なら職員として一覧に出す
    role: (u.promoteTo ?? u.role) as DevUser["role"],
    university: u.universityName,
  }),
);
