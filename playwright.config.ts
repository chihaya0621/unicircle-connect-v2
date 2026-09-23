import { defineConfig, devices } from "@playwright/test";

/**
 * E2E の設定。
 *
 * 【どこに向けて流すか】
 * ビルド済みのアプリを 3001 番で起動し、そこへ流す。開発サーバー（3000）
 * とは別のポート・別の出力先（.next-e2e）を使うので、動かしたまま実行できる。
 * 以前、同じ .next を奪い合ってキャッシュが壊れ、全ページが 404 になったため。
 *
 * データベースは .env.local の Supabase をそのまま見る。Docker が要る
 * ローカル Supabase は立てていない。つまり**公開デモと同じデータを触る**。
 * そのため、書き込みを伴うテストは必ず元に戻すところまでを1本に含める。
 *
 * 【dev ではなく build + start を使う理由】
 * NEXT_PUBLIC_* はビルド時に埋め込まれるので、dev と production で
 * クイックログインの有無が変わる。本番と同じ条件で確かめたい。
 */
export default defineConfig({
  testDir: "./e2e",
  // 書き込みを伴うテストがあるので、並列に走らせない。
  // 同じサークルに同時に引き継ぎを申し出ると、片方が必ず失敗する。
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : [["list"], ["html", { open: "never" }]],

  use: {
    baseURL: "http://127.0.0.1:3001",
    locale: "ja-JP",
    timezoneId: "Asia/Tokyo",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },

  projects: [
    // 先にログインして、あとのテストはその状態を使い回す。
    // 毎回ログインし直すと、Supabase 側のレート制限に当たる。
    // ログインは広い画面で済ませる。狭い画面では氏名がメニューの中に
    // 畳まれていて、ログインできたことを確かめにくい。
    // 保存されるのは Cookie なので、どちらの幅から取っても同じ。
    { name: "setup", testMatch: /auth\.setup\.ts/ },

    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
      testIgnore: /(auth\.setup|mobile\.spec)\.ts/,
    },

    /**
     * 狭い画面。
     *
     * 全部を流し直しはしない。印影の保存や引き継ぎの申し出は、
     * 同じデータを広い画面のぶんと取り合ううえ、処理そのものは
     * 幅で変わらない。狭い画面で確かめたいのは配置と操作なので、
     * 読むだけの access と、狭い画面専用の mobile に絞る。
     */
    {
      name: "mobile",
      use: { ...devices["Pixel 7"] },
      dependencies: ["setup"],
      testMatch: /(access|mobile)\.spec\.ts/,
    },
  ],

  webServer: {
    // ビルドは scripts/e2e.sh が先に済ませている。ここでは起動だけ。
    // next build は tsconfig.json の include を書き換えるので、
    // 実行ファイル側で元に戻している。
    command: "NEXT_DIST_DIR=.next-e2e npx next start -p 3001",
    url: "http://127.0.0.1:3001/login",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
