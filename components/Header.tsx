import Link from "next/link";

import { signOut } from "@/app/actions/auth";
import { MobileNav } from "@/components/MobileNav";
import { NavBadge, type NavItem } from "@/components/NavBadge";
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

/**
 * 全画面共通のヘッダー。
 *
 * 項目はここで一度だけ組み立て、広い画面では横並び、狭い画面では
 * 開閉メニューに同じ配列を渡す。「誰に何を見せるか」の分岐を
 * 二重に書かないための構成。
 *
 * 通知だけはメニューに入れず、どの幅でも常に出す。件数を見せることに
 * 意味があるので、開かないと分からない場所には置けない。
 */
export async function Header() {
  const user = await getCurrentUser();
  const pending = user
    ? await getPendingCounts(user.id, user.role)
    : { circles: 0, reservations: 0, members: 0 };
  const unread = user ? await getUnreadCount() : 0;

  const items: NavItem[] = [];
  if (user) items.push({ href: "/calendar", label: "カレンダー" });
  if (user && user.role !== "general") {
    items.push({
      href: "/circles",
      label: "サークル",
      badge: pending.circles + pending.members,
    });
  }
  items.push({ href: "/events", label: "イベント" });
  if (user?.role === "student") items.push({ href: "/board", label: "掲示板" });
  if (user && user.role !== "general") {
    items.push({
      href: "/facilities",
      label: "施設予約",
      badge: pending.reservations,
    });
  }
  if (user) items.push({ href: "/mypage", label: "マイページ" });

  const account = user && (
    <>
      <span className="flex items-center gap-1.5">
        <span className="font-medium">{user.name}</span>
        <span className="badge bg-indigo-500/15 text-indigo-700 dark:text-indigo-300">
          {ROLE_LABEL[user.role]}
        </span>
      </span>
      <form action={signOut}>
        <button type="submit" className="btn-ghost-sm">
          ログアウト
        </button>
      </form>
    </>
  );

  const bell = user && (
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
  );

  return (
    <header className="glass-header sticky top-0 z-40">
      <div className="relative mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4">
        <Link
          href="/"
          className="shrink-0 font-semibold tracking-tight transition-transform duration-300 ease-out hover:scale-[1.03]"
        >
          UniCircle{" "}
          <span className="text-indigo-600 dark:text-indigo-400">Connect</span>
        </Link>

        {/* 広い画面: すべて横に並べる */}
        <nav className="hidden items-center gap-4 text-sm lg:flex">
          {items.map((item) => (
            <Link key={item.href} href={item.href} className={navLink}>
              {item.label}
              <NavBadge count={item.badge ?? 0} />
            </Link>
          ))}
          {bell}
          {account}
          {!user && (
            <>
              <Link href="/login" className={navLink}>
                ログイン
              </Link>
              <Link href="/signup" className="btn-primary px-3 py-1.5 text-xs">
                新規登録
              </Link>
            </>
          )}
        </nav>

        {/* 狭い画面: 通知だけ残して、あとは開閉メニューへ畳む */}
        <div className="flex items-center gap-2 text-sm lg:hidden">
          {bell}
          {user ? (
            <MobileNav items={items}>{account}</MobileNav>
          ) : (
            <>
              <Link href="/login" className={navLink}>
                ログイン
              </Link>
              <Link href="/signup" className="btn-primary px-3 py-1.5 text-xs">
                新規登録
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
