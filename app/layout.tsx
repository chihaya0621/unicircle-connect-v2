import type { Metadata } from "next";
import { Geist, Geist_Mono, M_PLUS_2 } from "next/font/google";
import "./globals.css";

import { Header } from "@/components/Header";
import { getTheme } from "@/lib/dal";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * 日本語の書体。
 *
 * これまで日本語には Web フォントが当たっておらず、OS 任せだった
 * （Geist は欧文しか持たない）。画面のほとんどが日本語なので、
 * ここを決めないと「フォントを指定している」ことにならない。
 *
 * 欧文は Geist のまま前に置き、日本語だけこちらに落とす。
 * 和文書体の欧文を使うより字面が締まり、追加の読み込みも増えない。
 *
 * M PLUS 2 は骨格が幾何学的で、字面が大きく詰まって見える。
 * 太いウェイトでも潰れにくいので、pop テーマの見出しと相性がよい。
 *
 * ウェイトは 400 / 700 / 900 の3つに絞っている。日本語フォントは
 * 1ウェイトあたり約1MB・121ファイルに分割されて配信されるため、
 * 増やすほどビルドが重くなる。500（font-medium）は 400 に寄せた。
 */
const mplus = M_PLUS_2({
  variable: "--font-jp",
  subsets: ["latin"],
  weight: ["400", "700", "900"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "UniCircle Connect",
  description:
    "大学のサークル活動・イベント告知・施設予約をひとつにするプラットフォーム",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // サーバー側でテーマを決めるので、切り替え時にちらつかない
  const theme = await getTheme();

  return (
    <html
      lang="ja"
      data-theme={theme}
      className={`${geistSans.variable} ${geistMono.variable} ${mplus.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Header />
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
