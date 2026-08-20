/**
 * 開発用テストユーザーの名簿。
 *
 * ここが唯一の定義。以下の2つが同じ名簿を参照する:
 *   - scripts/seed-users.mjs … 実際にアカウントを作る
 *   - lib/dev-users.ts       … クイックログインUIに一覧を出す
 *
 * 以前は両方で同じ生成ロジックを書いていたため、片方だけ直すと
 * 「一覧には出るがログインできない」状態になり得た。
 *
 * Next.js からも Node の単体実行からも読めるよう、素の ESM で書いている。
 */

/** 全テストユーザー共通のパスワード。開発専用。 */
export const DEV_PASSWORD = "devpassword123";

/** seed.sql / seed_demo.sql の固定 UUID と対応 */
export const UNIVERSITIES = [
  { key: "aozora", id: "a0000000-0000-4000-8000-000000000001", name: "青空大学" },
  { key: "umihara", id: "a0000000-0000-4000-8000-000000000002", name: "海原大学" },
  { key: "yamate", id: "a0000000-0000-4000-8000-000000000003", name: "山手工科大学" },
  { key: "sakuragaoka", id: "a0000000-0000-4000-8000-000000000004", name: "桜丘大学" },
  { key: "hokuto", id: "a0000000-0000-4000-8000-000000000005", name: "北都大学" },
  { key: "seiryo", id: "a0000000-0000-4000-8000-000000000006", name: "西陵学院大学" },
];

/** 各大学あたりの学生数 */
export const STUDENTS_PER_UNIVERSITY = 8;

/**
 * 職員を置く大学。要件上、職員は施設マスタ管理とサークル・予約の承認を
 * 担うので全大学に必要だが、動作確認では数名で足りるため主要3校に絞る。
 */
export const STAFF_UNIVERSITY_KEYS = ["aozora", "umihara", "yamate"];

const SURNAMES = [
  "佐藤", "鈴木", "高橋", "田中", "伊藤", "渡辺", "山本", "中村",
  "小林", "加藤", "吉田", "山田", "佐々木", "山口", "松本", "井上",
  "木村", "林", "斎藤", "清水", "山崎", "森", "池田", "橋本",
];
const ORDINALS = ["太郎", "次郎", "三郎", "四郎", "五郎"];

/**
 * 学生の氏名を組み立てる。
 * 通し番号から姓と名を決めるので、人数を増やしても重複しない。
 */
function studentName(globalIndex) {
  const surname = SURNAMES[globalIndex % SURNAMES.length];
  const ordinal = ORDINALS[Math.floor(globalIndex / SURNAMES.length) % ORDINALS.length];
  return `${surname}${ordinal}`;
}

/**
 * 全テストユーザーを組み立てる。
 *
 * staff はセルフサインアップできない設計（権限昇格の防止）なので、
 * 作成時のロールは general とし、promoteTo でその意図を持たせる。
 */
export function buildDevUsers() {
  const users = [];

  UNIVERSITIES.forEach((uni, u) => {
    for (let i = 1; i <= STUDENTS_PER_UNIVERSITY; i++) {
      const globalIndex = u * STUDENTS_PER_UNIVERSITY + (i - 1);
      users.push({
        email: `student${i}@${uni.key}.test`,
        name: studentName(globalIndex),
        role: "student",
        university_id: uni.id,
        universityName: uni.name,
        // 1〜4年生が混ざるようにする
        enrollment_year: String(2026 - ((i - 1) % 4)),
      });
    }
  });

  for (const key of STAFF_UNIVERSITY_KEYS) {
    const uni = UNIVERSITIES.find((x) => x.key === key);
    users.push({
      email: `staff1@${uni.key}.test`,
      name: `${uni.name.slice(0, 2)}職員`,
      role: "general",
      promoteTo: "staff",
      university_id: uni.id,
      universityName: uni.name,
    });
  }

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
