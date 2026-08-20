"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/dal";
import { createClient } from "@/lib/supabase-server";

export type ActionState = { error?: string; notice?: string } | null;

/**
 * サークル設立申請。
 *
 * 実処理は DB 関数 create_circle に委ねている。circles の作成と
 * 「作成者を管理者メンバーにする」の2操作を1トランザクションにまとめ、
 * 管理者不在のサークルが生まれないようにするため。
 * 権限判定も DB 側にあるので、ここでの early return は UI 上の親切。
 */
export async function createCircle(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  if (user.role !== "student") {
    return { error: "サークルを設立できるのは学生のみです。" };
  }

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  if (!name) return { error: "サークル名を入力してください。" };
  if (name.length > 60) {
    return { error: "サークル名は60文字以内で入力してください。" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_circle", {
    p_name: name,
    p_description: description || undefined,
  });

  if (error) return { error: error.message };

  revalidatePath("/circles");
  revalidatePath("/dashboard");
  redirect(`/circles/${data}`);
}

/** 参加申請 */
export async function requestJoin(formData: FormData): Promise<void> {
  await requireUser();
  const circleId = String(formData.get("circle_id") ?? "");
  if (!circleId) return;

  const supabase = await createClient();
  const { error } = await supabase.rpc("request_join_circle", {
    p_circle_id: circleId,
  });

  if (error) console.error("参加申請に失敗しました:", error.message);

  revalidatePath(`/circles/${circleId}`);
  revalidatePath("/dashboard");
}

/** メンバーの承認 / 却下（サークル管理者のみ。判定は DB 側） */
export async function decideMember(formData: FormData): Promise<void> {
  await requireUser();
  const circleId = String(formData.get("circle_id") ?? "");
  const userId = String(formData.get("user_id") ?? "");
  const approve = formData.get("approve") === "true";
  if (!circleId || !userId) return;

  const supabase = await createClient();
  const { error } = await supabase.rpc("decide_circle_member", {
    p_circle_id: circleId,
    p_user_id: userId,
    p_approve: approve,
  });

  if (error) console.error("メンバー審査に失敗しました:", error.message);

  revalidatePath(`/circles/${circleId}`);
}

/** サークル設立の承認 / 却下（大学職員のみ。判定は DB 側） */
export async function decideCircle(formData: FormData): Promise<void> {
  await requireUser();
  const circleId = String(formData.get("circle_id") ?? "");
  const approve = formData.get("approve") === "true";
  if (!circleId) return;

  const supabase = await createClient();
  const { error } = await supabase.rpc("decide_circle", {
    p_circle_id: circleId,
    p_approve: approve,
  });

  if (error) console.error("サークル審査に失敗しました:", error.message);

  revalidatePath("/circles");
  revalidatePath(`/circles/${circleId}`);
}
