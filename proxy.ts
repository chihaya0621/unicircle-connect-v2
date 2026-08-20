import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase";

/**
 * Next.js 16 から Middleware は「Proxy」に改称され、ファイル名も
 * `middleware.ts` ではなく `proxy.ts` になった。機能は同じで、
 * Node.js ランタイム上で動く。
 *
 * ここでの役割は Supabase の認証トークンを更新して Cookie に書き戻すこと。
 * Server Component からは Cookie を書けないため、この更新処理が無いと
 * 「突然ログアウトされる」類の不具合が起きる。
 */

/** 未ログインでも閲覧できるパス。前方一致で判定する。 */
const PUBLIC_PATHS = ["/", "/login", "/signup", "/events", "/auth"];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        // @supabase/ssr 0.12 以降、setAll は第2引数で no-store 系ヘッダーを渡す。
        // これを反映しないと CDN が認証 Cookie 付きレスポンスをキャッシュし、
        // 別ユーザーにセッションが漏れる可能性がある。
        for (const [key, value] of Object.entries(headers)) {
          response.headers.set(key, value);
        }
      },
    },
  });

  // getUser() を呼ぶことでトークンの更新が走る。この呼び出しを消さないこと。
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // 楽観的チェック: Cookie ベースの粗いリダイレクトのみを行う。
  // 本来の認可判定は lib/dal.ts 側（データソースの近く）で行う。
  if (!user && !isPublicPath(pathname)) {
    const loginUrl = new URL("/login", request.nextUrl);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (user && (pathname === "/login" || pathname === "/signup")) {
    return NextResponse.redirect(new URL("/dashboard", request.nextUrl));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.svg$).*)"],
};
