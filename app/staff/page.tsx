import type { Metadata } from "next";
import Link from "next/link";

import { PageHero } from "@/components/PageHero";
import { PendingApplications } from "@/components/PendingApplications";
import {
  getRequiredApprovals,
  listApprovalsByTarget,
} from "@/lib/approvals";
import { listClosureRequests, listPendingCircles } from "@/lib/circles";
import { getMyUniversityId, requireRole } from "@/lib/dal";
import { getPendingCounts } from "@/lib/pending";

export const metadata: Metadata = { title: "対応待ち | UniCircle Connect" };

/**
 * 職員の対応待ち。ログインした職員の着地点。
 *
 * 以前はカレンダーに着地していて、職員には「参加予定のイベントは
 * ありません」と出るだけだった。承認の字は1つも無く、申請は
 * メニューの奥のサークル一覧で、ほかの一覧と混ざっていた。
 * 職員の毎日の仕事は承認なので、押すものを最初に並べる。
 */
export default async function StaffInboxPage() {
  const user = await requireRole("staff");
  const universityId = await getMyUniversityId();

  const [setups, closures, required, counts] = await Promise.all([
    listPendingCircles(user.id),
    listClosureRequests(universityId),
    getRequiredApprovals(universityId),
    getPendingCounts(user.id, user.role),
  ]);
  const [setupSeals, closureSeals] = await Promise.all([
    listApprovalsByTarget(
      "circle",
      setups.map((c) => c.id),
    ),
    listApprovalsByTarget(
      "circle_closure",
      closures.map((c) => c.id),
    ),
  ]);

  const mine = counts.circles + counts.closures + counts.reservations;
  const nothing =
    setups.length === 0 && closures.length === 0 && counts.reservations === 0;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <PageHero
        variant="arc"
        eyebrow="PENDING"
        title="対応待ち"
        description={
          nothing ? (
            <>いま対応を待っているものはありません。</>
          ) : mine > 0 ? (
            <>あなたの承認を待っているものが{mine}件あります。</>
          ) : (
            <>あなたが押せるものは済んでいます。あとは、ほかの職員の承認待ちです。</>
          )
        }
      />

      {nothing && (
        <p className="glass-empty py-12">
          新しい申請が届くと、ここに並びます。
          <Link href="/calendar" className="mx-1 font-medium underline">
            カレンダー
          </Link>
          で大学の予定も見られます。
        </p>
      )}

      {setups.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-1 text-lg font-semibold">
            サークルの設立申請（{setups.length}件）
          </h2>
          <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">
            承認は{required}人揃って成立し、却下は1人で成立します。
            申請書を開くと、中身を読んだその場で押せます。
          </p>
          <PendingApplications
            kind="setup"
            circles={setups}
            approvals={setupSeals}
            required={required}
            viewerId={user.id}
          />
        </section>
      )}

      {closures.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-1 text-lg font-semibold">
            サークルの廃止申請（{closures.length}件）
          </h2>
          <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">
            廃止も、承認は{required}人揃って成立します。
          </p>
          <PendingApplications
            kind="closure"
            circles={closures}
            approvals={closureSeals}
            required={required}
            viewerId={user.id}
          />
        </section>
      )}

      {counts.reservations > 0 && (
        <section className="mb-10">
          <h2 className="mb-1 text-lg font-semibold">
            施設の予約申請（{counts.reservations}件）
          </h2>
          <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">
            予約は1人の承認で決まります。まとめて承認することもできます。
          </p>
          <Link href="/reservations" className="btn-primary px-5">
            予約の承認へ
          </Link>
        </section>
      )}
    </div>
  );
}
