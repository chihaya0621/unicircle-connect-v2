"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/dal";
import { createClient } from "@/lib/supabase-server";

/**
 * イベントの出欠記録。
 *
 * 主催者かどうかの判定は DB 側（app_can_manage_event）で行う。
 * attended に空文字を渡すと未記録に戻す。押し間違いの取り消し用。
 */
export async function recordAttendance(formData: FormData): Promise<void> {
  await requireUser();

  const eventId = String(formData.get("event_id") ?? "");
  const userId = String(formData.get("user_id") ?? "");
  const raw = String(formData.get("attended") ?? "");
  if (!eventId || !userId) return;

  const attended = raw === "" ? null : raw === "true";

  const supabase = await createClient();
  const { error } = await supabase.rpc("record_event_attendance", {
    p_event_id: eventId,
    p_user_id: userId,
    p_attended: attended,
  });

  if (error) console.error("出欠の記録に失敗しました:", error.message);

  revalidatePath(`/events/${eventId}`);
}
