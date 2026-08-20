import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import type { Database } from "@/lib/database.types";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase";

/**
 * Server Components / Server Actions / Route Handlers 用クライアント。
 *
 * リクエストごとに必ず新しく生成すること。モジュールスコープで使い回すと
 * 別ユーザーのセッションが混ざる。
 *
 * Next.js 16 では `cookies()` が非同期なので await が必要。
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Component からは Cookie を書けない。トークン更新は
          // proxy.ts が担当しているため、ここでの失敗は無視してよい。
        }
      },
    },
  });
}
