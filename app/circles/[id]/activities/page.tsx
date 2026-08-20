import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { deleteActivity } from "@/app/actions/activities";
import { ActivityForm } from "@/components/ActivityForm";
import { AttendanceControls } from "@/components/AttendanceControls";
import { listActivities, summarizeAttendance } from "@/lib/activities";
import {
  getCircle,
  getMyMembership,
  isCircleAdmin,
  listMembers,
} from "@/lib/circles";
import { requireRole } from "@/lib/dal";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const circle = await getCircle(id);
  return { title: `活動記録 | ${circle?.name ?? "サークル"}` };
}

const dateFormatter = new Intl.DateTimeFormat("ja-JP", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Tokyo",
});

export default async function ActivitiesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireRole("student");

  const circle = await getCircle(id);
  if (!circle) notFound();

  // 活動記録はメンバー限定。非メンバーには存在自体を伏せる。
  const membership = await getMyMembership(id, user.id);
  if (membership?.status !== "active") notFound();

  const canManage = isCircleAdmin(membership);
  const [activities, members] = await Promise.all([
    listActivities(id),
    listMembers(id),
  ]);

  const activeMembers = members
    .filter((m) => m.status === "active")
    .map((m) => ({ user_id: m.user_id, name: m.user?.name ?? "退会したメンバー" }));

  const stats = summarizeAttendance(activities, activeMembers);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-6">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          <Link href={`/circles/${circle.id}`} className="hover:underline">
            {circle.name}
          </Link>
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">活動記録</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          活動の記録と出欠です。メンバー以外には見えません。
        </p>
      </header>

      {canManage && (
        <section className="mb-8 rounded-xl border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-white/5">
          <ActivityForm circleId={circle.id} />
        </section>
      )}

      {activities.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-3 text-lg font-semibold">
            出席状況
            <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
              全{activities.length}回
            </span>
          </h2>
          <ul className="divide-y divide-black/5 rounded-xl border border-black/10 bg-white dark:divide-white/5 dark:border-white/10 dark:bg-white/5">
            {stats.map((s) => {
              const recorded = s.present + s.absent;
              const rate =
                recorded > 0 ? Math.round((s.present / recorded) * 100) : null;
              return (
                <li
                  key={s.user_id}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5"
                >
                  <span className="text-sm font-medium">{s.name}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    出席 {s.present} ／ 欠席 {s.absent}
                    {s.unrecorded > 0 && ` ／ 未記録 ${s.unrecorded}`}
                    {rate !== null && (
                      <span className="ml-2 font-medium text-gray-700 dark:text-gray-300">
                        出席率 {rate}%
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            出席率は記録がある回だけで計算しています。未記録の回は含みません。
          </p>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold">活動の一覧</h2>
        {activities.length === 0 ? (
          <p className="rounded-xl border border-dashed border-black/15 px-4 py-10 text-center text-sm text-gray-500 dark:border-white/15 dark:text-gray-400">
            {canManage
              ? "まだ活動が登録されていません。上のボタンから登録できます。"
              : "まだ活動が登録されていません。"}
          </p>
        ) : (
          <ul className="space-y-3">
            {activities.map((a) => {
              const mine =
                a.attendances.find((x) => x.user_id === user.id)?.status ?? null;
              const presentCount = a.attendances.filter(
                (x) => x.status === "present",
              ).length;

              return (
                <li
                  key={a.id}
                  className="rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-white/5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">{a.title}</p>
                      <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                        {dateFormatter.format(new Date(a.activity_date))}
                        {a.location && ` ／ ${a.location}`}
                      </p>
                      {a.note && (
                        <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                          {a.note}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        出席 {presentCount} / {activeMembers.length}人
                      </p>
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <AttendanceControls
                        activityId={a.id}
                        circleId={circle.id}
                        current={mine}
                      />
                      {canManage && (
                        <form action={deleteActivity}>
                          <input type="hidden" name="activity_id" value={a.id} />
                          <input type="hidden" name="circle_id" value={circle.id} />
                          <button
                            type="submit"
                            className="rounded border border-red-200 px-2 py-1 text-xs text-red-700 transition hover:bg-red-50 dark:border-red-900/50 dark:text-red-300 dark:hover:bg-red-950/40"
                          >
                            削除
                          </button>
                        </form>
                      )}
                    </div>
                  </div>

                  {canManage && (
                    <details className="mt-3 border-t border-black/5 pt-3 dark:border-white/5">
                      <summary className="cursor-pointer text-xs text-gray-600 dark:text-gray-400">
                        メンバーの出欠を記録する
                      </summary>
                      <ul className="mt-2 space-y-1.5">
                        {activeMembers.map((m) => {
                          const status =
                            a.attendances.find((x) => x.user_id === m.user_id)
                              ?.status ?? null;
                          return (
                            <li
                              key={m.user_id}
                              className="flex items-center justify-between gap-2"
                            >
                              <span className="truncate text-sm">{m.name}</span>
                              <AttendanceControls
                                activityId={a.id}
                                circleId={circle.id}
                                current={status}
                                userId={m.user_id}
                                size="sm"
                              />
                            </li>
                          );
                        })}
                      </ul>
                    </details>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
