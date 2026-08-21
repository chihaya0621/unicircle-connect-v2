import Link from "next/link";

import { HomeHero } from "@/components/HomeHero";
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
      <HomeHero
        action={
          <>
            <Link
              href={user ? "/calendar" : "/signup"}
              className="btn-primary px-5"
            >
              {user ? "カレンダーを見る" : "はじめる"}
            </Link>
            <Link href="/events" className="btn-ghost px-5">
              公開イベントを見る
            </Link>
          </>
        }
      />

      <section className="mt-20 grid gap-4 sm:grid-cols-3">
        {FEATURES.map((feature) => (
          <div key={feature.title} className="glass-panel">
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
