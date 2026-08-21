"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { UserRole } from "@/lib/database.types";
import { DEV_PASSWORD, DEV_USERS, IS_DEV } from "@/lib/dev-users";
import { createClient } from "@/lib/supabase-server";

export type AuthFormState = {
  error?: string;
  /** メール確認が必要な場合に表示するメッセージ */
  notice?: string;
} | null;

/**
 * 役割ごとの初期到達点。
 *
 * 学生・職員はログインしたらまず自分の予定が見えるとよい。
 * 一般ユーザー（高校生・企業）は予定を持たないので、
 * カレンダーに着地させると空の画面になる。探す場所へ送る。
 */
const HOME_BY_ROLE: Record<UserRole, string> = {
  student: "/calendar",
  staff: "/calendar",
  general: "/circles",
};

const DEFAULT_REDIRECT = "/calendar";

/** ログイン直後の行き先。役割が分からなければ既定へ。 */
async function homeForCurrentUser(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return DEFAULT_REDIRECT;

  const { data } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  return HOME_BY_ROLE[data?.role as UserRole] ?? DEFAULT_REDIRECT;
}

/** オープンリダイレクト防止: 自サイト内の相対パスのみ許可する */
function safeRedirect(next: FormDataEntryValue | null): string | null {
  if (typeof next !== "string") return null;
  if (!next.startsWith("/") || next.startsWith("//")) return null;
  return next;
}

/**
 * 新規登録。
 *
 * ここで作れるのは一般ユーザーのみ。role を引数で受け取らないので、
 * リクエストを改変しても学生・職員にはなれない。
 * DB のトリガー側でも 'general' 固定にしてあり、二重に守っている。
 */
export async function signUp(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "").trim();

  if (!email || !password || !name) {
    return { error: "表示名・メールアドレス・パスワードは必須です。" };
  }
  if (password.length < 8) {
    return { error: "パスワードは8文字以上で入力してください。" };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    // 渡すのは表示名だけ。role や所属大学は受け付けない。
    options: { data: { name } },
  });

  if (error) {
    return { error: error.message };
  }

  // メール確認が有効な場合、この時点ではセッションが張られない。
  if (!data.session) {
    return {
      notice:
        "確認メールを送信しました。メール内のリンクを開いて登録を完了してください。",
    };
  }

  revalidatePath("/", "layout");
  redirect(DEFAULT_REDIRECT);
}

export async function signIn(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeRedirect(formData.get("next"));

  if (!email || !password) {
    return { error: "メールアドレスとパスワードを入力してください。" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // 認証失敗の理由を細かく返すとアカウント存在有無の推測に使われるため、
    // 意図的に一本化したメッセージを返す。
    return { error: "メールアドレスまたはパスワードが正しくありません。" };
  }

  revalidatePath("/", "layout");
  redirect(next ?? (await homeForCurrentUser(supabase)));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();

  revalidatePath("/", "layout");
  redirect("/login");
}

/**
 * 開発用クイックログイン。
 *
 * 【安全性】本番では絶対に動かないよう、ここで環境を再チェックする。
 * 画面を出すかどうかの判断（ページ側）とは独立に、Server Action 自体が
 * 拒否するので、万一 UI が本番に混入しても呼び出せない。
 *
 * さらに、渡されたメールアドレスが DEV_USERS に載っているものだけを
 * 受け付ける。任意のアドレスに共通パスワードでログインを試せる
 * 踏み台にしないため。
 */
export async function devQuickLogin(formData: FormData): Promise<void> {
  if (!IS_DEV) {
    throw new Error("この機能は開発環境でのみ利用できます。");
  }

  const email = String(formData.get("email") ?? "");
  if (!DEV_USERS.some((u) => u.email === email)) {
    throw new Error("開発用ユーザーとして登録されていないアドレスです。");
  }

  const next = safeRedirect(formData.get("next"));

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: DEV_PASSWORD,
  });

  if (error) {
    throw new Error(
      `ログインできませんでした（${error.message}）。` +
        "`npm run db:users` でテストユーザーを作成してください。",
    );
  }

  revalidatePath("/", "layout");
  redirect(next ?? (await homeForCurrentUser(supabase)));
}
