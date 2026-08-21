import Link from "next/link";

import type { CalendarEvent } from "@/lib/calendar";
import { SOURCE_COLOR, SOURCE_DOT, SOURCE_LABEL } from "@/lib/event-sources";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const WEEKDAYS_JA = ["日", "月", "火", "水", "木", "金", "土"];

const timeFormatter = new Intl.DateTimeFormat("ja-JP", {
  timeStyle: "short",
  timeZone: "Asia/Tokyo",
});

/** その月のカレンダーに並べる日付（前後の月で6週ぶんを埋める） */
function buildDays(year: number, month: number) {
  const first = new Date(year, month, 1);
  const start = new Date(first);
  start.setDate(1 - first.getDay());

  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

/** 日付をキーにしてイベントを引けるようにする（ローカル時刻基準） */
function groupByDate(events: CalendarEvent[]) {
  const map = new Map<string, CalendarEvent[]>();
  for (const e of events) {
    const d = new Date(e.event_date);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const list = map.get(key);
    if (list) list.push(e);
    else map.set(key, [e]);
  }
  return map;
}

/**
 * 卓上カレンダー風のグリッド。
 *
 * 曜日は S M T W T F S の頭文字で、日曜と土曜だけ色を変える。
 * 日付そのものにも同じ色を回して、週末が一目で分かるようにしている。
 *
 * 狭い画面では件名を置く幅がないので、色の点だけを並べて
 * 「どの日が詰まっているか」を示し、詳細は下の一覧に任せる。
 * 横スクロールさせて月表を覗き見る形にはしない。
 *
 * 配色はテーマ変数（--accent）に追従するので、テーマを変えると
 * カレンダーの色も一緒に変わる。
 */
export function CalendarGrid({
  year,
  month,
  events,
}: {
  year: number;
  /** 0始まり（Date と同じ） */
  month: number;
  events: CalendarEvent[];
}) {
  const days = buildDays(year, month);
  const byDate = groupByDate(events);
  const todayKey = (() => {
    const t = new Date();
    return `${t.getFullYear()}-${t.getMonth()}-${t.getDate()}`;
  })();

  /** 曜日ごとの文字色。日曜は赤、土曜は青系 */
  const weekdayTone = (i: number) =>
    i === 0
      ? "text-rose-500"
      : i === 6
        ? "text-sky-500"
        : "text-gray-400 dark:text-gray-500";

  return (
    <div className="overflow-x-auto">
      <div className="min-w-0 sm:min-w-[44rem]">
        {/* 曜日 */}
        <div className="mb-1 grid grid-cols-7">
          {WEEKDAYS.map((w, i) => (
            <div
              key={`${w}-${i}`}
              className={`px-1 pb-2 text-center text-xs font-bold tracking-widest sm:px-2 sm:text-sm ${weekdayTone(i)}`}
            >
              {w}
              <span className="ml-1 hidden text-[10px] font-normal opacity-70 sm:inline">
                {WEEKDAYS_JA[i]}
              </span>
            </div>
          ))}
        </div>

        {/* 日付 */}
        <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
          {days.map((d, i) => {
            const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
            const dayEvents = byDate.get(key) ?? [];
            const isCurrentMonth = d.getMonth() === month;
            const isToday = key === todayKey;
            const dow = i % 7;

            return (
              <div
                key={key}
                className={`min-h-16 rounded-lg p-1 transition-colors duration-200 sm:min-h-24 sm:rounded-xl sm:p-1.5 ${
                  isCurrentMonth
                    ? "bg-black/[0.02] dark:bg-white/[0.04]"
                    : "opacity-45"
                }`}
              >
                <div
                  className={`mb-1 text-center text-xs font-semibold tabular-nums sm:text-sm ${
                    isToday
                      ? "mx-auto inline-flex size-5 items-center justify-center rounded-full bg-[rgb(var(--accent))] text-white shadow-md sm:size-6"
                      : dow === 0
                        ? "text-rose-500"
                        : dow === 6
                          ? "text-sky-500"
                          : "text-gray-700 dark:text-gray-300"
                  }`}
                >
                  {d.getDate()}
                </div>

                {/* 狭い画面: 色の点で密度だけを見せる。詳細は下の一覧で読む */}
                {dayEvents.length > 0 && (
                  <div
                    className="flex flex-wrap justify-center gap-0.5 sm:hidden"
                    aria-hidden
                  >
                    {dayEvents.slice(0, 3).map((e) => (
                      <span
                        key={e.id}
                        className={`size-1.5 rounded-full ${SOURCE_DOT[e.source]}`}
                      />
                    ))}
                  </div>
                )}

                <ul className="hidden space-y-1 sm:block">
                  {dayEvents.slice(0, 3).map((e) => (
                    <li key={e.id}>
                      <Link
                        href={`/events/${e.id}`}
                        title={`${timeFormatter.format(new Date(e.event_date))} ${e.title}\n${e.host_name}（${SOURCE_LABEL[e.source]}）`}
                        className={`block truncate rounded-md px-1.5 py-0.5 text-xs transition-all duration-200 ease-out hover:-translate-y-px hover:brightness-105 ${SOURCE_COLOR[e.source]}`}
                      >
                        {e.title}
                      </Link>
                    </li>
                  ))}
                  {dayEvents.length > 3 && (
                    <li className="px-1.5 text-xs text-gray-500 dark:text-gray-400">
                      ほか{dayEvents.length - 3}件
                    </li>
                  )}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
