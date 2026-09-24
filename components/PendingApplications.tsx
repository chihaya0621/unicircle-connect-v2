import Link from "next/link";

import { decideCircle, decideClosure } from "@/app/actions/circles";
import { DecisionForm } from "@/components/DecisionForm";
import { SealSlots } from "@/components/SealSlots";
import type { ApprovalEntry } from "@/lib/approvals";
import type { CircleListItem } from "@/lib/circles";

type Kind = "setup" | "closure";

/**
 * 職員の承認待ちの一覧。設立と廃止で共通。
 *
 * 1件ごとに押印欄を出し、申請書へ行けるようにする。以前は名前と
 * 「承認 1 / 2人」だけで、申請の中身も、誰が押したのかも見られなかった。
 */
export function PendingApplications({
  kind,
  circles,
  approvals,
  required,
  viewerId,
}: {
  kind: Kind;
  circles: CircleListItem[];
  /** 対象ごとの承認の記録（listApprovalsByTarget） */
  approvals: Map<string, ApprovalEntry[]>;
  required: number;
  viewerId: string;
}) {
  return (
    <ul className="space-y-3">
      {circles.map((circle) => {
        const entries = approvals.get(circle.id) ?? [];
        const approved = entries.filter((e) => e.decision === "approved");
        const mine = entries.some((e) => e.approver_id === viewerId);
        const paper = `/circles/${circle.id}/print`;

        return (
          <li key={circle.id} className="glass-card tint-amber p-4">
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
              <div className="min-w-0">
                <p className="font-medium">
                  <Link href={paper} className="hover:underline">
                    {circle.name}
                  </Link>
                </p>
                {circle.description && (
                  <p className="mt-1 line-clamp-2 text-sm text-gray-600 dark:text-gray-400">
                    {circle.description}
                  </p>
                )}
              </div>
              <Link href={paper} className="btn-ghost-sm shrink-0">
                申請書を見る
              </Link>
            </div>

            <div className="mt-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
              <SealSlots approved={approved} required={required} />
              {mine ? (
                <MyApprovalNote
                  remaining={required - approved.length}
                  className="max-w-xs"
                />
              ) : (
                <DecisionButtons kind={kind} circleId={circle.id} />
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * 承認・却下のボタンと所見の欄。一覧と申請書の両方に置く。
 *
 * 申請書を読んでから一覧に戻って押すのは遠回りなので、
 * 読んだその場で押せるようにしている。
 */
export function DecisionButtons({
  kind,
  circleId,
}: {
  kind: Kind;
  circleId: string;
}) {
  return (
    <DecisionForm
      action={kind === "setup" ? decideCircle : decideClosure}
      className="flex flex-wrap items-center gap-2"
    >
      <input type="hidden" name="circle_id" value={circleId} />
      <input
        name="comment"
        maxLength={200}
        placeholder="所見（任意）"
        aria-label="所見（任意）"
        className="field-input w-full sm:w-56"
      />
      <button
        type="submit"
        name="approve"
        value="true"
        className={
          kind === "setup"
            ? "btn-primary tap-target px-3 py-1.5 text-xs"
            : "btn-danger-sm"
        }
      >
        {kind === "setup" ? "承認する" : "廃止を承認する"}
      </button>
      <button type="submit" name="approve" value="false" className="btn-ghost-sm">
        却下する
      </button>
    </DecisionForm>
  );
}

/**
 * 自分がもう承認した案件に、ボタンの代わりに出す一言。
 *
 * 同じ職員は二度押せない。成立には、ほかの職員の承認が要ることを伝える。
 * 必要な人数が途中で減ると差が0以下になるが、その場合も次の1人の承認で
 * 成立するので「あと1人」と出す。
 */
export function MyApprovalNote({
  remaining,
  className = "",
}: {
  remaining: number;
  className?: string;
}) {
  return (
    <p className={`text-sm text-gray-700 dark:text-gray-300 ${className}`}>
      <span className="font-semibold">承認済みです。</span>
      あと{Math.max(1, remaining)}人、ほかの職員が承認すると成立します。
    </p>
  );
}
