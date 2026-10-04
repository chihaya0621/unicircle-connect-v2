import type { Metadata } from "next";
import Link from "next/link";

import { PageHero } from "@/components/PageHero";
import { SponsorshipCard } from "@/components/SponsorshipCard";
import { getCurrentUser } from "@/lib/dal";
import { listOpenSponsorships } from "@/lib/sponsorship";

export const metadata: Metadata = { title: "協賛の募集 | UniCircle Connect" };

/**
 * 協賛の募集の一覧。企業が、支えたい活動を探す場所。
 *
 * 大学の職員が確かめた、募集中で締め切り前のものだけを並べる。
 * 見るだけならログインは要らない。申し込むには企業・一般のアカウントで入る。
 */
export default async function SponsorshipsPage() {
  const [user, sponsorships] = await Promise.all([
    getCurrentUser(),
    listOpenSponsorships(),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <PageHero
        variant="circles"
        eyebrow="SPONSORSHIP"
        title="協賛の募集"
        description={
          <>
            サークルが、遠征や発表会、機材の費用を支えてくれる企業を探しています。
            どれも大学の職員が中身を確かめて、判子を押した募集です。
            協賛すると、サークルのページに会社の名前が出ます。
          </>
        }
        action={
          !user ? (
            <Link href="/login?next=/sponsorships" className="btn-ghost py-2">
              ログインして申し込む
            </Link>
          ) : undefined
        }
      />

      {sponsorships.length === 0 ? (
        <p className="glass-empty py-12">
          いま募集中の協賛はありません。
          <Link href="/circles" className="mx-1 font-medium underline">
            サークル
          </Link>
          の活動から探すこともできます。
        </p>
      ) : (
        <>
          <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">
            {sponsorships.length}件。締め切りの近い順に並べています。
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {sponsorships.map((s) => (
              <SponsorshipCard
                key={s.id}
                sponsorship={s}
                href={`/sponsorships/${s.id}`}
                showCircle
                compact
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
