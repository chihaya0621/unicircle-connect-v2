import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ProfileForm } from "@/components/ProfileForm";
import type { UserRole } from "@/lib/database.types";
import { requireUser } from "@/lib/dal";
import {
  getMyProfile,
  listMyCircleMemberships,
  listMyEvents,
  listMyReservationHistory,
  type MyEvent,
  type MyReservation,
} from "@/lib/mypage";

export const metadata: Metadata = { title: "マイページ | UniCircle Connect" };

const ROLE_LABEL: Record<UserRole, string> = {
  student: "学生",
  staff: "大学職員",
  general: "一般",
};

const dateFormatter = new Intl.DateTimeFormat("ja-JP", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Tokyo",
});
const timeFormatter = new Intl.DateTimeFormat("ja-JP", {
  timeStyle: "short",
  timeZone: "Asia/Tokyo",
});

const RESERVATION_STATUS = {
  pending: { label: "承認待ち", className: "text-amber-700 dark:text-amber-300" },
  approved: { label: "承認済み", className: "text-emerald-700 dark:text-emerald-300" },
  rejected: { label: "取り消し", className: "text-gray-500 dark:text-gray-400" },
} as const;

function EventRow({ event }: { event: MyEvent }) {
  const host = event.host_university?.name ?? event.host_circle?.name ?? "—";
  return (
    <li>
      <Link
        href={`/events/${event.id}`}
        className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-black/10 bg-white px-4 py-3 transition hover:shadow-md dark:border-white/10 dark:bg-white/5"
      >
        <span className="w-40 shrink-0 text-xs text-gray-500 dark:text-gray-400">
          {dateFormatter.format(new Date(event.event_date))}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{event.title}</span>
          <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
            {host}
          </span>
        </span>
      </Link>
    </li>
  );
}

function ReservationRow({ reservation }: { reservation: MyReservation }) {
  const status = RESERVATION_STATUS[reservation.status];
  return (
    <li className="rounded-xl border border-black/10 bg-white px-4 py-3 dark:border-white/10 dark:bg-white/5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="w-40 shrink-0 text-xs text-gray-500 dark:text-gray-400">
          {dateFormatter.format(new Date(reservation.start_time))}
          {" 〜 "}
          {timeFormatter.format(new Date(reservation.end_time))}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {reservation.facility?.name ?? "削除された施設"}
        </span>
        <span className={`shrink-0 text-xs ${status.className}`}>
          {status.label}
        </span>
      </div>
      {(reservation.circle || reservation.purpose) && (
        <p className="mt-1 truncate text-xs text-gray-500 dark:text-gray-400">
          {reservation.circle ? `${reservation.circle.name} ／ ` : "個人 ／ "}
          {reservation.purpose ?? "目的の記載なし"}
        </p>
      )}
    </li>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <h2 className="mb-3 text-lg font-semibold">
        {title}
        {count !== undefined && (
          <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
            {count}件
          </span>
        )}
      </h2>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-black/15 px-4 py-8 text-center text-sm text-gray-500 dark:border-white/15 dark:text-gray-400">
      {children}
    </p>
  );
}

export default async function MyPage() {
  const user = await requireUser();
  const profile = await getMyProfile(user.id, user.role, user.email);
  if (!profile) notFound();

  const [events, circles, reservations] = await Promise.all([
    listMyEvents(user.id),
    user.role === "general" ? Promise.resolve([]) : listMyCircleMemberships(user.id),
    user.role === "general"
      ? Promise.resolve({ upcoming: [], past: [] })
      : listMyReservationHistory(user.id),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">マイページ</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {ROLE_LABEL[profile.role]}
          {profile.university && ` ／ ${profile.university}`}
          {profile.email && ` ／ ${profile.email}`}
        </p>
      </header>

      <section className="rounded-xl border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-white/5">
        <h2 className="mb-4 text-lg font-semibold">プロフィール</h2>
        <ProfileForm profile={profile} />
      </section>

      {user.role !== "general" && (
        <Section title="所属サークル" count={circles.length}>
          {circles.length === 0 ? (
            <Empty>
              まだサークルに所属していません。
              <Link
                href="/circles"
                className="ml-1 font-medium text-indigo-600 hover:underline dark:text-indigo-400"
              >
                サークルを探す
              </Link>
            </Empty>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {circles.map(
                (m) =>
                  m.circle && (
                    <li key={m.circle.id}>
                      <Link
                        href={`/circles/${m.circle.id}`}
                        className="block rounded-xl border border-black/10 bg-white p-4 transition hover:shadow-md dark:border-white/10 dark:bg-white/5"
                      >
                        <p className="font-medium">{m.circle.name}</p>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          {m.circle.university?.name ?? "—"}
                          {m.role === "admin" && " ／ 管理者"}
                          {m.status === "pending" && " ／ 参加申請中"}
                          {m.status === "rejected" && " ／ 申請が却下されました"}
                        </p>
                      </Link>
                    </li>
                  ),
              )}
            </ul>
          )}
        </Section>
      )}

      <Section title="参加予定のイベント" count={events.upcoming.length}>
        {events.upcoming.length === 0 ? (
          <Empty>参加予定のイベントはありません。</Empty>
        ) : (
          <ul className="space-y-2">
            {events.upcoming.map((e) => (
              <EventRow key={e.id} event={e} />
            ))}
          </ul>
        )}
      </Section>

      <Section title="参加したイベント" count={events.past.length}>
        {events.past.length === 0 ? (
          <Empty>まだ参加履歴がありません。</Empty>
        ) : (
          <ul className="space-y-2">
            {events.past.map((e) => (
              <EventRow key={e.id} event={e} />
            ))}
          </ul>
        )}
      </Section>

      {user.role !== "general" && (
        <>
          <Section title="今後の施設予約" count={reservations.upcoming.length}>
            {reservations.upcoming.length === 0 ? (
              <Empty>今後の予約はありません。</Empty>
            ) : (
              <ul className="space-y-2">
                {reservations.upcoming.map((r) => (
                  <ReservationRow key={r.id} reservation={r} />
                ))}
              </ul>
            )}
          </Section>

          <Section title="過去の施設予約" count={reservations.past.length}>
            {reservations.past.length === 0 ? (
              <Empty>過去の予約はありません。</Empty>
            ) : (
              <ul className="space-y-2">
                {reservations.past.map((r) => (
                  <ReservationRow key={r.id} reservation={r} />
                ))}
              </ul>
            )}
          </Section>
        </>
      )}
    </div>
  );
}
