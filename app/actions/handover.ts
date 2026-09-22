"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/dal";
import { createClient } from "@/lib/supabase-server";

export type ActionState = { error?: string; notice?: string } | null;

/**
 * 代表の引き継ぎを申し出る。
 *
 * 誰が申し出られるか、誰に引き継げるかの判断は RPC 側にある。
 * ここで確かめているのは入力の形だけで、権限の判定は増やさない。
 * 二箇所で判断すると、片方を直したときにもう片方が置き去りになる。
 */
export async function requestHandover(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("student");

  const circleId = String(formData.get("circle_id") ?? "");
  const toUser = String(formData.get("to_user") ?? "");
  const note = String(formData.get("note") ?? "").trim();

  if (!circleId || !toUser) {
    return { error: "引き継ぐ相手を選んでください。" };
  }
  if (note.length > 1000) {
    return { error: "申し送りは1000文字以内で入力してください。" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("request_handover", {
    p_circle_id: circleId,
    p_to_user: toUser,
    p_note: note || null,
  });
  if (error) return { error: error.message };

  revalidatePath(`/circles/${circleId}`);
  return { notice: "引き継ぎを申し出ました。相手が受けると成立します。" };
}

/** 申し出に答える。指名された本人だけが呼べる */
export async function respondHandover(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("student");

  const handoverId = String(formData.get("handover_id") ?? "");
  const circleId = String(formData.get("circle_id") ?? "");
  const accept = formData.get("accept") === "true";
  if (!handoverId) return { error: "申し出が見つかりません。" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("respond_handover", {
    p_handover_id: handoverId,
    p_accept: accept,
  });
  if (error) return { error: error.message };

  revalidatePath(`/circles/${circleId}`);
  revalidatePath("/notifications");
  return {
    notice: accept
      ? "引き継ぎました。あなたがこのサークルの代表です。"
      : "申し出を受けませんでした。",
  };
}

/** 申し出を取り下げる。申し出た本人だけが呼べる */
export async function cancelHandover(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("student");

  const handoverId = String(formData.get("handover_id") ?? "");
  const circleId = String(formData.get("circle_id") ?? "");
  if (!handoverId) return { error: "申し出が見つかりません。" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_handover", {
    p_handover_id: handoverId,
  });
  if (error) return { error: error.message };

  revalidatePath(`/circles/${circleId}`);
  return { notice: "申し出を取り下げました。" };
}
