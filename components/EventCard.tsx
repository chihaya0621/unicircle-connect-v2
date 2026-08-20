import Link from "next/link";

import type { EventListItem } from "@/lib/events";
import { eventHost } from "@/lib/events";

const dateFormatter = new Intl.DateTimeFormat("ja-JP", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Tokyo",
});

export function EventCard({ event }: { event: EventListItem }) {
  const host = eventHost(event);

  return (
    <article className="rounded-xl border border-black/10 bg-white p-5 shadow-sm transition hover:shadow-md dark:border-white/10 dark:bg-white/5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold leading-snug">
          <Link href={`/events/${event.id}`} className="hover:underline">
            {event.title}
          </Link>
        </h3>
        {event.visibility === "public" ? (
          <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            公開
          </span>
        ) : event.visibility === "scoped" ? (
          <span className="shrink-0 rounded-full bg-sky-50 px-2 py-0.5 text-xs text-sky-700 dark:bg-sky-950 dark:text-sky-300">
            指定大学のみ
          </span>
        ) : (
          <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-950 dark:text-amber-300">
            学内限定
          </span>
        )}
      </div>

      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
        <time dateTime={event.event_date}>
          {dateFormatter.format(new Date(event.event_date))}
        </time>
      </p>

      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
        <span className="text-gray-400 dark:text-gray-500">
          {host.kind === "university" ? "大学主催" : "サークル主催"}
        </span>
        {" ／ "}
        {host.name}
      </p>

      {event.description && (
        <p className="mt-3 line-clamp-3 text-sm text-gray-700 dark:text-gray-300">
          {event.description}
        </p>
      )}

      {event.target_grades && event.target_grades.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {event.target_grades.map((grade) => (
            <li
              key={grade}
              className="rounded-md bg-black/5 px-2 py-0.5 text-xs text-gray-700 dark:bg-white/10 dark:text-gray-300"
            >
              {grade}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
