import type { Metadata } from "next";
import Link from "next/link";

import { EventCard } from "@/components/EventCard";
import { getCurrentUser, getMyUniversityId } from "@/lib/dal";
import { listVisibleEvents } from "@/lib/events";

export const metadata: Metadata = { title: "イベント | UniCircle Connect" };

export default async function EventsPage() {
  const user = await getCurrentUser();
  const universityId = await getMyUniversityId();
  const { events, error } = await listVisibleEvents(
    user?.role ?? null,
    universityId,
  );

  const isLimitedView = !user || user.role === "general";

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">イベント</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            {isLimitedView
              ? "公開イベントを表示しています。学内限定イベントは学生・職員アカウントで閲覧できます。"
              : "あなたが閲覧できる、開催予定のイベントを表示しています。"}
          </p>
        </div>
        {user && user.role !== "general" && (
          <Link
            href="/events/new"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500"
          >
            イベントを作成
          </Link>
        )}
      </header>

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
        >
          イベントの取得に失敗しました: {error}
        </p>
      )}

      {!error && events.length === 0 && (
        <p className="rounded-xl border border-dashed border-black/15 px-4 py-12 text-center text-sm text-gray-500 dark:border-white/15 dark:text-gray-400">
          開催予定のイベントはまだありません。
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {events.map((event) => (
          <EventCard key={event.id} event={event} />
        ))}
      </div>
    </div>
  );
}
