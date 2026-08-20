"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/dal";
import { createClient } from "@/lib/supabase-server";

export type ActionState = { error?: string; notice?: string } | null;

/** 活動の登録（管理者のみ。判定は DB 側） */
export async function createActivity(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUser();

  const circleId = String(formData.get("circle_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const date = String(formData.get("date") ?? "");
  const time = String(formData.get("time") ?? "");
  const location = String(formData.get("location") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();

  if (!circleId) return { error: "サークルが指定されていません。" };
  if (!title) return { error: "活動名を入力してください。" };
  if (!date || !time) return { error: "活動日時を入力してください。" };

  const activityDate = new Date(`${date}T${time}`);
  if (Number.isNaN(activityDate.getTime())) {
    return { error: "日時の形式が正しくありません。" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_activity", {
    p_circle_id: circleId,
    p_title: title,
    p_activity_date: activityDate.toISOString(),
    p_location: location || undefined,
    p_note: note || undefined,
  });

  if (error) return { error: error.message };

  revalidatePath(`/circles/${circleId}/activities`);
  return { notice: "活動を登録しました。" };
}

/** 活動の削除（管理者のみ。判定は DB 側） */
export async function deleteActivity(formData: FormData): Promise<void> {
  await requireUser();
  const id = String(formData.get("activity_id") ?? "");
  const circleId = String(formData.get("circle_id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_activity", {
    p_activity_id: id,
  });
  if (error) console.error("活動の削除に失敗しました:", error.message);

  revalidatePath(`/circles/${circleId}/activities`);
}

/**
 * 出欠の登録。
 *
 * user_id を省略すると自分自身。他人ぶんは管理者のみ記録できるが、
 * その判定は DB 側で行う。
 */
export async function setAttendance(formData: FormData): Promise<void> {
  await requireUser();
  const activityId = String(formData.get("activity_id") ?? "");
  const status = String(formData.get("status") ?? "");
  const userId = String(formData.get("user_id") ?? "");
  const circleId = String(formData.get("circle_id") ?? "");
  if (!activityId || (status !== "present" && status !== "absent")) return;

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_attendance", {
    p_activity_id: activityId,
    p_status: status,
    p_user_id: userId || undefined,
  });
  if (error) console.error("出欠の登録に失敗しました:", error.message);

  revalidatePath(`/circles/${circleId}/activities`);
}
