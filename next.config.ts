import type { NextConfig } from "next";

// Supabase Storage の公開URLから画像を読むため、next/image に許可を与える。
// ホスト名は環境変数から組み立てる（プロジェクトを差し替えても追随する）。
const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;

const nextConfig: NextConfig = {
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
