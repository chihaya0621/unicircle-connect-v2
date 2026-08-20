import type { Metadata } from "next";
import Link from "next/link";

import { markRead } from "@/app/actions/notifications";
import { requireUser } from "@/lib/dal";
import { TYPE_LABEL, TYPE_STYLE } from "@/lib/notification-types";
import { listNotifications, type Notification } from "@/lib/notifications";

export const metadata: Metadata = { title: "通知 | UniCircle Connect" };

const formatter = new Intl.DateTimeFormat("ja-JP", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Tokyo",
});

function Row({ n }: { n: Notification }) {
  const unread = n.read_at === null;

  const inner = (
    <div
      className={`rounded-xl border p-4 transition ${
        unread
          ? "border-indigo-200 bg-indigo-50/40 dark:border-indigo-900/60 dark:bg-indigo-950/20"
          : "border-black/10 bg-white dark:border-white/10 dark:bg-white/5"
      } ${n.link ? "hover:shadow-md" : ""}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full px-2 py-0.5 text-xs ${TYPE_STYLE[n.type]}`}
        >
          {TYPE_LABEL[n.type]}
        </span>
        {unread && (
          <span className="h-2 w-2 rounded-full bg-indigo-600" aria-label="未読" />
        )}
        <time
          dateTime={n.created_at}
          className="ml-auto text-xs text-gray-500 dark:text-gray-400"
        >
          {formatter.format(new Date(n.created_at))}
        </time>
      </div>

      <p className="mt-2 text-sm font-medium">{n.title}</p>
      {n.body && (
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{n.body}</p>
      )}
    </div>
  );

  return (
    <li>
      {n.link ? <Link href={n.link}>{inner}</Link> : inner}
      {unread && (
        <form action={markRead} className="mt-1 text-right">
          <input type="hidden" name="notification_id" value={n.id} />
          <button
            type="submit"
            className="text-xs text-gray-500 hover:underline dark:text-gray-400"
          >
            既読にする
          </button>
        </form>
      )}
    </li>
  );
}

export default async function NotificationsPage() {
  await requireUser();
  const notifications = await listNotifications();
  const unread = notifications.filter((n) => n.read_at === null).length;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">通知</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            {unread > 0 ? `未読が${unread}件あります。` : "未読はありません。"}
          </p>
        </div>
        <div className="flex gap-2">
          {unread > 0 && (
            <form action={markRead}>
              <button
                type="submit"
                className="rounded-lg border border-black/15 px-4 py-2 text-sm font-semibold transition hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
              >
                すべて既読にする
              </button>
            </form>
          )}
          <Link
            href="/mypage#notification-settings"
            className="rounded-lg border border-black/15 px-4 py-2 text-sm font-semibold transition hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
          >
            通知設定
          </Link>
        </div>
      </header>

      {notifications.length === 0 ? (
        <p className="rounded-xl border border-dashed border-black/15 px-4 py-12 text-center text-sm text-gray-500 dark:border-white/15 dark:text-gray-400">
          通知はまだありません。
        </p>
      ) : (
        <ul className="space-y-3">
          {notifications.map((n) => (
            <Row key={n.id} n={n} />
          ))}
        </ul>
      )}
    </div>
  );
}
