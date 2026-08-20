import type { Metadata } from "next";
import Link from "next/link";

import { EventCard } from "@/components/EventCard";
import { listMyCircles } from "@/lib/circles";
import type { UserRole } from "@/lib/database.types";
import { getMyUniversityId, requireUser } from "@/lib/dal";
import { listVisibleEvents, resolveEventRelations } from "@/lib/events";

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
  const universityId = await getMyUniversityId();
  const { events } = await listVisibleEvents(user.role, universityId);
  const relations = await resolveEventRelations(user.id, events);
  // 一般ユーザーはサークルに所属しないので問い合わせ自体を省く
  const myCircles =
    user.role === "general" ? [] : await listMyCircles(user.id);

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

      {myCircles.length > 0 && (
        <section className="mb-10">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-lg font-semibold">参加中のサークル</h2>
            <Link
              href="/circles"
              className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
            >
              サークルを探す
            </Link>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {myCircles.map(
              (m) =>
                m.circle && (
                  <li key={m.circle.id}>
                    <Link
                      href={`/circles/${m.circle.id}`}
                      className="glass-card block p-4"
                    >
                      <p className="font-medium">{m.circle.name}</p>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {m.role === "admin" && "管理者 ／ "}
                        {m.status === "pending" && "参加申請中"}
                        {m.status === "active" &&
                          (m.circle.status === "pending"
                            ? "職員の承認待ち"
                            : "参加中")}
                        {m.status === "rejected" && "申請が却下されました"}
                      </p>
                    </Link>
                  </li>
                ),
            )}
          </ul>
        </section>
      )}

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
          <p className="glass-empty py-12">
            開催予定のイベントはまだありません。
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {events.slice(0, 4).map((event) => (
              <EventCard
                key={event.id}
                event={event}
                relation={relations.get(event.id) ?? "other"}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
