"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { EventVisibility } from "@/lib/database.types";
import { requireUser } from "@/lib/dal";
import { createClient } from "@/lib/supabase-server";

export type ActionState = { error?: string; notice?: string } | null;

const VISIBILITIES: EventVisibility[] = ["internal", "scoped", "public"];

function isVisibility(value: string): value is EventVisibility {
  return (VISIBILITIES as string[]).includes(value);
}

/**
 * イベント作成。
 *
 * 主催者の排他的関連（大学 or サークル）は DB 関数側で振り分ける。
 * ここでは「サークルIDが空かどうか」だけを渡す。
 * 権限判定も DB 側にあるので、この関数の検証は UI 上の親切。
 */
export async function createEvent(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  if (user.role === "general") {
    return { error: "イベントを作成する権限がありません。" };
  }

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const date = String(formData.get("event_date") ?? "");
  const time = String(formData.get("event_time") ?? "");
  const visibility = String(formData.get("visibility") ?? "internal");
  const circleId = String(formData.get("circle_id") ?? "");
  const targetGrades = formData.getAll("target_grades").map(String).filter(Boolean);
  const universityIds = formData
    .getAll("university_ids")
    .map(String)
    .filter(Boolean);

  if (!title) return { error: "イベント名を入力してください。" };
  if (title.length > 100) {
    return { error: "イベント名は100文字以内で入力してください。" };
  }
  if (!date || !time) return { error: "開催日時を入力してください。" };

  const eventDate = new Date(`${date}T${time}`);
  if (Number.isNaN(eventDate.getTime())) {
    return { error: "日時の形式が正しくありません。" };
  }
  if (eventDate < new Date()) {
    return { error: "過去の日時にはイベントを作成できません。" };
  }

  // includes での絞り込みでは型が narrow されないため、明示的に判定する
  if (!isVisibility(visibility)) {
    return { error: "公開範囲の指定が不正です。" };
  }
  if (visibility === "scoped" && universityIds.length === 0) {
    return { error: "公開する大学を1つ以上選んでください。" };
  }
  // 学生は大学公式イベントを作れない。主催サークルの選択が必須。
  if (user.role === "student" && !circleId) {
    return { error: "主催するサークルを選んでください。" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_event", {
    p_title: title,
    p_event_date: eventDate.toISOString(),
    p_description: description || undefined,
    p_visibility: visibility,
    p_circle_id: circleId || undefined,
    p_target_grades: targetGrades.length ? targetGrades : undefined,
    p_university_ids: visibility === "scoped" ? universityIds : undefined,
  });

  if (error) return { error: error.message };

  revalidatePath("/events");
  revalidatePath("/calendar");
  redirect(`/events/${data}`);
}

/** イベント削除（主催者本人のみ。判定は DB 側） */
export async function deleteEvent(formData: FormData): Promise<void> {
  await requireUser();
  const id = String(formData.get("event_id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_event", { p_event_id: id });

  if (error) {
    console.error("イベント削除に失敗しました:", error.message);
    return;
  }

  revalidatePath("/events");
  revalidatePath("/calendar");
  redirect("/events");
}

/** イベント参加登録（可視範囲の判定は DB 側） */
export async function joinEvent(formData: FormData): Promise<void> {
  await requireUser();
  const id = String(formData.get("event_id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  const { error } = await supabase.rpc("join_event", { p_event_id: id });
  if (error) console.error("参加登録に失敗しました:", error.message);

  revalidatePath(`/events/${id}`);
  revalidatePath("/calendar");
}

/** イベント参加の取り消し */
export async function leaveEvent(formData: FormData): Promise<void> {
  await requireUser();
  const id = String(formData.get("event_id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  const { error } = await supabase.rpc("leave_event", { p_event_id: id });
  if (error) console.error("参加取り消しに失敗しました:", error.message);

  revalidatePath(`/events/${id}`);
  revalidatePath("/calendar");
}

/**
 * リマインドの設定・解除。
 *
 * 参加登録の有無と時刻の範囲は DB 関数が最終判定する。
 * 「通知しない」を選ぶと空文字が届くので、NULL に直して解除に回す。
 */
export async function setEventReminder(formData: FormData) {
  await requireUser();

  const eventId = String(formData.get("event_id") ?? "");
  if (!eventId) return;

  const raw = String(formData.get("lead_minutes") ?? "");
  const leadMinutes = raw === "" ? null : Number(raw);
  if (leadMinutes !== null && !Number.isInteger(leadMinutes)) return;

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_event_reminder", {
    p_event_id: eventId,
    p_lead_minutes: leadMinutes,
  });

  if (error) {
    console.error("リマインドの設定に失敗しました:", error.message);
    return;
  }

  revalidatePath(`/events/${eventId}`);
}
