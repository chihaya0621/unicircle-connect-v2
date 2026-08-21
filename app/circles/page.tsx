import type { Metadata } from "next";
import Link from "next/link";

import { decideCircle } from "@/app/actions/circles";
import { PageHero } from "@/components/PageHero";
import { CircleCard } from "@/components/CircleCard";
import {
  getMyCircleIds,
  listApprovedCircles,
  listPendingCircles,
  listPublicCircles,
} from "@/lib/circles";
import {
  listFavoriteCircleIds,
  listWatchedUniversityIds,
} from "@/lib/discovery";
import { getMyUniversityId, requireUser } from "@/lib/dal";

export const metadata: Metadata = { title: "サークル | UniCircle Connect" };

export default async function CirclesPage({
  searchParams,
}: {
  searchParams: Promise<{ others?: string; fav?: string }>;
}) {
  // 一般ユーザーにも開く。公開サークルだけが見えることは
  // RLS（0019_public_discovery.sql）が担保している。
  const user = await requireUser();
  const universityId = await getMyUniversityId();
  const isGeneral = user.role === "general";

  // 他大学のサークル（インカレ・合同）を出すかは URL クエリで持つ。
  // 既定は非表示。インカレが増えるほど自大学の一覧が埋もれるため。
  const { others, fav } = await searchParams;
  const showOtherUniversities = others === "1";
  const favoritesOnly = fav === "1";

  const favoriteIds = await listFavoriteCircleIds();

  // 一般ユーザーは所属大学を持たないので、本人が指定した大学に寄せる
  const watchedIds = isGeneral ? await listWatchedUniversityIds() : [];

  const myCircleIds = isGeneral
    ? new Set<string>()
    : await getMyCircleIds(user.id);

  const listed = isGeneral
    ? await listPublicCircles(watchedIds, favoriteIds)
    : await listApprovedCircles(universityId, {
        isStaff: user.role === "staff",
        showOtherUniversities,
        myCircleIds,
      });

  const { hiddenCount, error } = listed;
  const circles = favoritesOnly
    ? listed.circles.filter((c) => favoriteIds.has(c.id))
    : listed.circles;

  // 職員には自分の大学の承認待ちキューを見せる
  const pending =
    user.role === "staff" ? await listPendingCircles(user.id) : [];

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <PageHero
        variant="arc"
        eyebrow="CIRCLES"
        title={isGeneral ? "サークルを見る" : "サークル"}
        description={
          isGeneral ? (
            <>
              公開されているサークルを表示しています。
              {watchedIds.length > 0
                ? "指定した大学のものに絞っています。"
                : "気になる大学を指定すると絞り込めます。"}
            </>
          ) : (
            <>
              {showOtherUniversities
                ? "他大学のインカレ・合同サークルも含めて表示しています。"
                : "自大学のサークルと、所属中のサークルを表示しています。"}
              {myCircleIds.size > 0 && " 所属中のものを先頭に並べています。"}
            </>
          )
        }
        action={
          <>
            {favoriteIds.size > 0 && (
              <Link
                href={favoritesOnly ? "/circles" : "/circles?fav=1"}
                className={favoritesOnly ? "btn-primary" : "btn-ghost py-2"}
              >
                {favoritesOnly
                  ? "気になるのみ表示中"
                  : `気になる ${favoriteIds.size}件`}
              </Link>
            )}
            {isGeneral ? (
              <Link href="/mypage" className="btn-ghost py-2">
                大学を指定
                {watchedIds.length > 0 && `（${watchedIds.length}校）`}
              </Link>
            ) : (
              user.role === "student" && (
                <Link href="/circles/new" className="btn-primary">
                  サークルを設立する
                </Link>
              )
            )}
          </>
        }
      />

      {error && (
        <p
          role="alert"
          className="mb-6 rounded-xl border border-rose-300/70 bg-rose-50/70 px-3.5 py-2.5 text-sm text-rose-800 backdrop-blur-md dark:border-rose-800/60 dark:bg-rose-950/40 dark:text-rose-200"
        >
          サークルの取得に失敗しました: {error}
        </p>
      )}

      {pending.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-3 inline-flex items-center gap-2 rounded-xl border border-rose-300/70 bg-rose-50/70 px-3 py-1.5 text-sm font-semibold text-rose-800 backdrop-blur-md dark:border-rose-800/60 dark:bg-rose-950/40 dark:text-rose-200">
            承認待ちの設立申請が{pending.length}件あります
          </h2>
          <ul className="space-y-3">
            {pending.map((circle) => (
              <li
                key={circle.id}
                className="glass-card tint-amber flex flex-wrap items-center justify-between gap-3 p-4"
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
                      className="btn-primary px-3 py-1.5 text-xs"
                    >
                      承認
                    </button>
                  </form>
                  <form action={decideCircle}>
                    <input type="hidden" name="circle_id" value={circle.id} />
                    <input type="hidden" name="approve" value="false" />
                    <button
                      type="submit"
                      className="btn-ghost-sm"
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

      {isGeneral && watchedIds.length === 0 && (
        <p className="glass-panel mb-4 text-sm text-gray-600 dark:text-gray-400">
          いまは全大学の公開サークルを表示しています。
          <Link href="/mypage" className="mx-1 font-medium underline">
            マイページ
          </Link>
          で気になる大学を指定すると、その大学のものだけに絞れます。
        </p>
      )}

      <div className={`mb-4 flex flex-wrap items-center gap-3 ${isGeneral ? "hidden" : ""}`}>
        <Link
          href={showOtherUniversities ? "/circles" : "/circles?others=1"}
          className="rounded-lg border border-black/15 px-3 py-1.5 text-sm font-medium transition hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
        >
          {showOtherUniversities
            ? "自大学のみ表示する"
            : "他大学のサークルも表示する"}
        </Link>
        {!showOtherUniversities && hiddenCount > 0 && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            他大学のインカレ・合同サークルを{hiddenCount}件隠しています
          </span>
        )}
      </div>

      {circles.length === 0 && !error ? (
        <p className="glass-empty py-12">
          {favoritesOnly
            ? "気になるサークルはまだありません。カードのハートで印を付けられます。"
            : isGeneral
              ? watchedIds.length > 0
                ? "指定した大学に公開サークルがありません。指定を見直してみてください。"
                : "公開されているサークルはまだありません。"
              : showOtherUniversities
                ? "参加できるサークルはまだありません。"
                : "自大学のサークルはまだありません。「他大学のサークルも表示する」で範囲を広げられます。"}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {circles.map((circle) => (
            <CircleCard
              key={circle.id}
              circle={circle}
              isMember={myCircleIds.has(circle.id)}
              isFavorite={favoriteIds.has(circle.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
