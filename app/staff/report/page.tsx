import type { Metadata } from "next";
import Link from "next/link";

import { BackLink } from "@/components/BackLink";
import { PageHero } from "@/components/PageHero";
import { getMyUniversityId, requireRole } from "@/lib/dal";
import {
  formatDays,
  getStaffReport,
  STUCK_DAYS,
  type KindSummary,
} from "@/lib/report";

export const metadata: Metadata = { title: "大学のレポート | UniCircle Connect" };

const stamp = new Intl.DateTimeFormat("ja-JP", {
  month: "numeric",
  day: "numeric",
  timeZone: "Asia/Tokyo",
});

/**
 * 職員のレポート。今年度の申請と、サークルの状況を1画面にまとめる。
 *
 * 大学が導入を決めるときに「紙の回覧よりどれだけ楽になったか」を、
 * 記録から数えた数字で見せる。数字は開いた時点のもの。
 */
export default async function StaffReportPage() {
  await requireRole("staff");
  const universityId = await getMyUniversityId();
  if (!universityId) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <p className="glass-empty py-12">所属大学が登録されていないため、レポートを出せません。</p>
      </div>
    );
  }

  const report = await getStaffReport(universityId);
  // 長い一覧は読まれないので、古い順に10件だけ並べ、残りは数で伝える
  const shownStuck = report.stuck.slice(0, 10);
  const restStuck = report.stuck.length - shownStuck.length;
  const totalReceived =
    report.setups.received + report.reservations.received + report.sponsorships.received;

  const rows: { label: string; summary: KindSummary }[] = [
    { label: "サークルの設立", summary: report.setups },
    { label: "施設の予約", summary: report.reservations },
    { label: "協賛の募集", summary: report.sponsorships },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <BackLink href="/staff" label="対応待ち" />
      <PageHero
        variant="arc"
        eyebrow="REPORT"
        title="大学のレポート"
        description={
          <>
            {report.termYear}年度（4月から）の申請と、サークルの状況です。
            承認の記録から、開いた時点の数を数えています。
          </>
        }
      />

      <section aria-labelledby="report-summary" className="mb-10">
        <h2 id="report-summary" className="sr-only">
          今年度のまとめ
        </h2>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="今年度に届いた申請"
            value={`${totalReceived}件`}
            note="設立・施設の予約・協賛の募集の合計"
          />
          <StatTile
            label="設立の判断までの日数"
            value={formatDays(report.setups.medianDays)}
            note="届いてから決まるまでの中央値"
          />
          <StatTile
            label={`${STUCK_DAYS}日以上止まっている申請`}
            value={`${report.stuck.length}件`}
            note={report.stuck.length > 0 ? "下に一覧があります" : "止まっている申請はありません"}
          />
          <StatTile
            label="今年度に代替わりしたサークル"
            value={`${report.handedOver} / ${report.activeCircles}`}
            note="活動中のサークルのうち"
          />
        </dl>
      </section>

      <section className="mb-10">
        <h2 className="mb-1 text-lg font-semibold">申請の内訳</h2>
        <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">
          届いた件数と決まった件数は今年度のもの。対応中は、年度をまたいで残っているものも数えます。
        </p>
        <div className="overflow-x-auto rounded-2xl border border-black/10 dark:border-white/15">
          <table className="w-full min-w-[34rem] text-sm">
            <thead className="bg-black/[0.03] text-left text-gray-600 dark:bg-white/5 dark:text-gray-400">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-medium">種類</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">届いた</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">決まった</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">対応中</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">判断までの日数（中央値）</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5 tabular-nums dark:divide-white/10">
              {rows.map(({ label, summary }) => (
                <tr key={label}>
                  <th scope="row" className="px-4 py-2.5 text-left font-medium">{label}</th>
                  <td className="px-4 py-2.5 text-right">{summary.received}</td>
                  <td className="px-4 py-2.5 text-right">{summary.decided}</td>
                  <td className="px-4 py-2.5 text-right">{summary.pending}</td>
                  <td className="px-4 py-2.5 text-right">{formatDays(summary.medianDays)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="mb-1 text-lg font-semibold">
          {STUCK_DAYS}日以上止まっている申請（{report.stuck.length}件）
        </h2>
        {report.stuck.length === 0 ? (
          <p className="glass-empty py-6">止まっている申請はありません。</p>
        ) : (
          <>
            <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">
              届いた日の古い順に10件まで並べています。紙の回覧では、どこで止まっているかが見えませんでした。
            </p>
            <ul className="divide-y divide-black/5 rounded-2xl border border-black/10 dark:divide-white/10 dark:border-white/15">
              {shownStuck.map((item) => (
                <li
                  key={`${item.kind}-${item.name}-${item.since}`}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm"
                >
                  <span className="badge shrink-0 px-2.5 py-0.5 text-xs">{item.kind}</span>
                  <Link href={item.href} className="min-w-0 flex-1 font-medium hover:underline">
                    {item.name}
                  </Link>
                  <span className="shrink-0 text-gray-600 tabular-nums dark:text-gray-400">
                    {stamp.format(new Date(item.since))}に届いて{item.waitingDays}日
                  </span>
                </li>
              ))}
            </ul>
            {restStuck > 0 && (
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                ほか{restStuck}件あります。施設の予約は
                <Link href="/reservations" className="mx-1 font-medium underline">
                  予約の承認
                </Link>
                でまとめて判断できます。
              </p>
            )}
          </>
        )}
      </section>
    </div>
  );
}

/** 数字のタイル。ラベル・値・補足の3つ */
function StatTile({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="glass-card p-4">
      <dt className="text-sm text-gray-600 dark:text-gray-400">{label}</dt>
      <dd className="mt-1 text-3xl font-semibold tracking-tight">{value}</dd>
      <dd className="mt-1 text-xs text-gray-600 dark:text-gray-400">{note}</dd>
    </div>
  );
}
