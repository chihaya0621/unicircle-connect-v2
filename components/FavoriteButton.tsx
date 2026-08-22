"use client";

import { useOptimistic, useTransition } from "react";

import { toggleCircleFavorite } from "@/app/actions/discovery";

/**
 * 気になるサークルの登録ボタン。
 *
 * サーバーの応答を待たずに見た目を切り替える。押した手応えが
 * 遅れて返ってくると、押せていないと思って二度押ししやすいため。
 * 失敗したときは再描画で本来の状態に戻る。
 *
 * カード全体がリンクになっている場所でも使うので、
 * クリックが親のリンクへ伝わらないようにしている。
 */
export function FavoriteButton({
  circleId,
  isFavorite,
  className = "",
}: {
  circleId: string;
  isFavorite: boolean;
  className?: string;
}) {
  const [optimistic, setOptimistic] = useOptimistic(isFavorite);
  const [, startTransition] = useTransition();

  return (
    <button
      type="button"
      aria-pressed={optimistic}
      aria-label={optimistic ? "気になるから外す" : "気になるに追加"}
      title={optimistic ? "気になるから外す" : "気になるに追加"}
      onClick={(e) => {
        // カードのリンクに乗っているので、遷移を止める
        e.preventDefault();
        e.stopPropagation();
        startTransition(async () => {
          setOptimistic(!optimistic);
          const data = new FormData();
          data.set("circle_id", circleId);
          await toggleCircleFavorite(data);
        });
      }}
      className={`inline-flex size-9 shrink-0 items-center justify-center rounded-full transition-all duration-300 ease-out hover:scale-110 active:scale-90 ${
        optimistic
          ? "text-rose-500"
          : "text-gray-300 hover:text-rose-400 dark:text-gray-600"
      } ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        className="size-5"
        fill={optimistic ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M12 20.5 4.4 13a4.7 4.7 0 0 1 6.6-6.7l1 1 1-1A4.7 4.7 0 0 1 19.6 13z" />
      </svg>
    </button>
  );
}
