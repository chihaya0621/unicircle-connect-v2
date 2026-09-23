import type { Metadata } from "next";
import { Geist, Geist_Mono, M_PLUS_2 } from "next/font/google";
import "./globals.css";

import { Header } from "@/components/Header";
import { ModeSwitcher } from "@/components/ModeSwitcher";
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

/**
 * 明るい・暗いを、描画の前に決めるスクリプト。
 *
 * 利用者の選択（端末に合わせる／明るい／暗い）はこの端末の localStorage に
 * あり、サーバーからは見えない。サーバーで決めると一瞬ちがう色で描かれるので、
 * HTML を読んでいる途中に同期で走らせ、html に data-scheme を付ける。
 * 「端末に合わせる」のときは、端末の設定が変わったら追いかける。
 * 値の読み書きは components/ModeSwitcher.tsx と揃えること。
 */
const SCHEME_SCRIPT = `(function(){try{
var d=document.documentElement,q=matchMedia("(prefers-color-scheme: dark)");
function m(){try{return localStorage.getItem("uc-mode")}catch(e){return null}}
function a(){var v=m();d.dataset.scheme=v==="dark"||(v!=="light"&&q.matches)?"dark":"light"}
a();q.addEventListener("change",a);
}catch(e){}})()`;

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
      // data-scheme は下のスクリプトが付ける。サーバーの出力と食い違うのは想定どおり
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${mplus.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCHEME_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        <Header />
        <main className="flex-1">{children}</main>
        {/* 明るさは未ログインの人も選べるよう、全画面の末尾に置く */}
        <footer className="mx-auto mt-12 flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-4 pb-8 text-xs text-gray-600 print:hidden dark:text-gray-400">
          <span>UniCircle Connect</span>
          <ModeSwitcher compact />
        </footer>
      </body>
    </html>
  );
}
