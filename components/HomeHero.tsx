import type { ReactNode } from "react";

import { EmptySeal, Seal } from "@/components/Seal";

/**
 * トップページのヒーロー。
 *
 * 左に何のアプリかを書き、右にこのアプリで扱う申請書の図を置く。
 *
 * 以前は右に「抽象アイコンを線で結び、信号が流れる網」を置き、
 * 製品名も文字が散らばって集まる虹色のグラデーションにしていた。
 * どの製品のトップにも置ける絵で、何のアプリなのかは何も伝えていなかった。
 * このアプリにしか無いもの――判子の押された申請書――をそのまま見せる。
 *
 * 書き込み欄は空のままにする。ここはまだ何も知らない人が見る場所なので、
 * 架空のサークル名を書くと、実在の団体と取り違えられる。
 */

/** 申請書の記入欄。値は書かず、罫だけ引く */
const FIELDS = ["サークル名", "代表者", "活動内容", "活動場所"];

/**
 * 承認欄。紙の決裁欄と同じく、上の役職を左に置き、右の担当から押していく。
 * 一番上の欄は空けて「あと1人」を見せる
 */
const APPROVERS: { title: string; seal: string | null }[] = [
  { title: "部長", seal: null },
  { title: "課長", seal: "高橋" },
  { title: "担当", seal: "鈴木" },
];

function FormSample() {
  return (
    <figure
      className="mx-auto w-full max-w-sm border border-gray-300 bg-white p-5 text-gray-900 shadow-sm sm:p-6"
      aria-hidden
    >
      <div className="flex justify-between text-[11px] text-gray-500">
        <span>様式第1号</span>
        <span>　　年　　月　　日</span>
      </div>

      <p className="mt-4 text-center text-base font-bold tracking-[0.3em]">
        サークル設立申請書
      </p>

      <dl className="mt-5 border-t border-gray-300 text-xs">
        {FIELDS.map((label) => (
          <div
            key={label}
            className="grid grid-cols-[5.5rem_1fr] border-b border-gray-300"
          >
            <dt className="border-r border-gray-300 bg-gray-50 px-2 py-2.5 text-gray-600">
              {label}
            </dt>
            <dd />
          </div>
        ))}
      </dl>

      <div className="mt-5 flex justify-end">
        <table className="border-collapse text-center text-[11px]">
          <thead>
            <tr>
              {APPROVERS.map((a) => (
                <th
                  key={a.title}
                  className="w-16 border border-gray-300 bg-gray-50 py-1 font-normal text-gray-600"
                >
                  {a.title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {APPROVERS.map((a) => (
                <td
                  key={a.title}
                  className="h-16 border border-gray-300 align-middle"
                >
                  <span className="grid place-items-center">
                    {a.seal ? (
                      <Seal text={a.seal} size={40} />
                    ) : (
                      <span className="text-gray-500">
                        <EmptySeal size={40} />
                      </span>
                    )}
                  </span>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </figure>
  );
}

export function HomeHero({ action }: { action: ReactNode }) {
  return (
    <section className="grid items-center gap-12 md:grid-cols-[1.1fr_0.9fr]">
      <div className="min-w-0">
        <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">
          大学のサークルのための Web アプリ
        </p>

        <h1 className="text-5xl font-black leading-tight tracking-tight sm:text-6xl">
          UniCircle Connect
        </h1>

        <p className="mt-6 max-w-xl text-lg text-gray-700 dark:text-gray-300">
          学生はサークルの申請と部内の連絡に、大学の職員は判子での承認に、企業や高校生はサークル探しと協賛に使えます。
        </p>

        <div className="mt-8 flex flex-wrap gap-3">{action}</div>
      </div>

      <FormSample />
    </section>
  );
}
