/**
 * 開発用クイックログインの定義。
 *
 * scripts/seed-users.mjs が作るアカウントと対応している。
 * どちらかを変更したら、もう一方も合わせること。
 */

/** 開発環境かどうか。本番ビルドでは false に固定される。 */
export const IS_DEV = process.env.NODE_ENV !== "production";

export const DEV_PASSWORD = "devpassword123";

export type DevUser = {
  email: string;
  name: string;
  role: "student" | "staff" | "general";
  university: string;
};

const UNIVERSITIES = [
  { key: "aozora", name: "青空大学" },
  { key: "umihara", name: "海原大学" },
  { key: "yamate", name: "山手工科大学" },
] as const;

const SURNAMES = ["佐藤", "鈴木", "高橋", "伊藤", "渡辺", "中村", "小林", "加藤"];
const ORDINALS = ["太郎", "次郎", "三郎", "四郎", "五郎"];

function buildDevUsers(): DevUser[] {
  const users: DevUser[] = [];
  let n = 0;

  for (const uni of UNIVERSITIES) {
    for (let i = 1; i <= 3; i++) {
      users.push({
        email: `student${i}@${uni.key}.test`,
        name: `${SURNAMES[n % SURNAMES.length]}${ORDINALS[(i - 1) % ORDINALS.length]}`,
        role: "student",
        university: uni.name,
      });
      n++;
    }
  }

  for (const uni of UNIVERSITIES) {
    users.push({
      email: `staff1@${uni.key}.test`,
      name: `職員${ORDINALS[0]}`,
      role: "staff",
      university: uni.name,
    });
  }

  for (let i = 1; i <= 2; i++) {
    users.push({
      email: `general${i}@example.test`,
      name: `一般${ORDINALS[i - 1]}`,
      role: "general",
      university: "—",
    });
  }

  return users;
}

export const DEV_USERS = buildDevUsers();
