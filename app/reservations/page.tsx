import type { Metadata } from "next";
import Link from "next/link";

import { ReservationList } from "@/components/ReservationList";
import { getMyUniversityId, requireRole } from "@/lib/dal";
import { listMyReservations, listPendingReservations } from "@/lib/facilities";

export const metadata: Metadata = { title: "予約 | UniCircle Connect" };

export default async function ReservationsPage() {
  const user = await requireRole("student", "staff");
  const universityId = await getMyUniversityId();

  const pending =
    user.role === "staff" ? await listPendingReservations(universityId) : [];
  const mine =
    user.role === "student" ? await listMyReservations(user.id) : [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {user.role === "staff" ? "予約の承認" : "自分の予約"}
          </h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            {user.role === "staff"
              ? "所属大学の施設への予約申請を審査します。"
              : "個人の予約と、参加しているサークルの予約を表示しています。"}
          </p>
        </div>
        <Link
          href="/facilities"
          className="rounded-lg border border-black/15 px-4 py-2 text-sm font-semibold transition hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
        >
          施設一覧
        </Link>
      </header>

      {user.role === "staff" ? (
        <ReservationList
          reservations={pending}
          showFacility
          canDecide
          emptyLabel="承認待ちの予約はありません。"
        />
      ) : (
        <ReservationList
          reservations={mine}
          showFacility
          canCancel
          emptyLabel="予約はまだありません。施設一覧から申請できます。"
        />
      )}
    </div>
  );
}
