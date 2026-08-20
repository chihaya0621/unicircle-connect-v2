import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  removeCircleImage,
  uploadCircleImage,
} from "@/app/actions/images";
import { ImageUploader } from "@/components/ImageUploader";
import { JoinCircleButton } from "@/components/JoinCircleButton";
import { PostComposer } from "@/components/PostComposer";
import { PostList } from "@/components/PostList";
import { MemberList } from "@/components/MemberList";
import { listCirclePosts } from "@/lib/board";
import { getCircleActivity } from "@/lib/circle-activity";
import { EventCard } from "@/components/EventCard";
import { listUpcomingCircleEvents } from "@/lib/events";
import { imageUrl } from "@/lib/images";
import {
  getCircle,
  getMyMembership,
  isCircleAdmin,
  listMembers,
} from "@/lib/circles";
import { requireRole } from "@/lib/dal";

const activityDateFormatter = new Intl.DateTimeFormat("ja-JP", {
  dateStyle: "medium",
  timeZone: "Asia/Tokyo",
});

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
  const image = imageUrl(circle.image_path);

  // 承認済みサークルのみイベントを持ちうる
  const upcoming =
    circle.status === "approved" ? await listUpcomingCircleEvents(id, 1) : [];

  // 活動記録はメンバーだけに見せる。外部に活動履歴まで公開する必要はない。
  const activity = isMember
    ? await getCircleActivity(id, 10)
    : { activities: [], total: 0 };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-4">
            {image && (
              <div className="relative size-20 shrink-0 overflow-hidden rounded-xl border border-black/10 dark:border-white/10">
                <Image
                  src={image}
                  alt=""
                  fill
                  sizes="80px"
                  priority
                  className="object-cover"
                />
              </div>
            )}
            <h1 className="text-2xl font-bold tracking-tight">{circle.name}</h1>
          </div>
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

      {upcoming.length > 0 && (
        <section className="mb-10">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-lg font-semibold">次の予定</h2>
            <Link
              href="/events"
              className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
            >
              イベントを見る
            </Link>
          </div>
          <EventCard event={upcoming[0]} />
        </section>
      )}

      {canManage && (
        <section className="mb-10 rounded-xl border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-white/5">
          <h2 className="mb-4 text-lg font-semibold">サークルの画像</h2>
          <ImageUploader
            action={uploadCircleImage}
            removeAction={removeCircleImage}
            idField="circle_id"
            idValue={circle.id}
            currentUrl={image}
            label="サークルの画像"
            shape="square"
            hint="アイコンとして正方形に切り出して表示します。正方形の画像がきれいに収まります。JPEG / PNG / WebP / GIF、5MBまで。"
          />
        </section>
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

      {isMember && (
        <section className="mb-10">
          <h2 className="mb-1 text-lg font-semibold">
            活動記録
            {activity.total > 0 && (
              <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
                直近{activity.total}回
              </span>
            )}
          </h2>
          <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
            開催が終わったイベントを新しい順に表示しています。
          </p>

          {activity.activities.length === 0 ? (
            <p className="rounded-xl border border-dashed border-black/15 px-4 py-8 text-center text-sm text-gray-500 dark:border-white/15 dark:text-gray-400">
              まだ活動の記録がありません。イベントを作成して開催すると、ここに残ります。
            </p>
          ) : (
            <ul className="divide-y divide-black/5 rounded-xl border border-black/10 bg-white dark:divide-white/5 dark:border-white/10 dark:bg-white/5">
              {activity.activities.map((a) => (
                <li key={a.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <Link
                      href={`/events/${a.id}`}
                      className="min-w-0 truncate text-sm font-medium hover:underline"
                    >
                      {a.title}
                    </Link>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {activityDateFormatter.format(new Date(a.event_date))}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {a.present > 0
                      ? `出席 ${a.present}人 ／ 参加登録 ${a.registered}人`
                      : a.registered > 0
                        ? `参加登録 ${a.registered}人`
                        : "参加登録なし"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <MemberList members={members} circleId={circle.id} canManage={canManage} />
    </div>
  );
}
