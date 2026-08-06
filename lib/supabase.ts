import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@/lib/database.types";

/**
 * Supabase 接続情報。`NEXT_PUBLIC_` 接頭辞のためビルド時にインライン展開される。
 * 参照は必ずこの2定数を経由し、各所で process.env を直接読まないこと。
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL と NEXT_PUBLIC_SUPABASE_ANON_KEY を .env.local に設定してください。",
  );
}

/**
 * ブラウザ（Client Components）用クライアント。
 * 内部でシングルトン管理されるため、呼ぶたびに新しい接続が張られることはない。
 *
 * サーバー側（Server Components / Server Actions / proxy.ts）では
 * `lib/supabase-server.ts` を使うこと。next/headers に依存するため
 * このファイルには置けない（Client Component から import されると壊れる）。
 */
export function createClient() {
  return createBrowserClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);
}
