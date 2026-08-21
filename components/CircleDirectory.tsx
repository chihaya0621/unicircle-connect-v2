import Link from "next/link";

import type { DirectoryEntry } from "@/lib/discovery";
import { PREFECTURE_UNKNOWN, prefectureOrder } from "@/lib/prefectures";

/**
 * 公開のサークル探索。都道府県 → 大学 → サークル と辿る。
 *
 * 多くの大学が載ると、全サークルを平坦に並べても選べない。
 * 住所で範囲を狭めてから大学を選ぶ、紙の大学案内と同じ順序にしている。
 *
 * 件数は必ず添える。0件の大学に入ってから空だと分かるのは徒労なので。
 */

type Level = { href: string; label: string; sub: string };

function Tiles({ items }: { items: Level[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <li key={item.href}>
          <Link
            href={item.href}
            className="glass-card flex items-baseline justify-between gap-3 p-4"
          >
            <span className="min-w-0 font-medium">{item.label}</span>
            <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400">
              {item.sub}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/**
 * 都道府県の一覧。キャンパスが1つも無い県は出さない。
 *
 * 大学数は実体で数える。県をまたぐ大学は複数のキャンパスを持つので、
 * 拠点の数をそのまま出すと同じ大学を二重に数えてしまう。
 */
export function PrefectureList({ entries }: { entries: DirectoryEntry[] }) {
  const byPrefecture = new Map<
    string,
    { universities: Set<string>; circles: number }
  >();
  for (const e of entries) {
    const key = e.prefecture ?? PREFECTURE_UNKNOWN;
    const acc =
      byPrefecture.get(key) ?? { universities: new Set<string>(), circles: 0 };
    acc.universities.add(e.universityId);
    acc.circles += e.circleCount;
    byPrefecture.set(key, acc);
  }

  const items = [...byPrefecture.entries()]
    .sort((a, b) => prefectureOrder(a[0]) - prefectureOrder(b[0]))
    .map(([name, acc]) => ({
      href: `/circles?pref=${encodeURIComponent(name)}`,
      label: name,
      sub: `${acc.universities.size}大学 ／ ${acc.circles}件`,
    }));

  if (items.length === 0) {
    return (
      <p className="glass-empty py-12">掲載されている大学がまだありません。</p>
    );
  }
  return <Tiles items={items} />;
}

/** ある都道府県の拠点一覧 */
export function UniversityList({
  prefecture,
  entries,
}: {
  prefecture: string;
  entries: DirectoryEntry[];
}) {
  if (entries.length === 0) {
    return (
      <p className="glass-empty py-12">
        {prefecture}に掲載されている大学がまだありません。
      </p>
    );
  }

  return (
    <Tiles
      items={entries.map((e) => ({
        href: e.campusId
          ? `/circles?university=${e.universityId}&campus=${e.campusId}`
          : `/circles?university=${e.universityId}`,
        label: e.label,
        sub: `${e.circleCount}件`,
      }))}
    />
  );
}

/** いまどこを見ているか。1つ上に戻れるようにする */
export function DirectoryBreadcrumb({
  prefecture,
  universityName,
}: {
  prefecture?: string | null;
  universityName?: string | null;
}) {
  return (
    <nav aria-label="現在地" className="mb-4 flex flex-wrap items-center gap-2 text-sm">
      <Link
        href="/circles"
        className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
      >
        都道府県から探す
      </Link>
      {prefecture && (
        <>
          <span aria-hidden className="text-gray-400">
            ／
          </span>
          {universityName ? (
            <Link
              href={`/circles?pref=${encodeURIComponent(prefecture)}`}
              className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
            >
              {prefecture}
            </Link>
          ) : (
            <span className="text-gray-600 dark:text-gray-400">{prefecture}</span>
          )}
        </>
      )}
      {universityName && (
        <>
          <span aria-hidden className="text-gray-400">
            ／
          </span>
          <span className="text-gray-600 dark:text-gray-400">
            {universityName}
          </span>
        </>
      )}
    </nav>
  );
}
