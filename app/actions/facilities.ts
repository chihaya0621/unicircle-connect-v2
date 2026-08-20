"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/dal";
import { createClient } from "@/lib/supabase-server";

export type ActionState = { error?: string; notice?: string } | null;

/**
 * 予約申請。
 *
 * 二重予約の判定は DB の排他制約 no_overlapping_reservations が行う。
 * アプリ側で「空きを確認してから INSERT」する方式は、2人が同時に
 * 確認した場合に両方通ってしまうため採用していない。
 */
export async function createReservation(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  if (user.role !== "student") {
    return { error: "施設を予約できるのは学生のみです。" };
  }

  const facilityId = String(formData.get("facility_id") ?? "");
  const startDate = String(formData.get("start_date") ?? "");
  const endDate = String(formData.get("end_date") ?? "");
  const startTime = String(formData.get("start_time") ?? "");
  const endTime = String(formData.get("end_time") ?? "");
  const purpose = String(formData.get("purpose") ?? "").trim();
  const circleId = String(formData.get("circle_id") ?? "");

  if (!facilityId || !startDate || !endDate || !startTime || !endTime) {
    return { error: "日付と時間を入力してください。" };
  }

  // 備品の貸し出しは日をまたぐため、開始日と終了日を別々に受け取る。
  // 施設の場合はフォーム側で end_date に start_date を入れている。
  const start = new Date(`${startDate}T${startTime}`);
  const end = new Date(`${endDate}T${endTime}`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { error: "日時の形式が正しくありません。" };
  }
  if (end <= start) {
    return { error: "終了日時は開始日時より後にしてください。" };
  }

  // 極端に長い占有を防ぐ。備品の長期貸し出しを想定して90日を上限にする。
  const MAX_DAYS = 90;
  if (end.getTime() - start.getTime() > MAX_DAYS * 86_400_000) {
    return { error: `予約期間は最長${MAX_DAYS}日までです。` };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_reservation", {
    p_facility_id: facilityId,
    p_start: start.toISOString(),
    p_end: end.toISOString(),
    p_purpose: purpose || undefined,
    p_circle_id: circleId || undefined,
  });

  if (error) return { error: error.message };

  revalidatePath(`/facilities/${facilityId}`);
  revalidatePath("/reservations");
  return { notice: "予約を申請しました。職員の承認をお待ちください。" };
}

/** 予約の承認 / 却下（大学職員のみ。判定は DB 側） */
export async function decideReservation(formData: FormData): Promise<void> {
  await requireUser();
  const id = String(formData.get("reservation_id") ?? "");
  const approve = formData.get("approve") === "true";
  if (!id) return;

  const supabase = await createClient();
  const { error } = await supabase.rpc("decide_reservation", {
    p_reservation_id: id,
    p_approve: approve,
  });

  if (error) console.error("予約審査に失敗しました:", error.message);

  revalidatePath("/reservations");
  revalidatePath("/facilities");
}

/** 予約の取り消し（申請者本人またはサークル管理者。判定は DB 側） */
export async function cancelReservation(formData: FormData): Promise<void> {
  await requireUser();
  const id = String(formData.get("reservation_id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_reservation", {
    p_reservation_id: id,
  });

  if (error) console.error("予約取り消しに失敗しました:", error.message);

  revalidatePath("/reservations");
  revalidatePath("/facilities");
}

/** 施設の登録（大学職員のみ。判定は DB 側） */
export async function createFacility(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  if (user.role !== "staff") {
    return { error: "施設を登録できるのは大学職員のみです。" };
  }

  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "facility");

  if (!name) return { error: "施設名を入力してください。" };
  if (category !== "facility" && category !== "equipment") {
    return { error: "区分の指定が不正です。" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_facility", {
    p_name: name,
    p_category: category,
  });

  if (error) return { error: error.message };

  revalidatePath("/facilities");
  return { notice: `「${name}」を登録しました。` };
}

/** 施設の利用可否の切り替え（大学職員のみ。判定は DB 側） */
export async function toggleFacility(formData: FormData): Promise<void> {
  await requireUser();
  const id = String(formData.get("facility_id") ?? "");
  const available = formData.get("available") === "true";
  if (!id) return;

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_facility_availability", {
    p_facility_id: id,
    p_available: available,
  });

  if (error) console.error("施設の更新に失敗しました:", error.message);

  revalidatePath("/facilities");
}

/** 施設・備品の編集（大学職員のみ。判定は DB 側） */
export async function updateFacility(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  if (user.role !== "staff") {
    return { error: "施設を編集できるのは大学職員のみです。" };
  }

  const id = String(formData.get("facility_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "facility");

  if (!id) return { error: "対象の施設が指定されていません。" };
  if (!name) return { error: "名称を入力してください。" };
  if (category !== "facility" && category !== "equipment") {
    return { error: "区分の指定が不正です。" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_facility", {
    p_facility_id: id,
    p_name: name,
    p_category: category,
  });

  if (error) return { error: error.message };

  revalidatePath("/facilities");
  revalidatePath(`/facilities/${id}`);
  return { notice: "更新しました。" };
}

/**
 * 施設・備品の削除（大学職員のみ。判定は DB 側）。
 *
 * 今後の予約が残っている場合は DB 側が拒否する。
 * facility_reservations は ON DELETE CASCADE なので、
 * そのまま消すと利用者の予約が予告なく巻き添えになるため。
 */
export async function deleteFacility(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  if (user.role !== "staff") {
    return { error: "施設を削除できるのは大学職員のみです。" };
  }

  const id = String(formData.get("facility_id") ?? "");
  if (!id) return { error: "対象の施設が指定されていません。" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_facility", {
    p_facility_id: id,
  });

  if (error) return { error: error.message };

  revalidatePath("/facilities");
  return { notice: "削除しました。" };
}
