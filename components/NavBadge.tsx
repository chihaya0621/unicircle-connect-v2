/** ヘッダーのナビ1項目。デスクトップの横並びとモバイルの開閉メニューで共有する */
export type NavItem = {
  href: string;
  label: string;
  /** 対応が必要な件数。0 のときは出さない */
  badge?: number;
};

/**
 * 対応が必要な件数を示すバッジ。
 *
 * Server / Client どちらからも使うので、このファイルには
 * サーバー専用の依存もフックも持ち込まないこと。
 */
export function NavBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="ml-1 inline-flex min-w-5 animate-[pop-in_300ms_cubic-bezier(0.34,1.56,0.64,1)] items-center justify-center rounded-full bg-rose-600 px-1.5 py-0.5 text-xs font-semibold leading-none text-white shadow-md shadow-rose-500/40">
      {count}
    </span>
  );
}
