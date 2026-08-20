/**
 * 通知の種類と、その表示名・説明。
 *
 * 通知設定のフォーム（Client Component）からも参照するため、
 * server-only な lib/notifications.ts とは分けている。
 * こちらにはサーバー専用の依存を持ち込まないこと。
 */

export type NotificationType =
  | "approval_result"
  | "request_received"
  | "board_post"
  | "new_event";

export type NotificationPreferences = Record<NotificationType, boolean>;

/** 設定画面に並べる順序 */
export const NOTIFICATION_TYPES: NotificationType[] = [
  "approval_result",
  "request_received",
  "board_post",
  "new_event",
];

export const TYPE_LABEL: Record<NotificationType, string> = {
  approval_result: "承認の結果",
  request_received: "自分への申請",
  board_post: "掲示板の新着",
  new_event: "新しいイベント",
};

export const TYPE_DESCRIPTION: Record<NotificationType, string> = {
  approval_result:
    "サークルへの参加、サークルの設立、施設の予約が承認・却下されたとき",
  request_received:
    "自分が管理するサークルへの参加申請や、担当する承認業務が発生したとき",
  board_post: "所属サークルの掲示板に新しい投稿があったとき",
  new_event: "所属サークルや自大学が新しいイベントを作成したとき",
};

export const TYPE_STYLE: Record<NotificationType, string> = {
  approval_result:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  request_received:
    "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  board_post:
    "bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
  new_event: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
};
