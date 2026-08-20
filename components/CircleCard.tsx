import Image from "next/image";
import Link from "next/link";

import type { CircleListItem } from "@/lib/circles";
import type { Scope } from "@/lib/database.types";
import { imageUrl } from "@/lib/images";

const SCOPE_BADGE: Record<Scope, { label: string; className: string } | null> = {
  university: null, // 自大学のみは既定なのでバッジを出さない
  scoped: {
    label: "他大学参加可",
    className:
      "bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  },
  public: {
    label: "インカレ",
    className:
      "bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  },
};

export function CircleCard({ circle }: { circle: CircleListItem }) {
  // Supabase の集約は [{ count: n }] の形で返る
  const memberCount = circle.member_count?.[0]?.count ?? 0;
  const scopeBadge = SCOPE_BADGE[circle.scope];
  const image = imageUrl(circle.image_path);

  return (
    <Link
      href={`/circles/${circle.id}`}
      className="block overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm transition hover:shadow-md dark:border-white/10 dark:bg-white/5"
    >
      {image && (
        <div className="relative aspect-[3/1] w-full">
          <Image
            src={image}
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, 400px"
            className="object-cover"
          />
        </div>
      )}
      <div className="p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold leading-snug">{circle.name}</h3>
        <span className="flex shrink-0 gap-1.5">
          {scopeBadge && (
            <span
              className={`rounded-full px-2 py-0.5 text-xs ${scopeBadge.className}`}
            >
              {scopeBadge.label}
            </span>
          )}
          {circle.status === "pending" && (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-950 dark:text-amber-300">
              承認待ち
            </span>
          )}
        </span>
      </div>

      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        {circle.university?.name ?? "所属大学未設定"} ／ メンバー{memberCount}人
      </p>

      {circle.description && (
        <p className="mt-3 line-clamp-2 text-sm text-gray-700 dark:text-gray-300">
          {circle.description}
        </p>
      )}
      </div>
    </Link>
  );
}
