import "server-only";

import { cache } from "react";

import type {
  NotificationPreferences,
  NotificationType,
} from "@/lib/notification-types";
import { createClient } from "@/lib/supabase-server";

export type Notification = {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

/** 未読件数。ヘッダーのベルに出すので件数だけ取る。 */
export const getUnreadCount = cache(async (): Promise<number> => {
  const supabase = await createClient();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);
  return count ?? 0;
});

/** RLS により自分の通知しか取得できない */
export async function listNotifications(limit = 50) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("id, type, title, body, link, read_at, created_at")
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<Notification[]>();
  return data ?? [];
}

/**
 * 通知設定。
 * 行が無い場合はすべて受け取る扱い（DB 側の既定と揃えている）。
 */
export async function getPreferences(
  userId: string,
): Promise<NotificationPreferences> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("notification_preferences")
    .select("approval_result, request_received, board_post, new_event")
    .eq("user_id", userId)
    .maybeSingle();

  return {
    approval_result: data?.approval_result ?? true,
    request_received: data?.request_received ?? true,
    board_post: data?.board_post ?? true,
    new_event: data?.new_event ?? true,
  };
}
