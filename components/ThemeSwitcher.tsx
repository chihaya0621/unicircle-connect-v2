"use client";

import { useActionState } from "react";

import { setTheme, type ActionState } from "@/app/actions/theme";
import { FormMessage } from "@/components/Field";
import type { Theme } from "@/lib/database.types";

const THEMES: {
  value: Theme;
  name: string;
  description: string;
  /** プレビュー用の配色。CSS 側の変数と同じ値にしている */
  swatch: string[];
}[] = [
  {
    value: "pop",
    name: "ポップ",
    description: "青を軸に多色を散らした、輪郭のはっきりした配色。",
    swatch: ["#2563eb", "#facc15", "#ec4899", "#22c55e"],
  },
  {
    value: "citrus",
    name: "シトラス",
    description: "オレンジと黄色でまとめた、暖かく快活な配色。",
    swatch: ["#f97316", "#facc15", "#f43f5e", "#d97706"],
  },
  {
    value: "mint",
    name: "ミント",
    description: "緑を基調にした、落ち着きのある自然な配色。",
    swatch: ["#10b981", "#84cc16", "#14b8a6", "#facc15"],
  },
  {
    value: "berry",
    name: "ベリー",
    description: "紫とピンクを組み合わせた、落ち着いた華やかさ。",
    swatch: ["#8b5cf6", "#ec4899", "#6366f1", "#f472b6"],
  },
  {
    value: "glass",
    name: "グラス",
    description: "淡いグラデーションの上にすりガラスの面が浮かぶ、質感の違う一枚。",
    swatch: ["#818cf8", "#f472b6", "#2dd4bf", "#fbbf24"],
  },
];

export function ThemeSwitcher({ current }: { current: Theme }) {
  const [state, action] = useActionState<ActionState, FormData>(setTheme, null);

  return (
    <div className="space-y-4">
      {state?.error && <FormMessage tone="error">{state.error}</FormMessage>}
      {state?.notice && <FormMessage tone="notice">{state.notice}</FormMessage>}

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {THEMES.map((t) => {
          const active = t.value === current;
          return (
            <li key={t.value}>
              {/* 1テーマ1フォーム。選ぶと即座に切り替わる */}
              <form action={action}>
                <input type="hidden" name="theme" value={t.value} />
                <button
                  type="submit"
                  aria-pressed={active}
                  className={`glass-card w-full p-4 text-left ${
                    active
                      ? "border-[rgb(var(--accent)/0.6)] ring-2 ring-[rgb(var(--accent)/0.35)]"
                      : ""
                  }`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{t.name}</span>
                    {active && (
                      <span className="badge bg-[rgb(var(--accent)/0.15)] text-[rgb(var(--accent))]">
                        使用中
                      </span>
                    )}
                  </span>

                  <span className="mt-2 flex gap-1.5">
                    {t.swatch.map((c) => (
                      <span
                        key={c}
                        className="size-5 rounded-full shadow-sm transition-transform duration-300 ease-out"
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </span>

                  <span className="mt-2 block text-xs text-gray-600 dark:text-gray-400">
                    {t.description}
                  </span>
                </button>
              </form>
            </li>
          );
        })}
      </ul>

      <p className="text-xs text-gray-500 dark:text-gray-400">
        テーマはアカウントごとに保存されます。別の端末でログインしても同じ見た目になります。
      </p>
    </div>
  );
}
