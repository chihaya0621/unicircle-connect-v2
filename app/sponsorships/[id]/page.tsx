import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { BackLink } from "@/components/BackLink";
import { SponsorshipCard } from "@/components/SponsorshipCard";
import { SponsorshipOfferForm } from "@/components/SponsorshipOfferForm";
import { getCurrentUser } from "@/lib/dal";
import {
  getSponsorship,
  isAccepting,
  listCircleSponsors,
  listMyOffers,
  listOffers,
} from "@/lib/sponsorship";

// 題名と本文の両方で使うので、同じリクエストの中では1回だけ引く
const getCached = cache(getSponsorship);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const s = await getCached(id);
  return {
    title: s
      ? `${s.title}（協賛の募集） | UniCircle Connect`
      : "協賛の募集 | UniCircle Connect",
  };
}

/**
 * 協賛の募集を1件。企業はここで申し込む。
 *
 * 見えるかどうかは RLS が決める。確認待ちの募集は、サークルの
 * メンバーと大学の職員にしか見えず、それ以外の人には 404 になる。
 */
export default async function SponsorshipPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [s, user] = await Promise.all([getCached(id), getCurrentUser()]);
  if (!s) notFound();

  const isGeneral = user?.role === "general";
  const [sponsors, offersHere, myOffers] = await Promise.all([
    listCircleSponsors(s.circle_id),
    // 一般のアカウントには、RLS で自分の申し込みだけが返る
    isGeneral ? listOffers([s.id]) : Promise.resolve([]),
    isGeneral && user ? listMyOffers(user.id) : Promise.resolve([]),
  ]);
  const accepting = isAccepting(s);
  const university = s.circle?.university?.name;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <BackLink href="/sponsorships" label="協賛の募集" />

      <p className="mb-2 text-sm text-gray-600 dark:text-gray-400">
        <Link href={`/circles/${s.circle_id}`} className="font-medium underline">
          {s.circle?.name ?? "サークル"}
        </Link>
        {university && ` ／ ${university}`}
      </p>

      <SponsorshipCard sponsorship={s} />

      {sponsors.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-2 text-lg font-semibold">このサークルの協賛企業</h2>
          <ul className="flex flex-wrap gap-2">
            {sponsors.map((sp, i) => (
              <li
                key={`${sp.sponsor_name}-${i}`}
                className="rounded-full border border-black/10 px-3 py-1 text-sm dark:border-white/15"
              >
                {sp.sponsor_url ? (
                  <a href={sp.sponsor_url} target="_blank" rel="noreferrer noopener" className="underline">
                    {sp.sponsor_name}
                  </a>
                ) : (
                  sp.sponsor_name
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8 glass-panel">
        <h2 className="mb-3 text-lg font-semibold">協賛を申し込む</h2>
        {!user ? (
          <p className="text-sm text-gray-700 dark:text-gray-300">
            申し込むには、企業・一般のアカウントでログインしてください。
            <Link href={`/login?next=/sponsorships/${s.id}`} className="ml-1 font-medium underline">
              ログイン
            </Link>
          </p>
        ) : !isGeneral ? (
          <p className="text-sm text-gray-700 dark:text-gray-300">
            協賛を申し込めるのは、企業・一般のアカウントです。学生と職員のアカウントでは見るだけになります。
          </p>
        ) : accepting || offersHere.length > 0 ? (
          <>
            {!accepting && (
              <p className="mb-3 text-sm text-gray-700 dark:text-gray-300">
                この募集は受け付けを終えています。
              </p>
            )}
            <SponsorshipOfferForm
              requestId={s.id}
              circleId={s.circle_id}
              myOffers={offersHere}
              defaultName={myOffers[0]?.sponsor_name}
              accepting={accepting}
            />
          </>
        ) : (
          <p className="text-sm text-gray-700 dark:text-gray-300">
            この募集は受け付けを終えています。
          </p>
        )}
      </section>
    </div>
  );
}
