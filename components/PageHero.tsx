import type { ReactNode } from "react";

/**
 * ページ上部の見出し。
 *
 * 以前は見出しを枠で囲み、背後に色の付いた円や帯を置き、
 * 題名の上に英字（CIRCLES・EVENTS など）を小さく添えていた。
 * どれも中身を足さない飾りで、日本語の画面に英字を重ねると
 * かえって「どこかの雛形」に見える。題名と説明と操作だけを置く。
 */
export function PageHero({
  title,
  description,
  action,
}: {
  title: string;
  description?: ReactNode;
  /** 右側に置く操作。ボタンやリンクを想定 */
  action?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-black/10 pb-4 dark:border-white/15">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 text-sm text-gray-600 dark:text-gray-400">
            {description}
          </p>
        )}
      </div>

      {action && (
        <div className="flex flex-wrap items-center gap-2">{action}</div>
      )}
    </header>
  );
}
