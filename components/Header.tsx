import Link from "next/link";

import { signOut } from "@/app/actions/auth";
import type { UserRole } from "@/lib/database.types";
import { getCurrentUser } from "@/lib/dal";
import { getUnreadCount } from "@/lib/notifications";
import { getPendingCounts } from "@/lib/pending";

const ROLE_LABEL: Record<UserRole, string> = {
  student: "学生",
  staff: "大学職員",
  general: "一般",
};

const navLink =
  "relative rounded-lg px-2 py-1 text-gray-600 transition-all duration-300 ease-out " +
  "hover:-translate-y-0.5 hover:text-gray-900 hover:bg-white/40 " +
  "dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-white/10";

/** 対応が必要な件数を示すバッジ。0件のときは何も出さない。 */
function PendingBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="ml-1 inline-flex min-w-5 animate-[pop-in_300ms_cubic-bezier(0.34,1.56,0.64,1)] items-center justify-center rounded-full bg-rose-600 px-1.5 py-0.5 text-xs font-semibold leading-none text-white shadow-md shadow-rose-500/40">
      {count}
    </span>
  );
}

export async function Header() {
  const user = await getCurrentUser();
  const pending = user
    ? await getPendingCounts(user.id, user.role)
    : { circles: 0, reservations: 0, members: 0 };
  const unread = user ? await getUnreadCount() : 0;

  return (
    <header className="glass-header sticky top-0 z-40">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4">
        <Link
          href="/"
          className="font-semibold tracking-tight transition-transform duration-300 ease-out hover:scale-[1.03]"
        >
          UniCircle <span className="text-indigo-600 dark:text-indigo-400">Connect</span>
        </Link>

        <nav className="flex items-center gap-4 text-sm">
          {user && user.role !== "general" && (
            <Link href="/circles" className={navLink}>
              サークル
              <PendingBadge count={pending.circles + pending.members} />
            </Link>
          )}
          <Link href="/events" className={navLink}>
            イベント
          </Link>
          {user?.role === "student" && (
            <Link href="/board" className={navLink}>
              掲示板
            </Link>
          )}
          {user && (
            <Link href="/calendar" className={navLink}>
              カレンダー
            </Link>
          )}

          {user ? (
            <>
              {user.role !== "general" && (
                <Link href="/facilities" className={navLink}>
                  施設予約
                  <PendingBadge count={pending.reservations} />
                </Link>
              )}
              <Link href="/dashboard" className={navLink}>
                ダッシュボード
              </Link>
              <Link href="/mypage" className={navLink}>
                マイページ
              </Link>
              <Link
                href="/notifications"
                className={`relative ${navLink}`}
                aria-label={unread > 0 ? `通知 ${unread}件の未読` : "通知"}
              >
                <span aria-hidden>🔔</span>
                {unread > 0 && (
                  <span className="absolute -right-2 -top-1 inline-flex min-w-4 animate-[pop-in_300ms_cubic-bezier(0.34,1.56,0.64,1)] items-center justify-center rounded-full bg-rose-600 px-1 py-0.5 text-[10px] font-semibold leading-none text-white shadow-md shadow-rose-500/40">
                    {unread > 99 ? "99+" : unread}
                  </span>
                )}
              </Link>
              <span className="hidden items-center gap-1.5 sm:flex">
                <span className="font-medium">{user.name}</span>
                <span className="badge bg-indigo-500/15 text-indigo-700 dark:text-indigo-300">
                  {ROLE_LABEL[user.role]}
                </span>
              </span>
              <form action={signOut}>
                <button
                  type="submit"
                  className="btn-ghost-sm"
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
                className="btn-primary px-3 py-1.5 text-xs"
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
