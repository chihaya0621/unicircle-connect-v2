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
      className={`glass-card p-4 ${
        unread
          ? "border-indigo-300/70 bg-indigo-50/50 dark:border-indigo-800/60 dark:bg-indigo-950/25"
          : ""
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full px-2 py-0.5 text-xs ${TYPE_STYLE[n.type]}`}
        >
          {TYPE_LABEL[n.type]}
        </span>
        {unread && (
          <span className="h-2 w-2 animate-pulse rounded-full bg-indigo-500 shadow-[0_0_8px_2px_rgb(99_102_241/0.5)]" aria-label="未読" />
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
                className="btn-ghost py-2"
              >
                すべて既読にする
              </button>
            </form>
          )}
          <Link
            href="/mypage#notification-settings"
            className="btn-ghost py-2"
          >
            通知設定
          </Link>
        </div>
      </header>

      {notifications.length === 0 ? (
        <p className="glass-empty py-12">
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
