"use client";

import { useSyncExternalStore } from "react";

/**
 * 明るさの切り替え（端末に合わせる／明るい／暗い）。
 *
 * テーマ（配色）とは別に持つ。昼に暗くしたい、夜に明るくしたい、に応える。
 * 選択はアカウントではなくこの端末に残す。スマホは暗く、PC は明るく、
 * のように端末ごとに違ってよいものなので。
 *
 * 描画前の反映は app/layout.tsx のスクリプトが受け持つ。ここでは
 * 押されたときに同じ値を書き、html の data-scheme をその場で付け替える。
 */
export type Mode = "system" | "light" | "dark";

const KEY = "uc-mode";
const EVENT = "uc-mode-change";

function read(): Mode {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

function apply(mode: Mode) {
  const dark =
    mode === "dark" ||
    (mode === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.scheme = dark ? "dark" : "light";
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

const OPTIONS: { value: Mode; label: string }[] = [
  { value: "system", label: "端末に合わせる" },
  { value: "light", label: "明るい" },
  { value: "dark", label: "暗い" },
];

export function ModeSwitcher({ compact = false }: { compact?: boolean }) {
  // サーバーでは選択が分からないので「端末に合わせる」として描く
  const mode = useSyncExternalStore(subscribe, read, () => "system" as Mode);

  const choose = (next: Mode) => {
    try {
      if (next === "system") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, next);
    } catch {
      // 保存できない環境でも、いま開いている画面には反映する
    }
    apply(next);
    window.dispatchEvent(new Event(EVENT));
  };

  return (
    <div
      role="radiogroup"
      aria-label="明るさ"
      className={`inline-flex rounded-full border border-black/10 bg-black/[0.03] p-1 dark:border-white/15 dark:bg-white/5 ${
        compact ? "text-xs" : "text-sm"
      }`}
    >
      {OPTIONS.map((o) => {
        const active = o.value === mode;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => choose(o.value)}
            className={`min-h-11 rounded-full px-3.5 font-semibold transition-colors ${
              active
                ? "bg-white text-gray-900 shadow-sm dark:bg-white/15 dark:text-white"
                : "text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
