import type { Metadata } from "next";
import Link from "next/link";

import { decideCircle } from "@/app/actions/circles";
import { CircleCard } from "@/components/CircleCard";
import { listApprovedCircles, listPendingCircles } from "@/lib/circles";
import { getMyUniversityId, requireRole } from "@/lib/dal";

export const metadata: Metadata = { title: "サークル | UniCircle Connect" };

export default async function CirclesPage() {
  // 一般ユーザーは公開イベントの閲覧のみ可能（要件定義書3章）なので、
  // サークル画面には学生と職員だけを通す。
  const user = await requireRole("student", "staff");
  const universityId = await getMyUniversityId();
  const { circles, error } = await listApprovedCircles(
    universityId,
    user.role === "staff",
  );

  // 職員には自分の大学の承認待ちキューを見せる
  const pending =
    user.role === "staff" ? await listPendingCircles(user.id) : [];

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">サークル</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            あなたの大学から参加できるサークルを表示しています。
          </p>
        </div>

        {user.role === "student" && (
          <Link
            href="/circles/new"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500"
          >
            サークルを設立する
          </Link>
        )}
      </header>

      {error && (
        <p
          role="alert"
          className="mb-6 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
        >
          サークルの取得に失敗しました: {error}
        </p>
      )}

      {pending.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-3 text-sm font-semibold text-amber-700 dark:text-amber-300">
            設立申請 {pending.length}件（承認待ち）
          </h2>
          <ul className="space-y-3">
            {pending.map((circle) => (
              <li
                key={circle.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900/50 dark:bg-amber-950/20"
              >
                <div className="min-w-0">
                  <p className="font-medium">{circle.name}</p>
                  {circle.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-gray-600 dark:text-gray-400">
                      {circle.description}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  <form action={decideCircle}>
                    <input type="hidden" name="circle_id" value={circle.id} />
                    <input type="hidden" name="approve" value="true" />
                    <button
                      type="submit"
                      className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-500"
                    >
                      承認
                    </button>
                  </form>
                  <form action={decideCircle}>
                    <input type="hidden" name="circle_id" value={circle.id} />
                    <input type="hidden" name="approve" value="false" />
                    <button
                      type="submit"
                      className="rounded-lg border border-black/15 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-black/5 dark:border-white/15 dark:text-gray-300 dark:hover:bg-white/10"
                    >
                      却下
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {circles.length === 0 && !error ? (
        <p className="rounded-xl border border-dashed border-black/15 px-4 py-12 text-center text-sm text-gray-500 dark:border-white/15 dark:text-gray-400">
          承認済みのサークルはまだありません。
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {circles.map((circle) => (
            <CircleCard key={circle.id} circle={circle} />
          ))}
        </div>
      )}
    </div>
  );
}
