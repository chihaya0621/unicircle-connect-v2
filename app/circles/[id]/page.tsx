import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { JoinCircleButton } from "@/components/JoinCircleButton";
import { MemberList } from "@/components/MemberList";
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
  return { title: `${circle?.name ?? "サークル"} | UniCircle Connect` };
}

export default async function CircleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const circle = await getCircle(id);
  if (!circle) notFound();

  // 一覧と同じく、学生と職員のみ到達できる
  const user = await requireRole("student", "staff");
  const membership = await getMyMembership(id, user.id);
  const canManage = isCircleAdmin(membership);

  // 承認待ちのサークルは、関係者（メンバー）と職員以外には見せない
  const isInsider = membership !== null || user.role === "staff";
  if (circle.status !== "approved" && !isInsider) notFound();

  const members = await listMembers(id);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight">{circle.name}</h1>
          {circle.status === "pending" && (
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs text-amber-700 dark:bg-amber-950 dark:text-amber-300">
              職員の承認待ち
            </span>
          )}
          {circle.status === "rejected" && (
            <span className="rounded-full bg-red-50 px-3 py-1 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">
              却下されました
            </span>
          )}
        </div>

        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {circle.university?.name ?? "所属大学未設定"}
        </p>

        {circle.description && (
          <p className="mt-4 whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
            {circle.description}
          </p>
        )}

        {circle.status === "approved" && (
          <div className="mt-6">
            <JoinCircleButton
              circleId={circle.id}
              viewerRole={user.role}
              membership={membership}
            />
          </div>
        )}
      </header>

      <MemberList members={members} circleId={circle.id} canManage={canManage} />
    </div>
  );
}
