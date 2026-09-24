"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * 画面を作る途中で、想定外の失敗が起きたときの画面。
 *
 * Next の既定の画面は英語の一文だけで、何をすればいいか分からなかった。
 * 本番では、サーバー側の失敗の理由は伏せられ、digest だけが届く。
 * ログと突き合わせられるよう、それを小さく出しておく。
 */
export default function ErrorPage({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <section className="glass-panel p-6 sm:p-8">
        <h1 className="text-2xl font-bold">表示できませんでした</h1>
        <p className="mt-3 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
          一時的な不具合かもしれません。もう一度試すか、少し時間をおいてから
          開き直してください。
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => unstable_retry()}
            className="btn-primary px-5"
          >
            もう一度試す
          </button>
          <Link href="/" className="btn-ghost px-5">
            トップへ戻る
          </Link>
        </div>
        {error.digest && (
          <p className="mt-6 text-xs text-gray-500 dark:text-gray-400">
            エラー番号: {error.digest}
          </p>
        )}
      </section>
    </div>
  );
}
