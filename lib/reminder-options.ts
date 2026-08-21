/**
 * リマインドの時刻の選択肢。
 *
 * Client Component（選択欄）からも参照するため、server-only な
 * モジュールとは分けている。ここにサーバー専用の依存を持ち込まないこと。
 *
 * 値は「開始の何分前か」。DB 側は 5分〜1週間の範囲であれば何でも
 * 受け付けるので、選択肢を増やしたいときはこの配列だけを触れば足りる。
 */
export type ReminderOption = { minutes: number; label: string };

export const REMINDER_OPTIONS: ReminderOption[] = [
  { minutes: 30, label: "30分前" },
  { minutes: 60, label: "1時間前" },
  { minutes: 180, label: "3時間前" },
  { minutes: 360, label: "6時間前" },
  { minutes: 1440, label: "前日の同じ時刻" },
  { minutes: 4320, label: "3日前" },
  { minutes: 10080, label: "1週間前" },
];

export function reminderLabel(minutes: number | null): string {
  if (minutes === null) return "通知しない";
  return (
    REMINDER_OPTIONS.find((o) => o.minutes === minutes)?.label ??
    `${minutes}分前`
  );
}
