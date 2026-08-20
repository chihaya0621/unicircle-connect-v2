import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ReservationForm } from "@/components/ReservationForm";
import { ReservationList } from "@/components/ReservationList";
import { getMyUniversityId, requireRole } from "@/lib/dal";
import {
  getFacility,
  listBookableCircles,
  listFacilityReservations,
} from "@/lib/facilities";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const facility = await getFacility(id);
  return { title: `${facility?.name ?? "施設"} | UniCircle Connect` };
}

export default async function FacilityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireRole("student", "staff");

  const facility = await getFacility(id);
  if (!facility) notFound();

  // 施設は大学の資産なので、他大学からは見せない
  const universityId = await getMyUniversityId();
  if (facility.university_id !== universityId) notFound();

  const reservations = await listFacilityReservations(id);
  const circles =
    user.role === "student" ? await listBookableCircles(user.id) : [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight">{facility.name}</h1>
          {!facility.is_available && (
            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600 dark:bg-white/10 dark:text-gray-400">
              利用停止中
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {facility.category === "equipment" ? "備品" : "施設"}
        </p>
      </header>

      {user.role === "student" && facility.is_available && (
        <section className="mb-10 rounded-xl border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-white/5">
          <h2 className="mb-4 text-sm font-semibold">
            {facility.category === "equipment" ? "貸出を申請する" : "予約を申請する"}
          </h2>
          <ReservationForm
            facilityId={facility.id}
            category={facility.category}
            circles={circles}
          />
        </section>
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold">
          今後の予約状況
          <span className="ml-2 font-normal text-gray-500 dark:text-gray-400">
            承認待ちの枠も埋まっています
          </span>
        </h2>
        <ReservationList
          reservations={reservations}
          canDecide={user.role === "staff"}
          emptyLabel="今後の予約はありません。"
        />
      </section>
    </div>
  );
}
