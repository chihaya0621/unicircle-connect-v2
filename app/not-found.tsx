import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "ページが見つかりません | UniCircle Connect",
};

/**
 * 見つからないときの画面。
 *
 * 存在しない URL と、notFound() を呼んだとき（消えたサークルやイベント、
 * 非公開で見えないもの）の両方がここに来る。Next の既定の画面は英語の
 * 一文だけで、戻るリンクも無かった。
 */
export default function NotFound() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <section className="glass-panel p-6 sm:p-8">
        <p
          className="text-xs font-bold tracking-[0.2em]"
          style={{ color: "rgb(var(--accent-ink))" }}
        >
          404
        </p>
        <h1 className="mt-2 text-2xl font-bold">ページが見つかりません</h1>
        <p className="mt-3 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
          アドレスが違うか、サークルやイベントが非公開になった、
          または削除された可能性があります。
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/" className="btn-primary px-5">
            トップへ戻る
          </Link>
          <Link href="/circles" className="btn-ghost px-5">
            サークルを探す
          </Link>
          <Link href="/events" className="btn-ghost px-5">
            公開イベントを見る
          </Link>
        </div>
      </section>
    </div>
  );
}
