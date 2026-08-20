import type { Metadata } from "next";
import Link from "next/link";

import { PageHero } from "@/components/PageHero";
import { FacilityForm } from "@/components/FacilityForm";
import { FacilityRow } from "@/components/FacilityRow";
import { getMyUniversityId, requireRole } from "@/lib/dal";
import { listFacilities } from "@/lib/facilities";
import { getPendingCounts } from "@/lib/pending";

export const metadata: Metadata = { title: "施設予約 | UniCircle Connect" };

const CATEGORY_LABEL = { facility: "施設", equipment: "備品" } as const;

export default async function FacilitiesPage() {
  // 一般ユーザーは施設予約を利用できない（要件定義書3章）
  const user = await requireRole("student", "staff");
  const universityId = await getMyUniversityId();
  const facilities = await listFacilities(universityId);
  const { reservations: pendingReservations } = await getPendingCounts(
    user.id,
    user.role,
  );

  const isStaff = user.role === "staff";

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <PageHero
        variant="stack"
        eyebrow="FACILITIES"
        title="施設・備品"
        description={
          isStaff
            ? "所属大学の施設マスタを管理できます。"
            : "所属大学の施設を予約できます。"
        }
        action={
          <Link
            href="/reservations"
            className={
              isStaff && pendingReservations > 0
                ? "btn-primary"
                : "btn-ghost py-2"
            }
          >
            {isStaff ? "予約の承認" : "自分の予約"}
            {isStaff && pendingReservations > 0 && ` (${pendingReservations})`}
          </Link>
        }
      />

      {isStaff && (
        <section className="mb-10 glass-panel">
          <h2 className="mb-4 text-sm font-semibold">施設・備品を登録</h2>
          <FacilityForm />
        </section>
      )}

      {!universityId ? (
        <p className="glass-empty py-12">
          所属大学が設定されていないため、施設を表示できません。
        </p>
      ) : facilities.length === 0 ? (
        <p className="glass-empty py-12">
          登録されている施設がありません。
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {facilities.map((f) =>
            // 職員向けは編集・削除のためにクライアント状態が要る
            isStaff ? (
              <FacilityRow key={f.id} facility={f} />
            ) : (
              <li
                key={f.id}
                className="glass-panel"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-semibold">{f.name}</h3>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {f.category ? CATEGORY_LABEL[f.category] : "未分類"}
                    </p>
                  </div>
                  {!f.is_available && (
                    <span className="shrink-0 badge bg-gray-500/15 text-gray-600 dark:text-gray-400">
                      利用停止中
                    </span>
                  )}
                </div>

                {f.is_available && (
                  <div className="mt-4">
                    <Link
                      href={`/facilities/${f.id}`}
                      className="inline-block btn-primary px-3 py-1.5 text-xs"
                    >
                      空き状況・予約
                    </Link>
                  </div>
                )}
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  );
}
