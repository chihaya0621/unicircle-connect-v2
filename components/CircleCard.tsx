import Image from "next/image";
import Link from "next/link";

import { FavoriteButton } from "@/components/FavoriteButton";
import type { CircleListItem } from "@/lib/circles";
import type { Scope } from "@/lib/database.types";
import { imageUrl } from "@/lib/images";

const SCOPE_BADGE: Record<Scope, { label: string; className: string } | null> = {
  university: null, // 自大学のみは既定なのでバッジを出さない
  scoped: {
    label: "他大学参加可",
    className: "bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  },
  public: {
    label: "インカレ",
    className:
      "bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  },
};

/**
 * カード全体をリンクにしつつ、中に「気になる」ボタンを置いている。
 *
 * <Link> でカードを丸ごと包むとボタンを入れ子にできない（対話要素の
 * 入れ子は不正なので、押しても意図した動きにならない）。
 * 見出しのリンクを疑似要素でカード全面に広げ、ボタンだけを
 * その上に重ねることで、正しいマークアップのまま同じ操作感にしている。
 */
export function CircleCard({
  circle,
  isMember = false,
  isFavorite,
}: {
  circle: CircleListItem;
  /** 所属中なら目印を出す */
  isMember?: boolean;
  /** 未指定なら「気になる」ボタンを出さない（未ログインの一覧など） */
  isFavorite?: boolean;
}) {
  // Supabase の集約は [{ count: n }] の形で返る
  const memberCount = circle.member_count?.[0]?.count ?? 0;
  const scopeBadge = SCOPE_BADGE[circle.scope];
  const image = imageUrl(circle.image_path);

  return (
    <article
      className={`glass-card relative p-5 ${isMember ? "tint-indigo" : ""}`}
    >
      <div className="flex items-start gap-3">
        {/* アイコンとして扱うので正方形に切り出す */}
        {image ? (
          <div className="relative size-12 shrink-0 overflow-hidden rounded-xl border border-white/60 shadow-md dark:border-white/15">
            <Image
              src={image}
              alt=""
              fill
              sizes="48px"
              className="object-cover"
            />
          </div>
        ) : (
          <div
            aria-hidden
            className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-white/50 bg-white/30 text-sm font-semibold text-gray-500 backdrop-blur-sm dark:border-white/10 dark:bg-white/5 dark:text-gray-400"
          >
            {circle.name.slice(0, 1)}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="min-w-0 font-semibold leading-snug">
              <Link
                href={`/circles/${circle.id}`}
                className="after:absolute after:inset-0 after:content-[''] hover:underline focus-visible:outline-none focus-visible:underline"
              >
                {circle.name}
              </Link>
            </h3>

            <span className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
              {isMember && (
                <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200">
                  所属中
                </span>
              )}
              {scopeBadge && (
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${scopeBadge.className}`}
                >
                  {scopeBadge.label}
                </span>
              )}
              {circle.status === "pending" && (
                <span className="badge bg-amber-500/15 text-amber-700 dark:text-amber-300">
                  承認待ち
                </span>
              )}
              {isFavorite !== undefined && (
                <FavoriteButton
                  circleId={circle.id}
                  isFavorite={isFavorite}
                  className="relative -mr-1.5"
                />
              )}
            </span>
          </div>

          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {circle.university?.name ?? "所属大学未設定"} ／ メンバー
            {memberCount}人
          </p>

          {circle.description && (
            <p className="mt-2 line-clamp-2 text-sm text-gray-700 dark:text-gray-300">
              {circle.description}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}
