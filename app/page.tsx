import Link from "next/link";

import { getCurrentUser } from "@/lib/dal";

const FEATURES = [
  {
    title: "サークル",
    body: "設立申請から承認、メンバー管理までをひとつの画面で。",
  },
  {
    title: "イベント",
    body: "大学公式・サークル主催の告知を、対象学年や公開範囲つきで発信。",
  },
  {
    title: "施設予約",
    body: "教室・備品の空き状況を確認して、そのまま予約申請。",
  },
];

export default async function Home() {
  const user = await getCurrentUser();

  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <section className="max-w-2xl">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          大学生活の「つながる」を、
          <br />
          ひとつの場所に。
        </h1>
        <p className="mt-5 text-lg text-gray-600 dark:text-gray-400">
          UniCircle Connect
          は、サークル活動の管理・イベントの告知・大学施設の予約をシームレスにつなぐプラットフォームです。
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href={user ? "/dashboard" : "/signup"}
            className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500"
          >
            {user ? "ダッシュボードへ" : "はじめる"}
          </Link>
          <Link
            href="/events"
            className="rounded-lg border border-black/15 px-5 py-2.5 text-sm font-semibold transition hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
          >
            公開イベントを見る
          </Link>
        </div>
      </section>

      <section className="mt-16 grid gap-4 sm:grid-cols-3">
        {FEATURES.map((feature) => (
          <div
            key={feature.title}
            className="rounded-xl border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-white/5"
          >
            <h2 className="font-semibold">{feature.title}</h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              {feature.body}
            </p>
          </div>
        ))}
      </section>
    </div>
  );
}
