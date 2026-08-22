import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHero } from "@/components/PageHero";
import { DeleteAccount } from "@/components/DeleteAccount";
import { NotificationSettings } from "@/components/NotificationSettings";
import { ProfileForm } from "@/components/ProfileForm";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { UniversityWatchPanel } from "@/components/UniversityWatchPanel";
import { CircleCard } from "@/components/CircleCard";
import type { UserRole } from "@/lib/database.types";
import { getMyUniversityId, requireUser } from "@/lib/dal";
import {
  getMyProfile,
  getStaffSummary,
  listMyCircleMemberships,
  listMyEvents,
  listMyReservationHistory,
  type MyEvent,
  type MyReservation,
} from "@/lib/mypage";
import {
  listFavoriteCircleIds,
  listUniversities,
  listWatchedUniversityIds,
} from "@/lib/discovery";
import { listPublicCircles } from "@/lib/circles";
import { getPreferences } from "@/lib/notifications";
import { getPendingCounts } from "@/lib/pending";

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
  pending: {
    label: "承認待ち",
    className: "text-amber-700 dark:text-amber-300",
  },
  approved: {
    label: "承認済み",
    className: "text-emerald-700 dark:text-emerald-300",
  },
  rejected: {
    label: "取り消し",
    className: "text-gray-500 dark:text-gray-400",
  },
} as const;

function EventRow({ event }: { event: MyEvent }) {
  const host = event.host_university?.name ?? event.host_circle?.name ?? "—";
  return (
    <li>
      <Link
        href={`/events/${event.id}`}
        className="flex flex-wrap items-center gap-x-3 gap-y-1 glass-card px-4 py-3"
      >
        <span className="w-40 shrink-0 text-xs text-gray-500 dark:text-gray-400">
          {dateFormatter.format(new Date(event.event_date))}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">
            {event.title}
          </span>
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
    <li className="glass-panel px-4 py-3">
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
    <p className="glass-empty py-8">
      {children}
    </p>
  );
}

