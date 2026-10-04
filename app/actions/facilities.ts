"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/dal";
import { createClient } from "@/lib/supabase-server";
import { parseJstInput } from "@/lib/jst";

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
  // 予約は30分単位。フォームの選択肢も30分刻みにしてある
  const HALF_HOUR = /^([01]\d|2[0-3]):(00|30)$/;
  if (!HALF_HOUR.test(startTime) || !HALF_HOUR.test(endTime)) {
    return { error: "時刻は30分単位で選んでください。" };
  }

  // 備品の貸し出しは日をまたぐため、開始日と終了日を別々に受け取る。
  // 施設の場合はフォーム側で end_date に start_date を入れている。
  // 入力は日本時間。サーバーは UTC で動くので、時差を付けて読む
  const start = parseJstInput(startDate, startTime);
  const end = parseJstInput(endDate, endTime);

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

/** 使用許可願の結果。成功するたびに at が変わり、フォームを空に戻す合図になる */
export type FacilityUseState = (ActionState & { at?: number }) | null;

/** 1回の使用許可願で出せる日時の数（紙の様式の行数に合わせる） */
const MAX_SLOTS = 16;

/** 人数の欄。空欄は0人、それ以外は0〜9999の整数だけを受け付ける */
function parseCount(value: FormDataEntryValue | null): number | null {
  const text = String(value ?? "").trim();
  if (text === "") return 0;
  if (!/^\d{1,4}$/.test(text)) return null;
  return Number(text);
}

/**
 * 施設の使用許可願。紙の「施設使用許可願」の項目に合わせている。
 *
 * 学生番号・氏名・連絡先はアカウントから分かるので尋ねない。
 * 複数の日時をまとめて出せる。1つでも通らなければ全体を出さない
 * （判定と取り下げは DB の request_facility_use が行う）。
 */
export async function requestFacilityUse(
  _prev: FacilityUseState,
  formData: FormData,
): Promise<FacilityUseState> {
  const user = await requireUser();
  if (user.role !== "student") {
    return { error: "施設の使用許可願を出せるのは学生のみです。" };
  }

  const facilityId = String(formData.get("facility_id") ?? "");
  const circleId = String(formData.get("circle_id") ?? "");
  const purpose = String(formData.get("purpose") ?? "").trim();
  const equipmentNote = String(formData.get("equipment_note") ?? "").trim();
  const remarks = String(formData.get("remarks") ?? "").trim();

  if (!facilityId) return { error: "施設が指定されていません。" };
  if (!purpose) return { error: "目的を入力してください。" };
  if (purpose.length > 200) return { error: "目的は200文字以内で入力してください。" };
  if (equipmentNote.length > 200) {
    return { error: "使用用具・器具等は200文字以内で入力してください。" };
  }
  if (remarks.length > 500) return { error: "備考は500文字以内で入力してください。" };

  // 利用人員
  const students = parseCount(formData.get("student_count"));
  const staff = parseCount(formData.get("staff_count"));
  const others = parseCount(formData.get("other_count"));
  if (students === null || staff === null || others === null) {
    return { error: "利用人員は0以上の整数で入力してください。" };
  }
  const total = students + staff + others;
  if (total < 1) return { error: "利用人員を入力してください。" };

  // 学外者の利用。有りのときは人数と、禁煙を伝えることの確認が要る
  let outside = 0;
  if (formData.get("outside") === "yes") {
    const n = parseCount(formData.get("outside_count"));
    if (n === null || n < 1) return { error: "学外者の人数を入力してください。" };
    if (n > total) return { error: "学外者の人数は、利用人員の合計以下にしてください。" };
    if (formData.get("outside_rules") !== "on") {
      return { error: "学外の方に、キャンパス内が全面禁煙であることを伝える旨を確かめてください。" };
    }
    outside = n;
  }

  // 日時。日付・開始・終了が行ごとに並んで届く。まるごと空の行は数えない
  const dates = formData.getAll("slot_date").map(String);
  const starts = formData.getAll("slot_start").map(String);
  const ends = formData.getAll("slot_end").map(String);
  const HALF_HOUR = /^([01]\d|2[0-3]):(00|30)$/;
  const slots: { start: string; end: string }[] = [];
  for (let i = 0; i < dates.length; i++) {
    const [date, start, end] = [dates[i] ?? "", starts[i] ?? "", ends[i] ?? ""];
    if (!date && !start && !end) continue;
    if (!date || !start || !end) {
      return { error: `${i + 1}行目の日時に、空いている欄があります。` };
    }
    if (!HALF_HOUR.test(start) || !HALF_HOUR.test(end)) {
      return { error: "時刻は30分単位で選んでください。" };
    }
    const from = parseJstInput(date, start);
    const to = parseJstInput(date, end);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return { error: "日時の形式が正しくありません。" };
    }
    if (to <= from) {
      return { error: `${i + 1}行目の終了時刻は、開始時刻より後にしてください。` };
    }
    slots.push({ start: from.toISOString(), end: to.toISOString() });
  }
  if (slots.length === 0) return { error: "日時を1つ以上入力してください。" };
  if (slots.length > MAX_SLOTS) {
    return { error: `日時は1回の申請で${MAX_SLOTS}件までです。` };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("request_facility_use", {
    p_facility_id: facilityId,
    p_slots: slots,
    p_purpose: purpose,
    p_circle_id: circleId || undefined,
    p_student_count: students,
    p_staff_count: staff,
    p_other_count: others,
    p_outside_count: outside,
    p_equipment_note: equipmentNote || undefined,
    p_remarks: remarks || undefined,
  });
  if (error) return { error: error.message };

  revalidatePath(`/facilities/${facilityId}`);
  revalidatePath("/reservations");
  const count = data ?? slots.length;
  return {
    notice:
      count > 1
        ? `${count}日分の使用許可願を出しました。職員の承認をお待ちください。`
        : "使用許可願を出しました。職員の承認をお待ちください。",
    at: Date.now(),
  };
}

