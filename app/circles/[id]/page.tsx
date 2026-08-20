import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { JoinCircleButton } from "@/components/JoinCircleButton";
import { PostComposer } from "@/components/PostComposer";
import { PostList } from "@/components/PostList";
import { MemberList } from "@/components/MemberList";
import { listCirclePosts } from "@/lib/board";
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

  // 掲示板はメンバーのみ。RLS でも非メンバーには 0 件になる。
  const isMember = membership?.status === "active";
  const posts = isMember ? await listCirclePosts(id) : [];

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
          {circle.scope === "public" && " ／ すべての大学から参加できます"}
          {circle.scope === "scoped" &&
            ` ／ ${[
              circle.university?.name,
              ...circle.scoped_universities.map((u) => u.university?.name),
            ]
              .filter(Boolean)
              .join("・")} の学生が参加できます`}
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

      {isMember && (
        <div className="mb-8">
          <Link
            href={`/circles/${circle.id}/activities`}
            className="inline-block rounded-lg border border-black/15 px-4 py-2 text-sm font-semibold transition hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
          >
            活動記録・出欠を見る
          </Link>
        </div>
      )}

      {isMember && (
        <section className="mb-10">
          <h2 className="mb-3 text-lg font-semibold">掲示板</h2>
          <div className="mb-4">
            <PostComposer circleId={circle.id} canPin={canManage} />
          </div>
          <PostList
            posts={posts}
            isAdmin={canManage}
            currentUserName={user.name}
            emptyLabel="まだ投稿がありません。"
          />
        </section>
      )}

      <MemberList members={members} circleId={circle.id} canManage={canManage} />
    </div>
  );
}
