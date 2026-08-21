"use client";

import { useOptimistic, useState, useTransition } from "react";

import { setEventReminder } from "@/app/actions/events";
import { REMINDER_OPTIONS } from "@/lib/reminder-options";

/**
 * リマインドの時刻を選ぶ欄。参加登録しているときだけ出す。
 *
 * 選んだ瞬間に保存する。保存ボタンを置くと、押し忘れたまま
 * 「設定した」と思い込む人が出るため。応答を待たずに表示を
 * 切り替え、失敗したときは再描画で元の値に戻る。
 *
 * 戻るだけだと理由が分からないので、失敗はその場に書き出す。
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
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-2">
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
              setError(null);
              const data = new FormData();
              data.set("event_id", eventId);
              data.set("lead_minutes", raw);
              const result = await setEventReminder(data);
              if (result?.error) setError(result.error);
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

      {error && (
        <p
          role="alert"
          className="rounded-xl border border-rose-300/70 bg-rose-50/70 px-3 py-2 text-xs text-rose-800 dark:border-rose-800/60 dark:bg-rose-950/40 dark:text-rose-200"
        >
          {error}
        </p>
      )}
    </div>
  );
}
