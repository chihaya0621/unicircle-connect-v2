import type { Metadata } from "next";
import Link from "next/link";

import { PageHero } from "@/components/PageHero";
import { requireRole } from "@/lib/dal";
import { getMyHomeOverview } from "@/lib/my-circles";
import { getUnreadCount } from "@/lib/notifications";

export const metadata: Metadata = { title: "わたしのサークル | UniCircle Connect" };

const eventTime = new Intl.DateTimeFormat("ja-JP", {
  month: "numeric",
  day: "numeric",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Tokyo",
});
const postDate = new Intl.DateTimeFormat("ja-JP", {
  month: "numeric",
  day: "numeric",
  timeZone: "Asia/Tokyo",
});

/**
 * 学生のホーム。ログインした学生の着地点。
 *
 * 以前はカレンダーに着地していた。サークルの予定と連絡を確かめたい人は、
 * サークルを1つずつ開いて探す必要があり、所属が多い人ほど迷っていた。
 * 所属しているサークルごとに、次の予定・最新の連絡・対応が要るものを
 * 1行ずつ並べる。動いているサークルが上に来る。
 */
export default async function HomePage() {
  const user = await requireRole("student");
  const [overview, unread] = await Promise.all([
    getMyHomeOverview(user.id),
    getUnreadCount(),
  ]);
  const { circles, handovers } = overview;

  const todo = [
    ...handovers.map((h) => ({
      key: `handover-${h.circle_id}`,
      href: `/circles/${h.circle_id}`,
      text: `${h.from_name} さんから、代表の引き継ぎを頼まれています`,
    })),
    ...circles
      .filter((c) => c.pendingMembers > 0)
      .map((c) => ({
        key: `members-${c.id}`,
        href: `/circles/${c.id}`,
        text: `${c.name} に、参加申請が${c.pendingMembers}件届いています`,
      })),
    ...circles
      .filter((c) => c.pendingOffers > 0)
      .map((c) => ({
        key: `offers-${c.id}`,
        href: `/circles/${c.id}`,
        text: `${c.name} に、協賛の申し込みが${c.pendingOffers}件届いています`,
      })),
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <PageHero
        variant="circles"
        eyebrow="HOME"
        title="わたしのサークル"
        description={
          circles.length > 0 ? (
            <>
              所属している{circles.length}つのサークルの、次の予定と最新の連絡です。
              対応が要るものと、予定の近いサークルを上に並べています。
            </>
          ) : (
            <>まだサークルに入っていません。</>
          )
        }
        action={
          <Link href="/calendar" className="btn-ghost py-2">
            カレンダーを見る
          </Link>
        }
      />

      {(todo.length > 0 || unread > 0) && (
        <section className="mb-8 rounded-2xl border border-indigo-300/70 bg-indigo-50/60 p-5 dark:border-indigo-800/60 dark:bg-indigo-950/30">
          <h2 className="mb-2 text-lg font-semibold">対応が要るもの</h2>
          <ul className="space-y-1.5 text-sm">
            {todo.map((t) => (
              <li key={t.key}>
                <Link href={t.href} className="font-medium underline">
                  {t.text}
                </Link>
              </li>
            ))}
            {unread > 0 && (
              <li>
                <Link href="/notifications" className="font-medium underline">
                  まだ読んでいない通知が{unread}件あります
                </Link>
              </li>
            )}
          </ul>
        </section>
      )}

      {circles.length === 0 ? (
        <p className="glass-empty py-12">
          入りたいサークルを
          <Link href="/circles" className="mx-1 font-medium underline">
            サークル一覧
          </Link>
          から探せます。参加を申し込むと、承認されたあとにここに並びます。
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {circles.map((c) => (
            <li key={c.id} className="glass-card flex flex-col gap-3 p-5">
              <div className="flex items-start justify-between gap-2">
                <h2 className="min-w-0 font-semibold leading-snug">
                  <Link href={`/circles/${c.id}`} className="hover:underline">
                    {c.name}
                  </Link>
                </h2>
                {c.isAdmin && (
                  <span className="badge shrink-0 bg-indigo-500/15 px-2.5 py-0.5 text-xs text-indigo-800 dark:text-indigo-200">
                    管理者
                  </span>
                )}
              </div>

              <dl className="space-y-2 text-sm">
                <div>
                  <dt className="text-xs text-gray-600 dark:text-gray-400">次の予定</dt>
                  <dd>
                    {c.nextEvent ? (
                      <Link href={`/events/${c.nextEvent.id}`} className="hover:underline">
                        <span className="font-medium tabular-nums">
                          {eventTime.format(new Date(c.nextEvent.event_date))}
                        </span>{" "}
                        {c.nextEvent.title}
                      </Link>
                    ) : (
                      <span className="text-gray-600 dark:text-gray-400">
                        予定されているイベントはまだありません
                      </span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-600 dark:text-gray-400">最新の連絡</dt>
                  <dd>
                    {c.latestPost ? (
                      <p className="line-clamp-2">
                        {c.latestPost.body}
                        <span className="ml-1 text-xs text-gray-600 dark:text-gray-400">
                          （{postDate.format(new Date(c.latestPost.created_at))}）
                        </span>
                      </p>
                    ) : (
                      <span className="text-gray-600 dark:text-gray-400">
                        新しい連絡はありません
                      </span>
                    )}
                  </dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
