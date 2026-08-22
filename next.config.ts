import type { NextConfig } from "next";

// Supabase Storage の公開URLから画像を読むため、next/image に許可を与える。
// ホスト名は環境変数から組み立てる（プロジェクトを差し替えても追随する）。
const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;

const nextConfig: NextConfig = {
  // 出力先を環境変数で差し替えられるようにしておく。
  // 開発サーバーを動かしたまま検証用のビルドを回すと、同じ .next を
  // 奪い合ってキャッシュが壊れる（実際に一度壊して全ページ 404 になった）。
  // 使ったあとは tsconfig.json の include に検証用ディレクトリが
  // 書き足されるので、元に戻してからコミットすること。
  distDir: process.env.NEXT_DIST_DIR ?? ".next",

  // ダッシュボードはカレンダーに統合した。中身（参加予定・所属サークル）は
  // すべてカレンダー側に移してあるので、古いリンクはそちらへ送る。
  // permanent: false なのは、ブラウザに 308 を焼き付けたくないため。
  async redirects() {
    return [{ source: "/dashboard", destination: "/calendar", permanent: false }];
  },
  images: {
    remotePatterns: supabaseHost
      ? [
          {
            protocol: "https",
            hostname: supabaseHost,
            pathname: "/storage/v1/object/public/**",
          },
        ]
      : [],
  },
};

export default nextConfig;
