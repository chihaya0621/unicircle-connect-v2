import type { Metadata } from "next";
import Link from "next/link";

import { PageHero } from "@/components/PageHero";
import { EventCard } from "@/components/EventCard";
import { getCurrentUser, getMyUniversityId } from "@/lib/dal";
import { listVisibleEvents, resolveEventRelations } from "@/lib/events";
import { RELATION_BADGE, RELATION_LABEL } from "@/lib/event-sources";

export const metadata: Metadata = { title: "イベント | UniCircle Connect" };

export default async function EventsPage() {
  const user = await getCurrentUser();
  const universityId = await getMyUniversityId();
  const { events, error } = await listVisibleEvents(
    user?.role ?? null,
    universityId,
  );

  const isLimitedView = !user || user.role === "general";

  // 一覧は時系列のまま。関係は色分けでのみ示す。
  const relations = user
    ? await resolveEventRelations(user.id, events)
    : new Map<string, "joined" | "my-circle" | "other">();
  const hasHighlight = [...relations.values()].some((r) => r !== "other");

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <PageHero
        variant="ribbon"
        eyebrow="EVENTS"
        title="イベント"
        description={
          isLimitedView
            ? "公開イベントを表示しています。学内限定イベントは学生・職員アカウントで閲覧できます。"
            : "あなたが閲覧できる、開催予定のイベントを表示しています。"
        }
        action={
          user && user.role !== "general" ? (
            <Link href="/events/new" className="btn-primary">
              イベントを作成
            </Link>
          ) : null
        }
      />

      {hasHighlight && (
        <ul className="mb-4 flex flex-wrap gap-2">
          {(["joined", "my-circle"] as const).map((r) => (
            <li
              key={r}
              className={`rounded-full px-2.5 py-0.5 text-xs ${RELATION_BADGE[r]}`}
            >
              {RELATION_LABEL[r]}
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-xl border border-rose-300/70 bg-rose-50/70 px-3.5 py-2.5 text-sm text-rose-800 backdrop-blur-md dark:border-rose-800/60 dark:bg-rose-950/40 dark:text-rose-200"
        >
          イベントの取得に失敗しました: {error}
        </p>
      )}

      {!error && events.length === 0 && (
        <p className="glass-empty py-12">
          開催予定のイベントはまだありません。
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {events.map((event) => (
          <EventCard
            key={event.id}
            event={event}
            relation={relations.get(event.id) ?? "other"}
          />
        ))}
      </div>
    </div>
  );
}
