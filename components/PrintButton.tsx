"use client";

/**
 * 印刷を呼ぶだけのボタン。
 *
 * ブラウザの印刷は window.print() でしか開けず、Server Component からは
 * 呼べないので、これだけのために切り出している。
 */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="btn-primary px-5 py-2 text-sm"
    >
      印刷 / PDF に保存
    </button>
  );
}
