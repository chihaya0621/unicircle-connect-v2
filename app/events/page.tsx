import type { Metadata } from "next";
import Link from "next/link";

import { PageHero } from "@/components/PageHero";
import { EventCard } from "@/components/EventCard";
import { SearchForm } from "@/components/SearchForm";
import { getCurrentUser } from "@/lib/dal";
import { listWatchedUniversityIds } from "@/lib/discovery";
import { listVisibleEvents, resolveEventRelations } from "@/lib/events";
import { RELATION_BADGE, RELATION_LABEL } from "@/lib/event-sources";

export const metadata: Metadata = { title: "イベント | UniCircle Connect" };

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const { page: pageParam, q } = await searchParams;
  const search = (q ?? "").trim();
  const user = await getCurrentUser();

  const isLimitedView = !user || user.role === "general";
  const isGeneral = user?.role === "general";

  // 一般ユーザーは所属大学を持たないので、本人が指定した大学に寄せる。
  // 指定が無いうちは全部見せる。最初に来た人に空の画面を出さないため。
  const watchedIds = isGeneral ? await listWatchedUniversityIds() : [];

  const requestedPage = Number(pageParam);
  const { events, total, page, perPage, error } = await listVisibleEvents(
    user?.role ?? null,
    {
      page: Number.isInteger(requestedPage) ? requestedPage : 1,
      watchedUniversityIds: watchedIds,
      search,
    },
  );

  const lastPage = Math.max(1, Math.ceil(total / perPage));
  const firstIndex = total === 0 ? 0 : (page - 1) * perPage + 1;
  const lastIndex = Math.min(page * perPage, total);
  // 検索語はページを跨いでも保つ。2ページ目で条件が外れると、
  // 見ている一覧が黙って別物になる。
  const pageHref = (n: number) => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (n > 1) params.set("page", String(n));
    const query = params.toString();
    return query ? `/events?${query}` : "/events";
  };

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
          !user
            ? "大学が主催する公開イベントを表示しています。サークルの活動はサークル一覧から見られます。"
            : isGeneral
              ? watchedIds.length > 0
                ? "指定した大学の公開イベントを表示しています。"
                : "公開イベントを表示しています。気になる大学を指定すると絞り込めます。"
              : isLimitedView
                ? "公開イベントを表示しています。学内限定イベントは学生・職員アカウントで閲覧できます。"
                : "あなたが閲覧できる、開催予定のイベントを表示しています。"
        }
        action={
          !user ? (
            <Link href="/circles" className="btn-ghost py-2">
              サークルを探す
            </Link>
          ) : isGeneral ? (
            <Link href="/mypage" className="btn-ghost py-2">
              大学を指定
              {watchedIds.length > 0 && `（${watchedIds.length}校）`}
            </Link>
          ) : user ? (
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

      <SearchForm
        action="/events"
        placeholder="イベント名・内容で検索"
        value={search}
      />

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
          {search
            ? `「${search}」に一致するイベントはありません。`
            : !user
            ? "開催予定の公開イベントはまだありません。"
            : isGeneral && watchedIds.length > 0
              ? "指定した大学に、開催予定の公開イベントがありません。"
              : "開催予定のイベントはまだありません。"}
        </p>
      )}

      {total > 0 && (
        <p className="mb-3 text-sm text-gray-500 dark:text-gray-400 tabular-nums">
          {total}件中 {firstIndex}〜{lastIndex}件
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

      {lastPage > 1 && (
        <nav
          aria-label="ページ送り"
          className="mt-8 flex flex-wrap items-center justify-center gap-3"
        >
          {page > 1 ? (
            <Link href={pageHref(page - 1)} className="btn-ghost-sm">
              ← 前の{perPage}件
            </Link>
          ) : (
            <span className="btn-ghost-sm pointer-events-none opacity-40">
              ← 前の{perPage}件
            </span>
          )}

          <span className="text-sm tabular-nums text-gray-500 dark:text-gray-400">
            {page} / {lastPage}
          </span>

          {page < lastPage ? (
            <Link href={pageHref(page + 1)} className="btn-ghost-sm">
              次の{perPage}件 →
            </Link>
          ) : (
            <span className="btn-ghost-sm pointer-events-none opacity-40">
              次の{perPage}件 →
            </span>
          )}
        </nav>
      )}
    </div>
  );
}
