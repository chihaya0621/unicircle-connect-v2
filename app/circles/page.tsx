import type { Metadata } from "next";
import Link from "next/link";

import { decideCircle } from "@/app/actions/circles";
import { PageHero } from "@/components/PageHero";
import { CircleCard } from "@/components/CircleCard";
import {
  DirectoryBreadcrumb,
  PrefectureList,
  UniversityList,
} from "@/components/CircleDirectory";
import {
  getMyCircleIds,
  listApprovedCircles,
  listPendingCircles,
  listPublicCircles,
} from "@/lib/circles";
import {
  listFavoriteCircleIds,
  listUniversityDirectory,
  listWatchedUniversityIds,
} from "@/lib/discovery";
import { PREFECTURE_UNKNOWN } from "@/lib/prefectures";
import { getCurrentUser, getMyUniversityId } from "@/lib/dal";

export const metadata: Metadata = { title: "サークル | UniCircle Connect" };

export default async function CirclesPage({
  searchParams,
}: {
  searchParams: Promise<{
    others?: string;
    fav?: string;
    pref?: string;
    university?: string;
  }>;
}) {
  // 未ログインにも開く。公開設定のサークルだけが見えることは
  // RLS（0021_circle_public_profile.sql）が担保している。
  const user = await getCurrentUser();
  const universityId = await getMyUniversityId();
  const isAnon = user === null;
  const isGeneral = user?.role === "general";
  // 所属の文脈が無い人には、大学ごとにまとめて見せる。
  // 平坦な一覧だと、どこの大学の話なのかが読み取れない。
  const groupByUniversity = isAnon;

  // 他大学のサークル（インカレ・合同）を出すかは URL クエリで持つ。
  // 既定は非表示。インカレが増えるほど自大学の一覧が埋もれるため。
  const { others, fav, pref, university } = await searchParams;
  const showOtherUniversities = others === "1";
  const favoritesOnly = fav === "1";

  // 気になる登録はログインしている人だけのもの
  const favoriteIds = user ? await listFavoriteCircleIds() : new Set<string>();

  // 一般ユーザーは所属大学を持たないので、本人が指定した大学に寄せる
  const watchedIds = isGeneral ? await listWatchedUniversityIds() : [];

  const myCircleIds =
    user && !isGeneral ? await getMyCircleIds(user.id) : new Set<string>();

  // 所属大学を持たない人は、都道府県 → 大学 と辿ってから一覧に着く。
  // 気になる大学を指定済みの一般ユーザーは、そこから始める必要が無い。
  const useDirectory = isAnon || (isGeneral && watchedIds.length === 0);
  const directory =
    useDirectory || university ? await listUniversityDirectory() : [];
  const selectedUniversity = university
    ? (directory.find((u) => u.id === university) ?? null)
    : null;

  const listed = selectedUniversity
    ? await listPublicCircles([selectedUniversity.id], favoriteIds)
    : isAnon || isGeneral
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
    user?.role === "staff" ? await listPendingCircles(user.id) : [];

  // 大学ごとにまとめる。大学名の五十音順、同じ大学の中はサークル名順。
  const byUniversity = groupByUniversity && !selectedUniversity
    ? [...
        circles
          .reduce((map, c) => {
            const name = c.university?.name ?? "所属大学未設定";
            (map.get(name) ?? map.set(name, []).get(name)!).push(c);
            return map;
          }, new Map<string, typeof circles>())
          .entries(),
      ].sort((a, b) => a[0].localeCompare(b[0], "ja"))
    : [];

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <PageHero
        variant="arc"
        eyebrow="CIRCLES"
        title={isAnon || isGeneral ? "サークルを探す" : "サークル"}
        description={
          selectedUniversity ? (
            <>
              {selectedUniversity.name}の公開サークルです。
              {selectedUniversity.website_url && "大学の公式サイトも案内しています。"}
            </>
          ) : useDirectory ? (
            pref ? (
              <>{pref}の大学から選んでください。</>
            ) : (
              <>まず都道府県を選んでください。大学、サークルの順に辿れます。</>
            )
          ) : isAnon ? (
            <>
              公開されているサークルを大学ごとに表示しています。
              登録すると、気になるサークルに印を付けておけます。
            </>
          ) : isGeneral ? (
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
            {isAnon ? (
              <Link href="/signup" className="btn-primary">
                新規登録
              </Link>
            ) : isGeneral ? (
              <Link href="/mypage" className="btn-ghost py-2">
                大学を指定
                {watchedIds.length > 0 && `（${watchedIds.length}校）`}
              </Link>
            ) : (
              user?.role === "student" && (
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

      <div
        className={`mb-4 flex flex-wrap items-center gap-3 ${
          isAnon || isGeneral ? "hidden" : ""
        }`}
      >
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

      {(useDirectory || selectedUniversity) && (
        <DirectoryBreadcrumb
          prefecture={pref ?? selectedUniversity?.prefecture}
          universityName={selectedUniversity?.name}
        />
      )}

      {selectedUniversity?.website_url && (
        <p className="mb-4 text-sm">
          <a
            href={selectedUniversity.website_url}
            target="_blank"
            rel="noreferrer noopener"
            className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
          >
            {selectedUniversity.name}の公式サイト
          </a>
        </p>
      )}

      {useDirectory && !selectedUniversity ? (
        pref ? (
          <UniversityList
            prefecture={pref}
            universities={directory.filter(
              (u) => (u.prefecture ?? PREFECTURE_UNKNOWN) === pref,
            )}
          />
        ) : (
          <PrefectureList directory={directory} />
        )
      ) : circles.length === 0 && !error ? (
        <p className="glass-empty py-12">
          {favoritesOnly
            ? "気になるサークルはまだありません。カードのハートで印を付けられます。"
            : isAnon
              ? "公開されているサークルはまだありません。"
              : isGeneral
                ? watchedIds.length > 0
                  ? "指定した大学に公開サークルがありません。指定を見直してみてください。"
                  : "公開されているサークルはまだありません。"
                : showOtherUniversities
                  ? "参加できるサークルはまだありません。"
                  : "自大学のサークルはまだありません。「他大学のサークルも表示する」で範囲を広げられます。"}
        </p>
      ) : groupByUniversity ? (
        <div className="space-y-10">
          {byUniversity.map(([universityName, list]) => (
            <section key={universityName}>
              <div className="mb-3 flex items-baseline gap-3">
                <h2 className="text-lg font-semibold">{universityName}</h2>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {list.length}件
                </span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {list.map((circle) => (
                  <CircleCard key={circle.id} circle={circle} />
                ))}
              </div>
            </section>
          ))}
        </div>
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
