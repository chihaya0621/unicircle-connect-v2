import type { ApprovalEntry } from "@/lib/approvals";

const formatter = new Intl.DateTimeFormat("ja-JP", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Tokyo",
});

const TARGET_LABEL: Record<ApprovalEntry["target_type"], string> = {
  circle: "設立",
  circle_closure: "廃止",
  reservation: "予約",
};

/**
 * 誰がいつ承認・却下したかの記録。
 *
 * 紙の決裁で回覧の判を見返すのと同じ役割。判断した本人の名前を
 * 出すのは、承認が誰の責任で行われたかを申請側にも分かるようにするため。
 */
export function ApprovalLog({
  entries,
  title = "承認の記録",
}: {
  entries: ApprovalEntry[];
  title?: string;
}) {
  if (entries.length === 0) return null;

  return (
    <section className="mb-10 glass-panel">
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      <ol className="space-y-3">
        {entries.map((e) => (
          <li key={e.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span
              className={`badge ${
                e.decision === "approved"
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                  : "bg-rose-500/15 text-rose-700 dark:text-rose-300"
              }`}
            >
              {TARGET_LABEL[e.target_type]}を
              {e.decision === "approved" ? "承認" : "却下"}
            </span>
            <span className="text-sm font-medium">{e.approver_name}</span>
            <time
              dateTime={e.created_at}
              className="text-xs text-gray-500 dark:text-gray-400"
            >
              {formatter.format(new Date(e.created_at))}
            </time>
            {e.comment && (
              <p className="w-full text-sm text-gray-700 dark:text-gray-300">
                {e.comment}
              </p>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
