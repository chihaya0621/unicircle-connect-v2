import Link from "next/link";

import type { CalendarEvent } from "@/lib/calendar";
import { SOURCE_COLOR, SOURCE_LABEL } from "@/lib/event-sources";

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

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

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[42rem]">
        <div className="grid grid-cols-7 border-l border-t border-black/10 dark:border-white/10">
          {WEEKDAYS.map((w, i) => (
            <div
              key={w}
              className={`border-b border-r border-black/10 px-2 py-1.5 text-center text-xs font-medium dark:border-white/10 ${
                i === 0
                  ? "text-red-600 dark:text-red-400"
                  : i === 6
                    ? "text-blue-600 dark:text-blue-400"
                    : "text-gray-600 dark:text-gray-400"
              }`}
            >
              {w}
            </div>
          ))}

          {days.map((d) => {
            const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
            const dayEvents = byDate.get(key) ?? [];
            const isCurrentMonth = d.getMonth() === month;
            const isToday = key === todayKey;

            return (
              <div
                key={key}
                className={`min-h-24 border-b border-r border-black/10 p-1.5 dark:border-white/10 ${
                  isCurrentMonth ? "" : "bg-black/[0.02] dark:bg-white/[0.02]"
                }`}
              >
                <div
                  className={`mb-1 text-xs ${
                    isToday
                      ? "inline-flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 font-semibold text-white"
                      : isCurrentMonth
                        ? "text-gray-700 dark:text-gray-300"
                        : "text-gray-400 dark:text-gray-600"
                  }`}
                >
                  {d.getDate()}
                </div>

                <ul className="space-y-1">
                  {dayEvents.slice(0, 3).map((e) => (
                    <li key={e.id}>
                      <Link
                        href={`/events/${e.id}`}
                        title={`${timeFormatter.format(new Date(e.event_date))} ${e.title}\n${e.host_name}（${SOURCE_LABEL[e.source]}）`}
                        className={`block truncate rounded px-1.5 py-0.5 text-xs transition hover:opacity-80 ${SOURCE_COLOR[e.source]}`}
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
