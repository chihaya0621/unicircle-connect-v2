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
