import { EmptySeal, Seal } from "@/components/Seal";
import type { ApprovalEntry, ChainCheck } from "@/lib/approvals";

const stamp = new Intl.DateTimeFormat("ja-JP", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Tokyo",
});

const TARGET_LABEL = {
  circle: "設立",
  circle_closure: "廃止",
  reservation: "予約",
} as const;

/** 何日そこで止まっているか。回覧板の日付欄がやっていること */
function daysSince(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

/**
 * 滞留の色。
 *
 * 数字だけだと「6日」が長いのか短いのかが読めない。
 * 紙の回覧板でも、古い書類は見れば分かるようになっている。
 */
function stallTone(days: number) {
  if (days >= 14) return "text-rose-700 dark:text-rose-300 font-semibold";
  if (days >= 7) return "text-amber-700 dark:text-amber-300 font-medium";
  return "text-gray-500 dark:text-gray-400";
}

/**
 * 承認のながれ。
 *
 * これまでは押された記録を並べるだけで、「いま何人目で止まっているか」
 * が読めなかった。紙の回覧板は、空の判子欄があることで残りが見える。
 * 同じように、まだ押されていない欄も描く。
 */
export function ApprovalTrail({
  entries,
  required,
  /** 申請が出た日時。止まっている日数の起点になる */
  requestedAt,
  /** すでに決着したか。決着していれば空欄は描かない */
  settled,
  title = "承認のながれ",
  check,
}: {
  entries: ApprovalEntry[];
  required: number;
  requestedAt?: string | null;
  settled: boolean;
  title?: string;
  /** 記録が書き換えられていないかの確認結果。null は確認できなかった */
  check?: ChainCheck | null;
}) {
  if (entries.length === 0 && settled) return null;

  const approved = entries.filter((e) => e.decision === "approved").length;
  const rejected = entries.some((e) => e.decision === "rejected");
  const remaining = Math.max(0, required - approved);

  // 止まっている起点は「最後に誰かが動かした時刻」。
  // 申請日からの通算にすると、昨日1人目が押した案件も長く見えてしまう。
  const lastMoved = entries.at(-1)?.created_at ?? requestedAt ?? null;
  const stalled = !settled && !rejected && lastMoved ? daysSince(lastMoved) : null;

  return (
    <section className="mb-10 glass-panel">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-lg font-semibold">{title}</h2>
        {check && (
          <p
            className={`text-xs ${
              check.ok
                ? "text-gray-500 dark:text-gray-400"
                : "font-semibold text-rose-700 dark:text-rose-300"
            }`}
          >
            {check.ok
              ? `記録${check.checked}件は押されたときのままです`
              : `記録が押されたときと違います（${check.checked}件目）`}
          </p>
        )}
      </div>

      <ol className="space-y-4">
        {entries.map((e) => (
          <li key={e.id} className="flex gap-4">
            <div className="pt-0.5">
              {e.decision === "approved" ? (
                // 印影を持たない古い記録もあるので、氏名から組んで穴を空けない
                <Seal
                  text={e.seal_text ?? [...e.approver_name].slice(0, 2).join("")}
                  shape={e.seal_shape}
                  size={44}
                />
              ) : (
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-rose-400 text-xs font-semibold text-rose-600 dark:text-rose-400"
                  aria-label="却下"
                >
                  却下
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                <span className="font-medium">{e.approver_name}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {TARGET_LABEL[e.target_type]}を
                  {e.decision === "approved" ? "承認" : "却下"}
                </span>
                <time
                  dateTime={e.created_at}
                  className="text-xs text-gray-500 dark:text-gray-400"
                >
                  {stamp.format(new Date(e.created_at))}
                </time>
              </p>
              {e.comment && (
                <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                  {e.comment}
                </p>
              )}
            </div>
          </li>
        ))}

        {/* まだ押されていない欄。残りが何人かは、これが無いと読めない */}
        {!settled &&
          !rejected &&
          Array.from({ length: remaining }, (_, i) => (
            <li key={`empty-${i}`} className="flex gap-4">
              <div className="pt-0.5 text-gray-400 dark:text-gray-600">
                <EmptySeal size={44} />
              </div>
              <div className="flex-1 self-center">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {i === 0 ? "つぎの承認待ち" : "承認待ち"}
                </p>
                {i === 0 && stalled !== null && stalled > 0 && (
                  <p className={`mt-0.5 text-xs ${stallTone(stalled)}`}>
                    {stalled}日 止まっています
                  </p>
                )}
              </div>
            </li>
          ))}
      </ol>

      {!settled && !rejected && (
        <p className="mt-4 border-t border-black/5 pt-3 text-xs text-gray-500 dark:border-white/10 dark:text-gray-400">
          承認 {approved} / {required}人。人数が揃って成立し、却下は1人で成立します。
        </p>
      )}
    </section>
  );
}
