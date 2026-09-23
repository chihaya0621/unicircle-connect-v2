import type { Metadata } from "next";
import Link from "next/link";

import { decideCircle, decideClosure } from "@/app/actions/circles";
import { PageHero } from "@/components/PageHero";
import { ApprovalPolicy } from "@/components/ApprovalPolicy";
import { CircleCard } from "@/components/CircleCard";
import { EventCard } from "@/components/EventCard";
import { SearchForm } from "@/components/SearchForm";
import {
  DirectoryBreadcrumb,
  PrefectureList,
  UniversityList,
} from "@/components/CircleDirectory";
import {
  getMyCircleIds,
  listApprovedCircles,
  listClosureRequests,
  listPendingCircles,
  listPublicCircles,
} from "@/lib/circles";
import {
  countApprovals,
  countStaff,
  getRequiredApprovals,
} from "@/lib/approvals";
import {
  listCampusDirectory,
  listFavoriteCircleIds,
  listWatchedUniversityIds,
} from "@/lib/discovery";
import { listUniversityPublicEvents } from "@/lib/events";
import { currentTermYear, listStaleCircles } from "@/lib/handover";
import { PREFECTURE_UNKNOWN } from "@/lib/prefectures";
import { getCurrentUser, getMyUniversityId } from "@/lib/dal";
import { CIRCLE_CATEGORIES, isCircleCategory } from "@/lib/circle-categories";

export const metadata: Metadata = { title: "サークル | UniCircle Connect" };

