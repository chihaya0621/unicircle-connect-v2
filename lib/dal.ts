import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import type { Tables, UserRole } from "@/lib/database.types";
import { createClient } from "@/lib/supabase-server";

export type CurrentUser = Pick<Tables<"users">, "id" | "role" | "name"> & {
  email: string | null;
};

/**
 * 認証済みユーザーを取得する。未ログインなら null。
 *
 * `getUser()` は Supabase Auth サーバーに問い合わせて JWT を検証するため、
 * Cookie を信用する `getSession()` より安全。サーバー側では必ずこちらを使う。
 *
 * React の `cache` で包んでいるので、1回のレンダリング中に何度呼んでも
 * 実際のリクエストは1回に集約される。
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;

  // auth.users に居ても public.users 行が無い場合がある
  // （トリガー導入前に作られたアカウント等）。その場合も null 扱いにせず、
  // 呼び出し側が「プロフィール未作成」を判別できるようにしたいので分けて返す。
  const { data: profile } = await supabase
    .from("users")
    .select("id, role, name")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) return null;

  return { ...profile, email: user.email ?? null };
});

/**
 * ログイン必須ページ用。未ログインならログイン画面へリダイレクトする。
 */
export const requireUser = cache(async (): Promise<CurrentUser> => {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
});

/**
 * ロール必須ページ用。権限が足りなければダッシュボードへ戻す。
 *
 * 認可チェックはデータソースの近くで行うのが原則なので、
 * 画面表示だけでなく Server Action 内でも必ずこれを通すこと。
 */
export async function requireRole(
  ...allowed: UserRole[]
): Promise<CurrentUser> {
  const user = await requireUser();
  if (!allowed.includes(user.role)) redirect("/dashboard");
  return user;
}
