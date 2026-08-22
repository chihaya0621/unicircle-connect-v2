import type { Metadata } from "next";
import Link from "next/link";

import { PageHero } from "@/components/PageHero";
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
      <PageHero
        variant="wave"
        eyebrow="RESERVATIONS"
        title={user.role === "staff" ? "予約の承認" : "自分の予約"}
        description={
          <>
            {user.role === "staff"
              ? "所属大学の施設への予約申請を審査します。"
              : "個人の予約と、参加しているサークルの予約を表示しています。"}
            {user.role === "staff" && pending.length > 0 && (
              <span className="mt-2 block font-medium text-rose-700 dark:text-rose-300">
                承認待ちの申請が{pending.length}件あります
              </span>
            )}
          </>
        }
        action={
          <Link href="/facilities" className="btn-ghost py-2">
            施設一覧
          </Link>
        }
      />

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