export default async function CirclesPage({
  searchParams,
}: {
  searchParams: Promise<{
    others?: string;
    fav?: string;
    pref?: string;
    university?: string;
    campus?: string;
    q?: string;
    cat?: string;
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
  const { others, fav, pref, university, campus, q, cat } = await searchParams;
  const search = (q ?? "").trim();
  // 分野（0033）。知らない値は無視して全部を出す
  const category = isCircleCategory(cat) ? cat : null;
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
    useDirectory || university ? await listCampusDirectory() : [];

  // 拠点まで指定されていればその拠点、なければ大学の代表拠点
  const selected = university
    ? (directory.find(
        (e) =>
          e.universityId === university &&
          (campus ? e.campusId === campus : e.isPrimary),
      ) ?? null)
    : null;

  const listed = selected
    ? await listPublicCircles(
        [selected.universityId],
        favoriteIds,
        selected.campusId
          ? { id: selected.campusId, includeUnassigned: selected.isPrimary }
          : undefined,
        search,
        category,
      )
    : isAnon || isGeneral
      ? await listPublicCircles(
          watchedIds,
          favoriteIds,
          undefined,
          search,
          category,
        )
      : await listApprovedCircles(universityId, {
          isStaff: user.role === "staff",
          showOtherUniversities,
          myCircleIds,
          search,
          category,
        });

  // 大学を選んだときは、その大学の学外向けイベントも一緒に見せる
  const universityEvents = selected
    ? await listUniversityPublicEvents(selected.universityId)
    : [];

  const { hiddenCount, truncated, error } = listed;
  const circles = favoritesOnly
    ? listed.circles.filter((c) => favoriteIds.has(c.id))
    : listed.circles;

  // 職員には自分の大学の承認待ちキューを見せる
  const isStaff = user?.role === "staff";
  const [pending, closureRequests, requiredApprovals, staffCount, stale] =
    isStaff
      ? await Promise.all([
          listPendingCircles(user.id),
          listClosureRequests(universityId),
          getRequiredApprovals(universityId),
          countStaff(universityId),
          listStaleCircles(universityId),
        ])
      : [[], [], 1, 0, []];

  // 「あと何人か」を出すために、集まっている承認の数を引く
  const [setupCounts, closureCounts] = isStaff
    ? await Promise.all([
        countApprovals(
          "circle",
          pending.map((c) => c.id),
        ),
        countApprovals(
          "circle_closure",
          closureRequests.map((c) => c.id),
        ),
      ])
    : [new Map<string, number>(), new Map<string, number>()];

  // 大学を1つ選んだあとは、まとめる意味が無いので平坦に並べる。
  // 描画の分岐もこの値を見る。データ側だけ条件を足すと、
  // 「まとめる」経路のまま空の配列を描いてしまう。
  // 検索したときは階層を飛ばして結果だけ出す。
  // 「都道府県を選び直してから検索」では手間が増えるだけなので。
  // 検索語か分野を指定したら、都道府県から辿らずに結果を並べる
  const showDirectory = useDirectory && !selected && !search && !category;
  const showGrouped = groupByUniversity && !selected;

  // 大学ごとにまとめる。大学名の五十音順、同じ大学の中はサークル名順。
  const byUniversity = showGrouped
    ? [
        ...circles
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
          selected ? (
            <>
              {selected.label}の公開サークルです。
              {selected.isPrimary &&
                selected.campusId &&
                "拠点が未設定のサークルもここに含めています。"}
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
          <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
            承認は{requiredApprovals}人揃って成立します。却下は1人で成立します。
          </p>
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
                <div className="w-full sm:w-auto sm:shrink-0">
                  <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
                    承認 {setupCounts.get(circle.id) ?? 0} / {requiredApprovals}
                    人
                  </p>
                  <form action={decideCircle} className="flex flex-wrap gap-2">
                    <input type="hidden" name="circle_id" value={circle.id} />
                    <input
                      name="comment"
                      maxLength={200}
                      placeholder="所見（任意）"
                      className="field-input w-full sm:w-56"
                    />
                    <button
                      type="submit"
                      name="approve"
                      value="true"
                      className="btn-primary px-3 py-1.5 text-xs"
                    >
                      承認
                    </button>
                    <button
                      type="submit"
                      name="approve"
                      value="false"
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

      {closureRequests.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-3 inline-flex items-center gap-2 rounded-xl border border-amber-300/70 bg-amber-50/70 px-3 py-1.5 text-sm font-semibold text-amber-800 backdrop-blur-md dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200">
            廃止の申請が{closureRequests.length}件あります
          </h2>
          <ul className="space-y-3">
            {closureRequests.map((circle) => (
              <li
                key={circle.id}
                className="glass-card tint-amber flex flex-wrap items-center justify-between gap-3 p-4"
              >
                <div className="min-w-0">
                  <p className="font-medium">{circle.name}</p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    承認 {closureCounts.get(circle.id) ?? 0} /{" "}
                    {requiredApprovals}人
                  </p>
                </div>
                <form action={decideClosure} className="flex flex-wrap gap-2">
                  <input type="hidden" name="circle_id" value={circle.id} />
                  <input
                    name="comment"
                    maxLength={200}
                    placeholder="所見（任意）"
                    className="field-input w-full sm:w-56"
                  />
                  <button
                    type="submit"
                    name="approve"
                    value="true"
                    className="btn-danger-sm"
                  >
                    廃止を承認
                  </button>
                  <button
                    type="submit"
                    name="approve"
                    value="false"
                    className="btn-ghost-sm"
                  >
                    却下
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      {isStaff && stale.length > 0 && (
        <section className="mb-10 glass-panel">
          <h2 className="mb-1 text-sm font-semibold">
            今年度まだ代替わりしていないサークル（{stale.length}件）
          </h2>
          <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
            年度が替わっても代表が前のままだと、卒業した人がサークルを
            握ったままになります。{currentTermYear()}
            年度の代表が登録されていない一覧です。
          </p>
          <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
            {stale.map((c) => (
              <li key={c.id} className="text-sm">
                <Link href={`/circles/${c.id}`} className="underline">
                  {c.name}
                </Link>
                <span className="ml-1.5 text-xs text-gray-500 dark:text-gray-400">
                  {c.term_year ? `${c.term_year}年度` : "設立の代"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {isStaff && (
        <section className="mb-10 glass-panel">
          <h2 className="mb-1 text-sm font-semibold">承認のきまり</h2>
          <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
            サークルの設立と廃止に、何人の職員の承認を求めるかを決めます。
          </p>
          <ApprovalPolicy current={requiredApprovals} staffCount={staffCount} />
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

      {(useDirectory || selected) && (
        <DirectoryBreadcrumb
          prefecture={pref ?? selected?.prefecture}
          universityName={selected?.label}
        />
      )}

      <SearchForm
        action="/circles"
        placeholder="サークル名・活動内容で検索"
        value={search}
        hidden={{
          pref,
          university,
          campus,
          others,
          fav,
          cat: category ?? undefined,
        }}
      />

      {/* 分野で絞る。検索語を思いつけない人の入口にもなる */}
      <nav
        aria-label="分野で絞り込む"
        className="-mt-2 mb-6 flex flex-wrap gap-2"
      >
        {[{ value: null, label: "すべて" }, ...CIRCLE_CATEGORIES].map((c) => {
          const active = c.value === category;
          const params = new URLSearchParams(
            Object.entries({
              pref,
              university,
              campus,
              others,
              fav,
              q: search || undefined,
              cat: c.value ?? undefined,
            }).filter((e): e is [string, string] => Boolean(e[1])),
          );
          return (
            <Link
              key={c.label}
              href={`/circles${params.size ? `?${params}` : ""}`}
              aria-current={active ? "true" : undefined}
              className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold transition-colors ${
                active
                  ? "border-transparent bg-[rgb(var(--accent-ink))] text-white dark:text-gray-900"
                  : "border-black/10 text-gray-700 hover:bg-black/5 dark:border-white/15 dark:text-gray-300 dark:hover:bg-white/10"
              }`}
            >
              {c.label}
            </Link>
          );
        })}
      </nav>

      {truncated && (
        <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
          該当が多いため一部だけ表示しています。検索語を足すか、
          大学を選んで絞り込んでください。
        </p>
      )}

      {universityEvents.length > 0 && !search && (
        <section className="mb-8">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold">
              {selected?.universityName}の公開イベント
            </h2>
            <Link
              href="/events"
              className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
            >
              イベントを一覧で見る
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {universityEvents.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        </section>
      )}

      {selected && !search && (
        <h2 className="mb-3 text-lg font-semibold">サークル</h2>
      )}

      {selected?.websiteUrl && (
        <p className="mb-4 text-sm">
          <a
            href={selected.websiteUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
          >
            {selected.universityName}の公式サイト
          </a>
        </p>
      )}

      {showDirectory ? (
        pref ? (
          <UniversityList
            prefecture={pref}
            entries={directory.filter(
              (e) => (e.prefecture ?? PREFECTURE_UNKNOWN) === pref,
            )}
          />
        ) : (
          <PrefectureList entries={directory} />
        )
      ) : circles.length === 0 && !error ? (
        <p className="glass-empty py-12">
          {search
            ? `「${search}」に一致するサークルはありません。`
            : category
              ? "この分野のサークルはまだありません。ほかの分野も見てみてください。"
              : favoritesOnly
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
      ) : showGrouped ? (
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
