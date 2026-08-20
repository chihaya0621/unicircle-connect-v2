"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { SOURCE_COLOR, SOURCE_LABEL, SOURCE_ORDER } from "@/lib/event-sources";
import type { Tables } from "@/lib/database.types";

type University = Pick<Tables<"universities">, "id" | "name">;

/**
 * 絞り込みパネル。
 *
 * 状態は URL クエリに持つ。サーバー側で絞り込めるうえ、
 * 表示中の条件をそのまま共有・ブックマークできるため。
 */
export function CalendarFilterPanel({
  universities,
  myUniversityId,
  selectedUniversities,
  showUnjoinedCircles,
  search,
}: {
  universities: University[];
  myUniversityId: string | null;
  selectedUniversities: string[];
  showUnjoinedCircles: boolean;
  search: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState(search);

  const others = universities.filter((u) => u.id !== myUniversityId);

  /** 現在のクエリを保ったまま一部だけ差し替える */
  function apply(changes: Record<string, string | string[] | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      next.delete(key);
      if (Array.isArray(value)) {
        for (const v of value) next.append(key, v);
      } else if (value !== null && value !== "") {
        next.set(key, value);
      }
    }
    router.push(`/calendar?${next.toString()}`);
  }

  function toggleUniversity(id: string) {
    const set = new Set(selectedUniversities);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    apply({ universities: [...set] });
  }

  return (
    <div className="mb-6 space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          apply({ search: keyword });
        }}
        className="flex gap-2"
      >
        <input
          type="search"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="イベント名・内容で検索（他大学のサークルも対象）"
          className="w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm outline-none transition placeholder:text-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:border-white/15 dark:bg-white/5 dark:focus:ring-indigo-900"
        />
        <button
          type="submit"
          className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500"
        >
          検索
        </button>
        {search && (
          <button
            type="button"
            onClick={() => {
              setKeyword("");
              apply({ search: null });
            }}
            className="shrink-0 rounded-lg border border-black/15 px-3 py-2 text-sm transition hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
          >
            クリア
          </button>
        )}
      </form>

      <div className="rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-white/5">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between text-left"
        >
          <span className="text-sm font-semibold">表示する範囲</span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {open ? "閉じる" : "変更する"}
          </span>
        </button>

        {open && (
          <div className="mt-4 space-y-4">
            <div>
              <p className="mb-2 text-xs font-medium text-gray-700 dark:text-gray-300">
                常に表示
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                自大学主催のイベント、所属サークルのイベント、参加予定のイベント
              </p>
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={showUnjoinedCircles}
                  onChange={(e) =>
                    apply({ unjoined: e.target.checked ? "1" : null })
                  }
                  className="rounded border-black/20 text-indigo-600 focus:ring-indigo-500"
                />
                自大学の未所属サークルの公開イベントも表示する
              </label>
            </div>

            {others.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium text-gray-700 dark:text-gray-300">
                  公開イベントを表示する他大学
                </p>
                <div className="space-y-2">
                  {others.map((u) => (
                    <label key={u.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={selectedUniversities.includes(u.id)}
                        onChange={() => toggleUniversity(u.id)}
                        className="rounded border-black/20 text-indigo-600 focus:ring-indigo-500"
                      />
                      {u.name}
                    </label>
                  ))}
                </div>
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  他大学のサークルのイベントは一覧には出ません。検索で探せます。
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      <ul className="flex flex-wrap gap-2">
        {SOURCE_ORDER.map((s) => (
          <li
            key={s}
            className={`rounded-full px-2.5 py-0.5 text-xs ${SOURCE_COLOR[s]}`}
          >
            {SOURCE_LABEL[s]}
          </li>
        ))}
      </ul>
    </div>
  );
}
