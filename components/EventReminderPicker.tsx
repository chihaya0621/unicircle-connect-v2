"use client";

import { useOptimistic, useTransition } from "react";

import { setEventReminder } from "@/app/actions/events";
import { REMINDER_OPTIONS } from "@/lib/reminder-options";

/**
 * リマインドの時刻を選ぶ欄。参加登録しているときだけ出す。
 *
 * 選んだ瞬間に保存する。保存ボタンを置くと、押し忘れたまま
 * 「設定した」と思い込む人が出るため。応答を待たずに表示を
 * 切り替え、失敗したときは再描画で元の値に戻る。
 */
export function EventReminderPicker({
  eventId,
  leadMinutes,
}: {
  eventId: string;
  /** 未設定なら null */
  leadMinutes: number | null;
}) {
  const [optimistic, setOptimistic] = useOptimistic(leadMinutes);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label htmlFor="reminder" className="text-sm">
        リマインド
      </label>
      <select
        id="reminder"
        name="lead_minutes"
        value={optimistic ?? ""}
        disabled={pending}
        onChange={(e) => {
          const raw = e.target.value;
          startTransition(async () => {
            setOptimistic(raw === "" ? null : Number(raw));
            const data = new FormData();
            data.set("event_id", eventId);
            data.set("lead_minutes", raw);
            await setEventReminder(data);
          });
        }}
        className="field-input w-auto py-1.5 text-sm"
      >
        <option value="">通知しない</option>
        {REMINDER_OPTIONS.map((o) => (
          <option key={o.minutes} value={o.minutes}>
            {o.label}
          </option>
        ))}
      </select>
      <span
        className="text-xs text-gray-500 dark:text-gray-400"
        aria-live="polite"
      >
        {optimistic === null
          ? "開始前の通知は届きません"
          : "設定した時刻に通知が届きます"}
      </span>
    </div>
  );
}
