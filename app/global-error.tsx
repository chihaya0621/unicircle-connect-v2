"use client";

/**
 * 全体の枠（app/layout.tsx）そのものが失敗したときの画面。
 *
 * 枠ごと差し替わるので、ヘッダーも全体の CSS も無い前提で書く。
 * 読めることだけを優先して、色と余白は直接指定する。
 */
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <html lang="ja">
      <body
        style={{
          margin: 0,
          fontFamily: "system-ui, sans-serif",
          background: "#f8fafc",
          color: "#111827",
        }}
      >
        <title>表示できませんでした | UniCircle Connect</title>
        <main style={{ maxWidth: 560, margin: "0 auto", padding: "64px 16px" }}>
          <h1 style={{ fontSize: 24, margin: 0 }}>表示できませんでした</h1>
          <p style={{ lineHeight: 1.7, color: "#4b5563" }}>
            一時的な不具合かもしれません。もう一度試すか、少し時間をおいてから開き直してください。
          </p>
          <p style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => unstable_retry()}
              style={{
                minHeight: 44,
                padding: "0 20px",
                borderRadius: 12,
                border: 0,
                background: "#1d4ed8",
                color: "#fff",
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              もう一度試す
            </button>
            {/* 枠が壊れているので、画面遷移ではなく読み込み直しで戻る */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              style={{
                display: "inline-flex",
                alignItems: "center",
                minHeight: 44,
                padding: "0 20px",
                color: "#1d4ed8",
                fontSize: 14,
              }}
            >
              トップへ戻る
            </a>
          </p>
          {error.digest && (
            <p style={{ fontSize: 12, color: "#6b7280" }}>
              エラー番号: {error.digest}
            </p>
          )}
        </main>
      </body>
    </html>
  );
}
