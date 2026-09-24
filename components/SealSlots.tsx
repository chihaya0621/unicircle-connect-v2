import { EmptySeal, Seal } from "@/components/Seal";
import type { ApprovalEntry } from "@/lib/approvals";

/**
 * 押印欄。押された印影と、まだ押されていない空の欄を横に並べる。
 *
 * 承認待ちの一覧には「承認 1 / 2人」という数字しか無く、この仕組みの
 * 核心である印影が、職員が毎日見る場所に1つも出ていなかった。
 * 紙の回覧と同じく、空の欄の数で「あと何人か」が見て分かるようにする。
 */
export function SealSlots({
  approved,
  required,
  size = 40,
}: {
  /** 承認した記録。却下はここに来る前に決着しているので含めない */
  approved: ApprovalEntry[];
  required: number;
  size?: number;
}) {
  // 承認待ちのあいだは、必ず1つは空の欄がある。必要な人数が途中で
  // 減って差が0以下になっても、次の1人の承認で成立するので1つ描く
  const remaining = Math.max(1, required - approved.length);

  return (
    <div>
      <ol
        className="flex flex-wrap items-start gap-2"
        aria-label={`押印欄。${approved.length}人が承認、あと${remaining}人`}
      >
        {approved.map((e) => (
          <li
            key={e.id}
            className="flex w-20 flex-col items-center gap-1"
          >
            {/* 印影を持たない古い記録もあるので、氏名から組んで穴を空けない */}
            <Seal
              text={e.seal_text ?? [...e.approver_name].slice(0, 2).join("")}
              shape={e.seal_shape}
              size={size}
            />
            <span className="w-full truncate text-center text-[11px] text-gray-600 dark:text-gray-400">
              {e.approver_name}
            </span>
          </li>
        ))}
        {Array.from({ length: remaining }, (_, i) => (
          <li
            key={`empty-${i}`}
            className="flex w-20 flex-col items-center gap-1 text-gray-500 dark:text-gray-400"
          >
            <EmptySeal size={size} />
            <span className="text-[11px]">未押印</span>
          </li>
        ))}
      </ol>
      <p className="mt-1.5 text-xs text-gray-600 dark:text-gray-400">
        承認 {approved.length} / {required}人
        <span className="mx-1.5" aria-hidden>
          ・
        </span>
        <span className="font-semibold text-gray-800 dark:text-gray-200">
          あと{remaining}人
        </span>
      </p>
    </div>
  );
}
