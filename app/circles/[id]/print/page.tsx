import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PrintButton } from "@/components/PrintButton";
import { EmptySeal, Seal } from "@/components/Seal";
import {
  getRequiredApprovals,
  listCircleApprovals,
  verifyApprovalChain,
} from "@/lib/approvals";
import { getCircle, getMyMembership, listMembers } from "@/lib/circles";
import { getCurrentUser } from "@/lib/dal";

export const metadata: Metadata = { title: "申請書 | UniCircle Connect" };

const dateOnly = new Intl.DateTimeFormat("ja-JP", {
  dateStyle: "long",
  timeZone: "Asia/Tokyo",
});

/**
 * 申請書を紙の体裁で出す。
 *
 * 大学の実務では、承認された申請は紙で保管される。画面をそのまま
 * 印刷したものではなく、申請書として成立する紙が出ないと使えない。
 * デジタル化したものを、必要なときに紙へ戻すための導線。
 *
 * 画面のアプリらしさ（すりガラス、影、色面）はすべて落とし、
 * 罫線と余白だけで組む。紙の上で色面は読みにくく、
 * 学内のモノクロ機で刷られることも多い。
 */
export default async function CirclePrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const circle = await getCircle(id);
  if (!circle) notFound();

  // 申請書は内部の書類なので、関係者と職員だけに出す
  const user = await getCurrentUser();
  if (!user || user.role === "general") notFound();
  const membership = await getMyMembership(id, user.id);
  if (!membership && user.role !== "staff") notFound();

  const isClosure = Boolean(circle.closure_requested_at);
  const targetType = isClosure ? "circle_closure" : "circle";

  const [members, approvals, required, check] = await Promise.all([
    listMembers(id),
    listCircleApprovals(id),
    getRequiredApprovals(circle.university_id),
    verifyApprovalChain(targetType, id),
  ]);

  const relevant = approvals.filter((a) => a.target_type === targetType);
  const admins = members.filter(
    (m) => m.role === "admin" && m.status === "active",
  );
  const activeCount = members.filter((m) => m.status === "active").length;

  // 空の判子欄も描く。紙の決裁は、空欄があるから残りが分かる
  const blanks = Math.max(0, required - relevant.length);

  // 受付番号は UUID の頭8桁。窓口で照合するとき、
  // 36字を読み上げるのは現実的でない
  const receiptNo = id.slice(0, 8).toUpperCase();
  const requestedAt = circle.closure_requested_at ?? circle.created_at;

  return (
    <div className="mx-auto max-w-[210mm] px-4 py-8 print:p-0">
      {/* 画面にだけ出る操作。紙には出さない */}
      <div className="mb-6 flex flex-wrap items-center gap-3 print:hidden">
        <PrintButton />
        <Link href={`/circles/${id}`} className="btn-ghost px-4 py-2 text-sm">
          サークルに戻る
        </Link>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          用紙 A4 ／ 余白は既定のまま ／ 背景のグラフィックは不要です。
        </p>
      </div>

      <article className="paper">
        <header className="paper-head">
          <p className="paper-meta">
            {circle.university?.name ?? "大学名未設定"}
          </p>
          <h1 className="paper-title">
            サークル{isClosure ? "廃止" : "設立"}申請書
          </h1>
          <dl className="paper-receipt">
            <dt>受付番号</dt>
            <dd>{receiptNo}</dd>
            <dt>申請日</dt>
            <dd>{dateOnly.format(new Date(requestedAt))}</dd>
            <dt>年度</dt>
            <dd>{circle.term_year ?? "—"}</dd>
          </dl>
        </header>

        <table className="paper-table">
          <tbody>
            <tr>
              <th>名称</th>
              <td>{circle.name}</td>
            </tr>
            <tr>
              <th>代表者</th>
              <td>
                {admins.length > 0
                  ? admins.map((m) => m.user?.name ?? "名前未設定").join("、")
                  : "—"}
              </td>
            </tr>
            <tr>
              <th>構成員数</th>
              <td>{activeCount}名</td>
            </tr>
            <tr>
              <th>活動拠点</th>
              <td>{circle.campus?.name ?? "—"}</td>
            </tr>
            <tr>
              <th>公開範囲</th>
              <td>
                {circle.scope === "university"
                  ? "自大学のみ"
                  : circle.scope === "scoped"
                    ? `指定大学（${circle.scoped_universities.length}校）`
                    : "全公開"}
              </td>
            </tr>
            <tr>
              <th>活動内容</th>
              <td className="paper-body">{circle.description ?? "—"}</td>
            </tr>
          </tbody>
        </table>

        <section className="paper-approvals">
          <h2 className="paper-subtitle">
            承認欄（必要{required}名）
          </h2>
          <div className="paper-seals">
            {relevant.map((a) => (
              <div key={a.id} className="paper-seal">
                <div className="paper-seal-box">
                  {a.decision === "approved" ? (
                    <Seal text={a.seal_text} shape={a.seal_shape} size={54} />
                  ) : (
                    <span className="paper-rejected">却下</span>
                  )}
                </div>
                <p className="paper-seal-name">{a.approver_name}</p>
                <p className="paper-seal-date">
                  {dateOnly.format(new Date(a.created_at))}
                </p>
              </div>
            ))}
            {Array.from({ length: blanks }, (_, i) => (
              <div key={`blank-${i}`} className="paper-seal">
                <div className="paper-seal-box">
                  <EmptySeal size={54} />
                </div>
                <p className="paper-seal-name">&nbsp;</p>
                <p className="paper-seal-date">&nbsp;</p>
              </div>
            ))}
          </div>

          {relevant.some((a) => a.comment) && (
            <dl className="paper-comments">
              {relevant
                .filter((a) => a.comment)
                .map((a) => (
                  <div key={a.id}>
                    <dt>{a.approver_name}</dt>
                    <dd>{a.comment}</dd>
                  </div>
                ))}
            </dl>
          )}
        </section>

        <footer className="paper-foot">
          <p>
            この用紙は UniCircle Connect から出力したものです。
            承認の記録は押された時点で固定され、あとから書き換えると
            検証で分かるようになっています。
          </p>
          {check && (
            <p className="paper-verify">
              検証：
              {check.ok
                ? `記録${check.checked}件は押されたときのままです`
                : `記録が押されたときと異なります（${check.checked}件目）`}
              {relevant.at(-1)?.created_at && (
                <> ／ 照合値 {relevant.at(-1)?.id.slice(0, 8).toUpperCase()}</>
              )}
            </p>
          )}
        </footer>
      </article>
    </div>
  );
}
