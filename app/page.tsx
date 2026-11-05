import Link from "next/link";

import { HomeHero } from "@/components/HomeHero";
import { getCurrentUser } from "@/lib/dal";
import { IS_DEMO } from "@/lib/dev-users";

/** 立場ごとに、よく使う画面を1つずつ。どれも今のアプリにある機能だけを書く */
const FEATURES = [
  {
    title: "わたしのサークル",
    body: "所属するサークルの次の予定と最新の連絡、返事が要るものが1画面に並びます。",
  },
  {
    title: "承認と判子",
    body: "職員は申請書を読み、その場で自分の判子を押します。要る人数は大学ごとに決められます。",
  },
  {
    title: "施設使用許可願",
    body: "窓口の様式と同じ項目で、施設の使用を申請できます。大学ごとの欄は職員が足せます。",
  },
  {
    title: "協賛",
    body: "職員が確かめて判子を押した募集にだけ、企業が協賛を申し込めます。",
  },
];

export default async function Home() {
  const user = await getCurrentUser();

  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <HomeHero
        action={
          user ? (
            <>
              {user.role === "student" ? (
                <Link href="/home" className="btn-primary px-5">
                  わたしのサークルを見る
                </Link>
              ) : (
                <Link href="/calendar" className="btn-primary px-5">
                  カレンダーを見る
                </Link>
              )}
              <Link href="/events" className="btn-ghost px-5">
                公開イベントを見る
              </Link>
            </>
          ) : (
            // 「はじめる」だと登録が要るのか分からない。見るだけなら
            // 登録は要らないので、探す入口を先に置き、登録は後ろに回す
            <>
              <Link href="/circles" className="btn-primary px-5">
                サークルを探す
              </Link>
              <Link href="/events" className="btn-ghost px-5">
                公開イベントを見る
              </Link>
              <p className="basis-full text-sm text-gray-600 dark:text-gray-400">
                見るだけなら登録は要りません。
                {IS_DEMO ? (
                  <>
                    学生や職員の画面は、
                    <Link href="/login" className="font-semibold underline">
                      デモ用アカウント
                    </Link>
                    で登録なしに試せます。
                  </>
                ) : (
                  <>
                    学生・職員の方は
                    <Link href="/signup" className="font-semibold underline">
                      アカウントを作成
                    </Link>
                    してください。
                  </>
                )}
              </p>
            </>
          )
        }
      />

      {/* 同じ形のカードを横に4枚並べると、どの製品のトップにもある絵になる。
          読むための短い説明なので、罫で区切った一覧にする */}
      <section className="mt-20 border-t border-black/10 dark:border-white/15">
        <dl className="grid sm:grid-cols-2">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="border-b border-black/10 py-5 sm:odd:pr-8 sm:even:pl-8 dark:border-white/15"
            >
              <dt className="font-semibold">{feature.title}</dt>
              <dd className="mt-1.5 text-sm text-gray-600 dark:text-gray-400">
                {feature.body}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
