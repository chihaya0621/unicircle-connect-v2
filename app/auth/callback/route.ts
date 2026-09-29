import { NextResponse, type NextRequest } from "next/server";

import { safePath } from "@/lib/safe-path";
import { createClient } from "@/lib/supabase-server";

/**
 * メールのリンクから戻ってくる先。
 *
 * Supabase は確認コードを ?code= で渡してくる。ここでセッションに
 * 引き換えてから目的のページへ送る。Cookie の書き込みが必要なので、
 * Server Component ではなく Route Handler で受ける。
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  // オープンリダイレクト防止: アプリの中のパスだけを通す
  const safeNext = safePath(searchParams.get("next")) ?? "/";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=invalid_link`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=expired_link`);
  }
  return NextResponse.redirect(`${origin}${safeNext}`);
}