/** 予約の承認 / 却下（大学職員のみ。判定は DB 側） */
export async function decideReservation(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUser();
  const id = String(formData.get("reservation_id") ?? "");
  const approve = formData.get("approve") === "true";
  if (!id) return { error: "予約が指定されていません。" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("decide_reservation", {
    p_reservation_id: id,
    p_approve: approve,
  });

  // 失敗しても一覧は引き直す。ほかの職員が先に決めていれば、それが見える
  revalidatePath("/reservations");
  revalidatePath("/facilities");
  revalidatePath("/staff");

  if (error) {
    return {
      error: `${approve ? "承認" : "却下"}できませんでした（${error.message}）。`,
    };
  }
  return null;
}

/**
 * 予約のまとめて承認（大学職員のみ。判定は DB 側）。
 *
 * 1件ずつ decide_reservation を呼ぶ。まとめて1つの関数にすると、
 * 1件の失敗（時間が重なる・既に処理済み）で全部が止まってしまう。
 * 通ったものは通し、通らなかった件数だけを返す。
 */
export async function approveReservations(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUser();
  const ids = [...new Set(formData.getAll("reservation_ids").map(String))].filter(
    Boolean,
  );
  if (ids.length === 0) return { error: "承認する予約を選んでください。" };

  const supabase = await createClient();
  let approved = 0;
  const failures: string[] = [];
  for (const id of ids) {
    const { error } = await supabase.rpc("decide_reservation", {
      p_reservation_id: id,
      p_approve: true,
    });
    if (error) failures.push(error.message);
    else approved++;
  }

  revalidatePath("/reservations");
  revalidatePath("/facilities");
  revalidatePath("/staff");

  if (failures.length === 0) return { notice: `${approved}件を承認しました。` };
  return {
    error:
      `${approved}件を承認しました。${failures.length}件は承認できませんでした` +
      `（${[...new Set(failures)].join(" / ")}）。`,
  };
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
