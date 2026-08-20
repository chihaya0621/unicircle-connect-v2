/**
 * カレンダー上の「そのイベントが表示されている理由」と、その見た目。
 *
 * Client Component（凡例・絞り込みパネル）からも参照するため、
 * server-only な lib/calendar.ts とは分けている。
 * こちらにはサーバー専用の依存を持ち込まないこと。
 */

export type EventSource =
  | "joined" //           参加確定している
  | "my-circle" //        所属サークル主催
  | "own-university" //   自大学主催
  | "unjoined-circle" //  自大学の未所属サークル主催（設定で表示）
  | "other-university"; // 他大学主催（チェックした大学のみ）

export const SOURCE_LABEL: Record<EventSource, string> = {
  joined: "参加予定",
  "my-circle": "所属サークル",
  "own-university": "自大学",
  "unjoined-circle": "学内サークル",
  "other-university": "他大学",
};

/** カレンダーの色分け。凡例と同じ配色を使う。 */
export const SOURCE_COLOR: Record<EventSource, string> = {
  joined: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200",
  "my-circle":
    "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200",
  "own-university":
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  "unjoined-circle":
    "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
  "other-university":
    "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
};

/** 凡例に出す順序。既定表示の3種を先に並べる。 */
export const SOURCE_ORDER: EventSource[] = [
  "joined",
  "my-circle",
  "own-university",
  "unjoined-circle",
  "other-university",
];
