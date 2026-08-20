import Link from "next/link";

import { signOut } from "@/app/actions/auth";
import type { UserRole } from "@/lib/database.types";
import { getCurrentUser } from "@/lib/dal";

const ROLE_LABEL: Record<UserRole, string> = {
  student: "学生",
  staff: "大学職員",
  general: "一般",
};

export async function Header() {
  const user = await getCurrentUser();

  return (
    <header className="border-b border-black/10 bg-white/80 backdrop-blur dark:border-white/10 dark:bg-black/40">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4">
        <Link href="/" className="font-semibold tracking-tight">
          UniCircle <span className="text-indigo-600 dark:text-indigo-400">Connect</span>
        </Link>

        <nav className="flex items-center gap-4 text-sm">
          <Link href="/circles" className="text-gray-600 transition hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100">
            サークル
          </Link>
          <Link href="/events" className="text-gray-600 transition hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100">
            イベント
          </Link>

          {user ? (
            <>
              <Link href="/dashboard" className="text-gray-600 transition hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100">
                ダッシュボード
              </Link>
              <span className="hidden items-center gap-1.5 sm:flex">
                <span className="font-medium">{user.name}</span>
                <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                  {ROLE_LABEL[user.role]}
                </span>
              </span>
              <form action={signOut}>
                <button
                  type="submit"
                  className="rounded-lg border border-black/10 px-3 py-1.5 text-gray-700 transition hover:bg-black/5 dark:border-white/15 dark:text-gray-300 dark:hover:bg-white/10"
                >
                  ログアウト
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="text-gray-600 transition hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100">
                ログイン
              </Link>
              <Link
                href="/signup"
                className="rounded-lg bg-indigo-600 px-3 py-1.5 font-medium text-white transition hover:bg-indigo-500"
              >
                新規登録
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
