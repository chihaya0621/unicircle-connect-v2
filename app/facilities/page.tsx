import type { Metadata } from "next";
import Link from "next/link";

import { toggleFacility } from "@/app/actions/facilities";
import { FacilityForm } from "@/components/FacilityForm";
import { getMyUniversityId, requireRole } from "@/lib/dal";
import { listFacilities } from "@/lib/facilities";

export const metadata: Metadata = { title: "施設予約 | UniCircle Connect" };

const CATEGORY_LABEL = { facility: "施設", equipment: "備品" } as const;

export default async function FacilitiesPage() {
  // 一般ユーザーは施設予約を利用できない（要件定義書3章）
  const user = await requireRole("student", "staff");
  const universityId = await getMyUniversityId();
  const facilities = await listFacilities(universityId);

  const isStaff = user.role === "staff";

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">施設・備品</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            {isStaff
              ? "所属大学の施設マスタを管理できます。"
              : "所属大学の施設を予約できます。"}
          </p>
        </div>
        <Link
          href="/reservations"
          className="rounded-lg border border-black/15 px-4 py-2 text-sm font-semibold transition hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
        >
          {isStaff ? "予約の承認" : "自分の予約"}
        </Link>
      </header>

      {isStaff && (
        <section className="mb-10 rounded-xl border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-white/5">
          <h2 className="mb-4 text-sm font-semibold">施設・備品を登録</h2>
          <FacilityForm />
        </section>
      )}

      {!universityId ? (
        <p className="rounded-xl border border-dashed border-black/15 px-4 py-12 text-center text-sm text-gray-500 dark:border-white/15 dark:text-gray-400">
          所属大学が設定されていないため、施設を表示できません。
        </p>
      ) : facilities.length === 0 ? (
        <p className="rounded-xl border border-dashed border-black/15 px-4 py-12 text-center text-sm text-gray-500 dark:border-white/15 dark:text-gray-400">
          登録されている施設がありません。
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {facilities.map((f) => (
            <li
              key={f.id}
              className="rounded-xl border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-white/5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-semibold">{f.name}</h3>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {f.category ? CATEGORY_LABEL[f.category] : "未分類"}
                  </p>
                </div>
                {!f.is_available && (
                  <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-white/10 dark:text-gray-400">
                    利用停止中
                  </span>
                )}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {f.is_available && !isStaff && (
                  <Link
                    href={`/facilities/${f.id}`}
                    className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-500"
                  >
                    空き状況・予約
                  </Link>
                )}
                {isStaff && (
                  <>
                    <Link
                      href={`/facilities/${f.id}`}
                      className="rounded-lg border border-black/15 px-3 py-1.5 text-xs font-medium transition hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
                    >
                      予約状況
                    </Link>
                    <form action={toggleFacility}>
                      <input type="hidden" name="facility_id" value={f.id} />
                      <input
                        type="hidden"
                        name="available"
                        value={String(!f.is_available)}
                      />
                      <button
                        type="submit"
                        className="rounded-lg border border-black/15 px-3 py-1.5 text-xs font-medium transition hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
                      >
                        {f.is_available ? "利用停止にする" : "利用可能にする"}
                      </button>
                    </form>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