export default async function MyPage() {
  const user = await requireUser();
  const profile = await getMyProfile(user.id, user.role, user.email);
  if (!profile) notFound();

  const isStaff = user.role === "staff";
  const isGeneral = user.role === "general";
  const preferences = await getPreferences(user.id);

  // 気になるサークルは全ロールで使える。所属していなくても
  // 追いかけたいサークルはあるため。
  const favoriteIds = await listFavoriteCircleIds();
  const [universities, watchedIds] = isGeneral
    ? await Promise.all([listUniversities(), listWatchedUniversityIds()])
    : [[], [] as string[]];

  // 一覧は RLS 越しに引き直す。お気に入りの ID だけでは名前も画像も出せない。
  const favorites =
    favoriteIds.size > 0
      ? (await listPublicCircles([], favoriteIds)).circles.filter((c) =>
          favoriteIds.has(c.id),
        )
      : [];

  // 職員はサークルに所属せず、イベント参加も個人予約もしない。
  // 代わりに自大学の状況を出すため、取得するデータ自体を分ける。
  const [events, circles, reservations, staffSummary, pending] =
    await Promise.all([
      isStaff
        ? Promise.resolve({ upcoming: [], past: [] })
        : listMyEvents(user.id),
      user.role === "student"
        ? listMyCircleMemberships(user.id)
        : Promise.resolve([]),
      user.role === "student"
        ? listMyReservationHistory(user.id)
        : Promise.resolve({ upcoming: [], past: [] }),
      isStaff
        ? getMyUniversityId().then(getStaffSummary)
        : Promise.resolve(null),
      isStaff
        ? getPendingCounts(user.id, user.role)
        : Promise.resolve({ circles: 0, reservations: 0, members: 0 }),
    ]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <PageHero
        variant="stack"
        eyebrow="MY PAGE"
        title="マイページ"
        description={
          <>
            {ROLE_LABEL[profile.role]}
            {profile.university && ` ／ ${profile.university}`}
            {profile.email && ` ／ ${profile.email}`}
          </>
        }
      />

      <section className="glass-panel">
        <h2 className="mb-4 text-lg font-semibold">プロフィール</h2>
        <ProfileForm profile={profile} />
      </section>

      {isGeneral && (
        <section className="mt-10 glass-panel">
          <h2 className="mb-1 text-lg font-semibold">気になる大学</h2>
          <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
            指定すると、サークルとイベントの一覧をその大学に絞ります。
          </p>
          <UniversityWatchPanel
            universities={universities}
            selectedIds={watchedIds}
          />
        </section>
      )}

      {favorites.length > 0 && (
        <Section title="気になるサークル" count={favorites.length}>
          <ul className="grid gap-3 sm:grid-cols-2">
            {favorites.map((circle) => (
              <li key={circle.id}>
                <CircleCard circle={circle} isFavorite />
              </li>
            ))}
          </ul>
        </Section>
      )}

      {isGeneral && (
        <section className="mt-10 glass-panel">
          <h2 className="mb-1 text-lg font-semibold">アカウントの削除</h2>
          <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
            登録した情報をすべて消して退会します。元には戻せません。
          </p>
          <DeleteAccount />
        </section>
      )}

      <section className="mt-10 glass-panel">
        <h2 className="mb-4 text-lg font-semibold">表示テーマ</h2>
        <ThemeSwitcher current={user.theme} />
      </section>

      <section
        id="notification-settings"
        className="mt-10 scroll-mt-4 glass-panel"
      >
        <h2 className="mb-4 text-lg font-semibold">通知設定</h2>
        <NotificationSettings preferences={preferences} />
      </section>

      {user.role === "student" && (
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
                        className="glass-card block p-4"
                      >
                        <p className="font-medium">{m.circle.name}</p>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          {m.circle.university?.name ?? "—"}
                          {m.role === "admin" && " ／ 管理者"}
                          {m.status === "pending" && " ／ 参加申請中"}
                          {m.status === "rejected" &&
                            " ／ 申請が却下されました"}
                        </p>
                      </Link>
                    </li>
                  ),
              )}
            </ul>
          )}
        </Section>
      )}

      {!isStaff && (
        <>
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
        </>
      )}

      {isStaff && staffSummary && (
        <>
          <Section title="対応が必要なもの">
            <ul className="grid gap-3 sm:grid-cols-2">
              <li>
                <Link
                  href="/circles"
                  className={`block rounded-xl border p-4 transition hover:shadow-md ${
                    pending.circles > 0
                      ? "border-rose-300 bg-rose-50 dark:border-rose-900/60 dark:bg-rose-950/30"
                      : "border-black/10 bg-white dark:border-white/10 dark:bg-white/5"
                  }`}
                >
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    サークル設立申請
                  </p>
                  <p className="mt-1 text-2xl font-bold">{pending.circles}件</p>
                </Link>
              </li>
              <li>
                <Link
                  href="/reservations"
                  className={`block rounded-xl border p-4 transition hover:shadow-md ${
                    pending.reservations > 0
                      ? "border-rose-300 bg-rose-50 dark:border-rose-900/60 dark:bg-rose-950/30"
                      : "border-black/10 bg-white dark:border-white/10 dark:bg-white/5"
                  }`}
                >
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    施設の予約申請
                  </p>
                  <p className="mt-1 text-2xl font-bold">
                    {pending.reservations}件
                  </p>
                </Link>
              </li>
            </ul>
          </Section>

          <Section title="学生の登録">
            <Link
              href="/staff/students"
              className="glass-card block p-4"
            >
              <p className="text-sm font-medium">学生の登録・情報の修正</p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                本人が新規登録したあと、氏名を登録すると学生として利用できるようになります
              </p>
            </Link>
          </Section>

          <Section title="施設・備品">
            <Link
              href="/facilities"
              className="glass-card block p-4"
            >
              <p className="text-sm">
                施設・備品 {staffSummary.facilities.total}件
                <span className="text-gray-500 dark:text-gray-400">
                  （うち備品 {staffSummary.facilities.equipment}件）
                </span>
              </p>
              {staffSummary.facilities.unavailable > 0 && (
                <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
                  利用停止中が{staffSummary.facilities.unavailable}件あります
                </p>
              )}
            </Link>
          </Section>

          <Section
            title="今後の利用予定"
            count={staffSummary.upcomingReservations.length}
          >
            {staffSummary.upcomingReservations.length === 0 ? (
              <Empty>承認済みの予約はありません。</Empty>
            ) : (
              <ul className="space-y-2">
                {staffSummary.upcomingReservations.map((r) => (
                  <ReservationRow key={r.id} reservation={r} />
                ))}
              </ul>
            )}
          </Section>

          <Section
            title="自大学が主催するイベント"
            count={staffSummary.upcomingEvents.length}
          >
            {staffSummary.upcomingEvents.length === 0 ? (
              <Empty>
                今後のイベントはありません。
                <Link
                  href="/events/new"
                  className="ml-1 font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                >
                  イベントを作成する
                </Link>
              </Empty>
            ) : (
              <ul className="space-y-2">
                {staffSummary.upcomingEvents.map((e) => (
                  <EventRow key={e.id} event={e} />
                ))}
              </ul>
            )}
          </Section>
        </>
      )}

      {user.role === "student" && (
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
