"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { DEV_PASSWORD, DEV_USERS, QUICK_LOGIN_ENABLED } from "@/lib/dev-users";
import { DEFAULT_HOME, HOME_BY_ROLE, homeForRole } from "@/lib/home";
import { createClient } from "@/lib/supabase-server";

export type AuthFormState = {
  error?: string;
  /** メール確認が必要な場合に表示するメッセージ */
  notice?: string;
} | null;

/** ログイン直後の行き先。役割が分からなければ既定へ。 */
async function homeForCurrentUser(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return DEFAULT_HOME;

  const { data } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  return homeForRole(data?.role);
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
  // ここで作れるのは一般ユーザーだけなので、役割を引き直す必要はない
  redirect(HOME_BY_ROLE.general);
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
 * 【安全性】開発環境か、明示的に立てた公開デモ環境でしか動かないよう、
 * ここで再チェックする。画面を出すかどうかの判断（ページ側）とは独立に
 * Server Action 自体が拒否するので、万一 UI だけが混入しても呼べない。
 *
 * さらに、渡されたメールアドレスが DEV_USERS に載っているものだけを
 * 受け付ける。任意のアドレスに共通パスワードでログインを試せる
 * 踏み台にしないため。環境変数を切り替えても、この名簿の縛りは残る。
 */
export async function devQuickLogin(formData: FormData): Promise<void> {
  if (!QUICK_LOGIN_ENABLED) {
    throw new Error("この機能は開発環境とデモ環境でのみ利用できます。");
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

/**
 * パスワード再設定のメールを送る。
 *
 * 宛先が登録済みかどうかにかかわらず同じ返事をする。返事を変えると、
 * どのアドレスが登録されているかを外から確かめられてしまう。
 */
export async function requestPasswordReset(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "メールアドレスを入力してください。" };

  const origin = (await headers()).get("origin") ?? "";
  const supabase = await createClient();

  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/update-password`,
  });

  return {
    notice:
      "再設定用のメールを送信しました。届いていない場合は、迷惑メールもご確認ください。",
  };
}

/**
 * 新しいパスワードを設定する。
 *
 * メールのリンクから来た人はすでにセッションを持っている。
 * 持っていなければリンクが期限切れなので、その旨を返す。
 */
export async function updatePassword(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < 8) {
    return { error: "パスワードは8文字以上で入力してください。" };
  }
  if (password !== confirm) {
    return { error: "確認用のパスワードが一致しません。" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error:
        "リンクの有効期限が切れています。お手数ですが、もう一度お送りください。",
    };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: `変更できませんでした: ${error.message}` };

  revalidatePath("/", "layout");
  redirect(await homeForCurrentUser(supabase));
}
