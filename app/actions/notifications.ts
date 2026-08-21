"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/dal";
import { createClient } from "@/lib/supabase-server";

export type ActionState = { error?: string; notice?: string } | null;

/** 既読にする。id を渡さなければ全件。対象は常に自分の通知（DB 側で auth.uid() を使う） */
export async function markRead(formData: FormData): Promise<void> {
  await requireUser();
  const id = String(formData.get("notification_id") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_notifications_read", {
    p_ids: id ? [id] : undefined,
  });
  if (error) console.error("既読処理に失敗しました:", error.message);

  revalidatePath("/", "layout");
}

export async function updatePreferences(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUser();

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_notification_preferences", {
    p_approval_result: formData.get("approval_result") === "on",
    p_request_received: formData.get("request_received") === "on",
    p_board_post: formData.get("board_post") === "on",
    p_new_event: formData.get("new_event") === "on",
    p_event_reminder: formData.get("event_reminder") === "on",
  });

  if (error) return { error: error.message };

  revalidatePath("/mypage");
  return { notice: "通知設定を保存しました。" };
}
