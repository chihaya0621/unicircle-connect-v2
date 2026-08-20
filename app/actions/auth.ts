"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { DEV_PASSWORD, DEV_USERS, IS_DEV } from "@/lib/dev-users";
import { createClient } from "@/lib/supabase-server";

export type AuthFormState = {
  error?: string;
  /** メール確認が必要な場合に表示するメッセージ */
  notice?: string;
} | null;

/** 認証済みユーザーの初期到達点 */
const DEFAULT_REDIRECT = "/dashboard";

/** オープンリダイレクト防止: 自サイト内の相対パスのみ許可する */
function safeRedirect(next: FormDataEntryValue | null): string {
  if (typeof next !== "string") return DEFAULT_REDIRECT;
  if (!next.startsWith("/") || next.startsWith("//")) return DEFAULT_REDIRECT;
  return next;
}

export async function signUp(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const role = String(formData.get("role") ?? "general");
  const universityId = String(formData.get("university_id") ?? "");
  const enrollmentYear = String(formData.get("enrollment_year") ?? "");

  if (!email || !password || !name) {
    return { error: "氏名・メールアドレス・パスワードは必須です。" };
  }
  if (password.length < 8) {
    return { error: "パスワードは8文字以上で入力してください。" };
  }
  // staff はセルフサインアップ不可（DB トリガー側でも general に落とされる）。
  // ここで弾くのは UI 上の親切であって、防御の本体はトリガー側。
  if (role !== "student" && role !== "general") {
    return { error: "選択できないアカウント種別です。" };
  }
  if (role === "student" && !universityId) {
    return { error: "学生アカウントには大学の選択が必要です。" };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // ここに渡した値が raw_user_meta_data として保存され、
      // handle_new_user() トリガーが読み取って users / student_profiles を作る。
      data: {
        name,
        role,
        university_id: role === "student" ? universityId : "",
        enrollment_year: role === "student" ? enrollmentYear : "",
      },
    },
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
  redirect(next);
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
  redirect(next);
}
