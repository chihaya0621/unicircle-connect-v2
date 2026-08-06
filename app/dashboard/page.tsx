import type { Metadata } from "next";
import Link from "next/link";

import { EventCard } from "@/components/EventCard";
import type { UserRole } from "@/lib/database.types";
import { requireUser } from "@/lib/dal";
import { listVisibleEvents } from "@/lib/events";

export const metadata: Metadata = { title: "ダッシュボード | UniCircle Connect" };

const ROLE_SUMMARY: Record<UserRole, string> = {
  student: "サークルへの参加、施設の予約、イベントの作成ができます。",
  staff: "大学公式イベントの作成、施設マスタの管理、サークル設立の承認ができます。",
  general: "公開イベントの閲覧ができます。",
};

export default async function DashboardPage() {
  // 未ログインならここでログイン画面へリダイレクトされる。
  // proxy.ts の楽観的チェックとは別に、データソース側でも必ず検証する。
  const user = await requireUser();
  const { events } = await listVisibleEvents(user.role);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">
          こんにちは、{user.name} さん
        </h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {ROLE_SUMMARY[user.role]}
        </p>
      </header>

      <section>
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">開催予定のイベント</h2>
          <Link
            href="/events"
            className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
          >
            すべて見る
          </Link>
        </div>

        {events.length === 0 ? (
          <p className="rounded-xl border border-dashed border-black/15 px-4 py-12 text-center text-sm text-gray-500 dark:border-white/15 dark:text-gray-400">
            開催予定のイベントはまだありません。
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {events.slice(0, 4).map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
