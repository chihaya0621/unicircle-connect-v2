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

/**
 * 狭い画面のカレンダー用。件名を置く幅がないので、点の色だけで種別を示す。
 * SOURCE_COLOR と同じ色相の、面で塗れる濃さを選んでいる。
 */
export const SOURCE_DOT: Record<EventSource, string> = {
  joined: "bg-rose-500",
  "my-circle": "bg-indigo-500",
  "own-university": "bg-emerald-500",
  "unjoined-circle": "bg-sky-500",
  "other-university": "bg-amber-500",
};

/** 凡例に出す順序。既定表示の3種を先に並べる。 */
export const SOURCE_ORDER: EventSource[] = [
  "joined",
  "my-circle",
  "own-university",
  "unjoined-circle",
  "other-university",
];

/**
 * イベント一覧での閲覧者との関係。
 *
 * カレンダーの EventSource より粗い3段階。一覧は時系列で全部を見る場所で、
 * 絞り込みはカレンダーの役割なので、目立たせるかどうかだけを表す。
 */
export type EventRelation = "joined" | "my-circle" | "other";

export const RELATION_LABEL: Record<EventRelation, string | null> = {
  joined: "参加予定",
  "my-circle": "所属サークル",
  other: null,
};

/**
 * カードに乗せる色味。その他は色を付けない。
 *
 * 左端に帯を引く方法はよく使われるが、面積の割に情報が弱く、
 * どのカードも同じ形に見えてしまう。面全体をごく淡く染めて
 * 枠線をそろえる方が、バッジと合わせて読んだときに意味が通る。
 */
export const RELATION_ACCENT: Record<EventRelation, string> = {
  joined: "tint-rose",
  "my-circle": "tint-indigo",
  other: "",
};

export const RELATION_BADGE: Record<EventRelation, string> = {
  joined: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200",
  "my-circle":
    "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200",
  other: "",
};
