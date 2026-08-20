import Link from "next/link";

import type { CircleListItem } from "@/lib/circles";

export function CircleCard({ circle }: { circle: CircleListItem }) {
  // Supabase の集約は [{ count: n }] の形で返る
  const memberCount = circle.member_count?.[0]?.count ?? 0;

  return (
    <Link
      href={`/circles/${circle.id}`}
      className="block rounded-xl border border-black/10 bg-white p-5 shadow-sm transition hover:shadow-md dark:border-white/10 dark:bg-white/5"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold leading-snug">{circle.name}</h3>
        {circle.status === "pending" && (
          <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-950 dark:text-amber-300">
            承認待ち
          </span>
        )}
      </div>

      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        {circle.university?.name ?? "所属大学未設定"} ／ メンバー{memberCount}人
      </p>

      {circle.description && (
        <p className="mt-3 line-clamp-2 text-sm text-gray-700 dark:text-gray-300">
          {circle.description}
        </p>
      )}
    </Link>
  );
}
