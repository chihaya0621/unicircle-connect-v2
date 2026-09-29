import Link from "next/link";

/**
 * 詳細から一覧へ戻る道。
 *
 * QR から直接詳細に来た人は、ブラウザの戻るでは一覧に戻れず、
 * ヘッダーのメニューから探し直すしかなかった。
 *
 * 大学名はひとつの文節として扱われ、途中で折れない。長い名前でも
 * 画面からはみ出さないよう、収まらないときだけ字の途中で折る。
 */
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <nav aria-label="戻る" className="mb-4 print:hidden">
      <Link
        href={href}
        className="tap-target inline-flex max-w-full items-baseline gap-1 text-sm font-medium text-gray-600 hover:text-gray-900 hover:underline dark:text-gray-400 dark:hover:text-gray-100"
      >
        <span aria-hidden>←</span>
        <span className="min-w-0 wrap-anywhere">{label}</span>
      </Link>
    </nav>
  );
}
