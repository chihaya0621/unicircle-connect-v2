import type { NextConfig } from "next";

// Supabase Storage の公開URLから画像を読むため、next/image に許可を与える。
// ホスト名は環境変数から組み立てる（プロジェクトを差し替えても追随する）。
const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;

const nextConfig: NextConfig = {
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
