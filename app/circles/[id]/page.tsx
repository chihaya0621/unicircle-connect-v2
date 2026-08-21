import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  removeCircleImage,
  uploadCircleImage,
} from "@/app/actions/images";
import { CirclePublicProfileForm } from "@/components/CirclePublicProfileForm";
import { ImageUploader } from "@/components/ImageUploader";
import { FavoriteButton } from "@/components/FavoriteButton";
import { JoinCircleButton } from "@/components/JoinCircleButton";
import { PostComposer } from "@/components/PostComposer";
import { PostList } from "@/components/PostList";
import { MemberList } from "@/components/MemberList";
import { BOARD_VISIBLE_DAYS, listCirclePosts } from "@/lib/board";
import { getCircleActivity } from "@/lib/circle-activity";
import { EventCard } from "@/components/EventCard";
import {
  listUpcomingCircleEvents,
  resolveEventRelations,
} from "@/lib/events";
import { imageUrl } from "@/lib/images";
import {
  getCircle,
  getMyMembership,
  isCircleAdmin,
  listMembers,
} from "@/lib/circles";
import { listFavoriteCircleIds } from "@/lib/discovery";
import { requireUser } from "@/lib/dal";

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

  // 一覧と同じく一般ユーザーも到達できる。ここに来られた時点で
  // RLS を通っているので、非公開サークルなら getCircle が null を返す。
  const user = await requireUser();
  const isGeneral = user.role === "general";
  const membership = isGeneral ? null : await getMyMembership(id, user.id);
  const canManage = isCircleAdmin(membership);

  // 承認待ちのサークルは、関係者（メンバー）と職員以外には見せない
  const isInsider = membership !== null || user.role === "staff";
  if (circle.status !== "approved" && !isInsider) notFound();

  // 一般ユーザーは RLS でメンバーを1件も読めないので、問い合わせ自体を省く
  const members = isGeneral ? [] : await listMembers(id);
  const favoriteIds = await listFavoriteCircleIds();

  // 掲示板はメンバーのみ。RLS でも非メンバーには 0 件になる。
  const isMember = membership?.status === "active";
  const posts = isMember ? await listCirclePosts(id) : [];
  const image = imageUrl(circle.image_path);

  // 管理者が何か書いていれば「このサークルについて」を出す
  const hasPublicProfile = Boolean(
    circle.public_intro || circle.public_schedule || circle.public_contact,
  );

  // 承認済みサークルのみイベントを持ちうる
  const upcoming =
    circle.status === "approved" ? await listUpcomingCircleEvents(id, 1) : [];
  const relations = await resolveEventRelations(user.id, upcoming);

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
              <div className="relative size-20 shrink-0 overflow-hidden rounded-2xl border border-white/60 shadow-lg dark:border-white/15">
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
          {circle.status === "approved" && (
            <FavoriteButton
              circleId={circle.id}
              isFavorite={favoriteIds.has(circle.id)}
            />
          )}
          {circle.status === "pending" && (
            <span className="badge bg-amber-500/15 px-3 py-1 text-amber-700 dark:text-amber-300">
              職員の承認待ち
            </span>
          )}
          {circle.status === "rejected" && (
            <span className="badge bg-rose-500/15 px-3 py-1 text-rose-700 dark:text-rose-300">
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

      {hasPublicProfile && (
        <section className="mb-10 glass-panel">
          <h2 className="mb-3 text-lg font-semibold">このサークルについて</h2>

          {circle.public_intro && (
            <p className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
              {circle.public_intro}
            </p>
          )}

          {(circle.public_schedule || circle.public_contact) && (
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              {circle.public_schedule && (
                <div>
                  <dt className="text-xs text-gray-500 dark:text-gray-400">
                    活動日・場所
                  </dt>
                  <dd className="mt-0.5">{circle.public_schedule}</dd>
                </div>
              )}
              {circle.public_contact && (
                <div>
                  <dt className="text-xs text-gray-500 dark:text-gray-400">
                    連絡先・SNS
                  </dt>
                  <dd className="mt-0.5 break-all">{circle.public_contact}</dd>
                </div>
              )}
            </dl>
          )}
        </section>
      )}

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
          <EventCard
            event={upcoming[0]}
            relation={relations.get(upcoming[0].id) ?? "other"}
          />
        </section>
      )}

      {canManage && (
        <section className="mb-10 glass-panel">
          <h2 className="mb-1 text-lg font-semibold">公開プロフィール</h2>
          <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
            高校生や企業の方など、学外の人にも見える情報です。
            名簿・掲示板・活動記録はこれまでどおり公開されません。
          </p>
          <CirclePublicProfileForm
            circleId={circle.id}
            profile={{
              public_listed: circle.public_listed,
              public_intro: circle.public_intro,
              public_schedule: circle.public_schedule,
              public_contact: circle.public_contact,
            }}
          />
        </section>
      )}

      {canManage && (
        <section className="mb-10 glass-panel">
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
          <h2 className="mb-1 text-lg font-semibold">掲示板</h2>
          <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
            貼られた紙は{BOARD_VISIBLE_DAYS}日で下がります。お知らせに固定したものは残ります。
          </p>
          <div className="cork-frame">
            <div className="cork p-4 sm:p-5">
              <div className="mb-5">
                <PostComposer circleId={circle.id} canPin={canManage} />
              </div>
              <PostList
                posts={posts}
                isAdmin={canManage}
                currentUserName={user.name}
                emptyLabel="まだ何も貼られていません。"
              />
            </div>
          </div>
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
            <p className="glass-empty py-8">
              まだ活動の記録がありません。イベントを作成して開催すると、ここに残ります。
            </p>
          ) : (
            <ul className="glass divide-y divide-black/5 dark:divide-white/5">
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

      {!isGeneral && (
        <MemberList
          members={members}
          circleId={circle.id}
          canManage={canManage}
        />
      )}
    </div>
  );
}
