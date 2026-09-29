"use client";

/**
 * 印刷を呼ぶだけのボタン。
 *
 * ブラウザの印刷は window.print() でしか開けず、Server Component からは
 * 呼べないので、これだけのために切り出している。
 *
 * quiet: 判断が残っている申請書では控えめにする。画面でいちばん目立つのが
 * 印刷だと、判断欄より先にそちらを押してしまう。
 */
export function PrintButton({ quiet = false }: { quiet?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={
        quiet ? "btn-ghost px-4 py-2 text-sm" : "btn-primary px-5 py-2 text-sm"
      }
    >
      印刷 / PDF に保存
    </button>
  );
}
