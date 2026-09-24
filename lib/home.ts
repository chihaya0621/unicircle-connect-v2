import type { UserRole } from "@/lib/database.types";

/**
 * 役割ごとの初期到達点。
 *
 * 学生はログインしたらまず自分の予定が見えるとよい。
 * 職員の毎日の仕事は承認なので、押すものが並ぶ対応待ちへ送る。
 * カレンダーに着地させていたころは、「参加予定のイベントはありません」
 * とだけ出て、承認の字が1つも無かった。
 * 一般ユーザー（高校生・企業）は予定を持たないので、カレンダーに
 * 着地させると空の画面になる。探す場所へ送る。
 *
 * ログイン処理（app/actions/auth.ts）と、ログイン済みで /login に
 * 来た人の差し戻し（proxy.ts）の両方から参照する。片方だけ直すと
 * 「ログイン直後はサークル一覧、再訪時はカレンダー」とちぐはぐになる。
 */
export const HOME_BY_ROLE: Record<UserRole, string> = {
  student: "/calendar",
  staff: "/staff",
  general: "/circles",
};

/** 役割が分からないときの行き先 */
export const DEFAULT_HOME = "/calendar";

export function homeForRole(role: string | null | undefined): string {
  return HOME_BY_ROLE[role as UserRole] ?? DEFAULT_HOME;
}
