import type { Metadata } from "next";
import Link from "next/link";

import { CalendarFilterPanel } from "@/components/CalendarFilterPanel";
import { CalendarGrid } from "@/components/CalendarGrid";
import { listCalendarEvents } from "@/lib/calendar";
import { SOURCE_COLOR, SOURCE_LABEL } from "@/lib/event-sources";
import { getMyUniversityId, requireUser } from "@/lib/dal";
import { createClient } from "@/lib/supabase-server";

export const metadata: Metadata = { title: "カレンダー | UniCircle Connect" };

/** 見出しに出す英語の月名。参考にした卓上カレンダーの体裁に合わせている */
const MONTH_EN = [
  "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
  "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER",
];

const dateFormatter = new Intl.DateTimeFormat("ja-JP", {
  month: "short",
  day: "numeric",
  weekday: "short",
  timeZone: "Asia/Tokyo",
});
const timeFormatter = new Intl.DateTimeFormat("ja-JP", {
  timeStyle: "short",
  timeZone: "Asia/Tokyo",
});

/** ?ym=2026-08 を年と月に分解する。不正な値なら今月。 */
function parseMonth(ym: string | undefined) {
  const now = new Date();
  if (ym) {
    const m = /^(\d{4})-(\d{1,2})$/.exec(ym);
    if (m) {
      const year = Number(m[1]);
      const month = Number(m[2]) - 1;
      if (month >= 0 && month <= 11) return { year, month };
    }
  }
  return { year: now.getFullYear(), month: now.getMonth() };
}

function ymString(year: number, month: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{
    ym?: string;
    universities?: string | string[];
    unjoined?: string;
    search?: string;
  }>;
}) {
  const sp = await searchParams;
  const user = await requireUser();
  const universityId = await getMyUniversityId();

  const { year, month } = parseMonth(sp.ym);
  // カレンダーは前後の月をはみ出して表示するので、6週ぶんを取得範囲にする
  const gridStart = new Date(year, month, 1);
  gridStart.setDate(1 - gridStart.getDay());
  const gridEnd = new Date(gridStart);
  gridEnd.setDate(gridStart.getDate() + 42);

  const selectedUniversities = sp.universities
    ? Array.isArray(sp.universities)
      ? sp.universities
      : [sp.universities]
    : [];

  const filters = {
    universities: selectedUniversities,
    showUnjoinedCircles: sp.unjoined === "1",
    search: sp.search ?? "",
  };

  const [{ events, error }, { data: universities }] = await Promise.all([
    listCalendarEvents({
      userId: user.id,
      role: user.role,
      universityId,
      from: gridStart,
      to: gridEnd,
      filters,
    }),
    (await createClient()).from("universities").select("id, name").order("name"),
  ]);

  const prev = new Date(year, month - 1, 1);
  const next = new Date(year, month + 1, 1);

  // 当月ぶんだけを見出しの件数と下の一覧に使う（前後の月のはみ出しは除く）
  const thisMonth = events.filter((e) => {
    const d = new Date(e.event_date);
    return d.getFullYear() === year && d.getMonth() === month;
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      {/* 卓上カレンダー風の見出し。大きな月番号と装飾の円で構成する。
          色はテーマ変数に追従するので、テーマを変えると一緒に変わる。 */}
      <header className="glass-panel relative mb-6 overflow-hidden p-0">
        {/* 装飾の円。右上に大きく、左下に小さく重ねる */}
        <span
          aria-hidden
          className="pointer-events-none absolute -right-12 -top-16 size-56 rounded-full opacity-90"
          style={{
            background:
              "radial-gradient(circle at 30% 30%, rgb(var(--orb-2)), rgb(var(--orb-2) / 0.55))",
          }}
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-10 left-24 size-28 rounded-full opacity-70"
          style={{
            background:
              "radial-gradient(circle at 35% 35%, rgb(var(--orb-1)), rgb(var(--orb-1) / 0.5))",
          }}
        />

        <div className="relative flex flex-wrap items-end justify-between gap-6 p-6">
          <div className="flex items-end gap-5">
            {/* 月番号。2桁ゼロ埋めで大きく見せる */}
            <span
              className="text-7xl font-extrabold leading-none tracking-tighter tabular-nums sm:text-8xl"
              style={{ color: "rgb(var(--accent))" }}
            >
              {String(month + 1).padStart(2, "0")}
            </span>
            <div className="pb-2">
              <p
                className="text-2xl font-extrabold uppercase tracking-wide"
                style={{ color: "rgb(var(--accent))" }}
              >
                {MONTH_EN[month]}
              </p>
              <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-400">
                {year}年{month + 1}月 ／ {thisMonth.length}件の予定
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pb-2">
            <Link
              href={`/calendar?ym=${ymString(prev.getFullYear(), prev.getMonth())}`}
              className="btn-ghost-sm px-3 py-1.5"
              aria-label="前の月"
            >
              ←
            </Link>
            <Link href="/calendar" className="btn-ghost-sm px-3 py-1.5">
              今月
            </Link>
            <Link
              href={`/calendar?ym=${ymString(next.getFullYear(), next.getMonth())}`}
              className="btn-ghost-sm px-3 py-1.5"
              aria-label="次の月"
            >
              →
            </Link>
            <Link href="/events" className="btn-ghost-sm px-3 py-1.5">
              一覧で見る
            </Link>
          </div>
        </div>
      </header>

      <CalendarFilterPanel
        universities={universities ?? []}
        myUniversityId={universityId}
        selectedUniversities={selectedUniversities}
        showUnjoinedCircles={filters.showUnjoinedCircles}
        search={filters.search}
      />

      {error && (
        <p
          role="alert"
          className="mb-6 rounded-xl border border-rose-300/70 bg-rose-50/70 px-3.5 py-2.5 text-sm text-rose-800 backdrop-blur-md dark:border-rose-800/60 dark:bg-rose-950/40 dark:text-rose-200"
        >
          カレンダーの取得に失敗しました: {error}
        </p>
      )}

      <div className="glass-panel">
        <CalendarGrid year={year} month={month} events={events} />
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold">
          {month + 1}月の予定 {thisMonth.length}件
        </h2>
        {thisMonth.length === 0 ? (
          <p className="glass-empty">
            {filters.search
              ? "検索条件に一致するイベントはありません。"
              : "表示できるイベントはありません。「表示する範囲」から他大学を追加できます。"}
          </p>
        ) : (
          <ul className="space-y-2">
            {thisMonth.map((e) => (
              <li key={e.id}>
                <Link
                  href={`/events/${e.id}`}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 glass-card px-4 py-3"
                >
                  <span className="w-24 shrink-0 text-xs text-gray-500 dark:text-gray-400">
                    {dateFormatter.format(new Date(e.event_date))}
                  </span>
                  <span className="w-14 shrink-0 text-xs text-gray-500 dark:text-gray-400">
                    {timeFormatter.format(new Date(e.event_date))}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {e.title}
                    </span>
                    <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
                      {e.host_kind === "university" ? "大学主催" : "サークル"} ／{" "}
                      {e.host_name}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${SOURCE_COLOR[e.source]}`}
                  >
                    {SOURCE_LABEL[e.source]}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
