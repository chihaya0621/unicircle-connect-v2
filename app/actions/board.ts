"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/dal";
import { createClient } from "@/lib/supabase-server";

export type ActionState = { error?: string; notice?: string } | null;

/** 投稿（メンバーのみ。固定は管理者のみ。判定は DB 側） */
export async function createPost(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUser();

  const circleId = String(formData.get("circle_id") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  const pinned = formData.get("pinned") === "on";

  if (!circleId) return { error: "投稿先のサークルが指定されていません。" };
  if (!body) return { error: "本文を入力してください。" };
  if (body.length > 2000) {
    return { error: "本文は2000文字以内で入力してください。" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_circle_post", {
    p_circle_id: circleId,
    p_body: body,
    p_pinned: pinned,
  });

  if (error) return { error: error.message };

  revalidatePath("/board");
  revalidatePath(`/circles/${circleId}`);
  return { notice: "投稿しました。" };
}

/** 削除（投稿者本人または管理者。判定は DB 側） */
export async function deletePost(formData: FormData): Promise<void> {
  await requireUser();
  const id = String(formData.get("post_id") ?? "");
  const circleId = String(formData.get("circle_id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_circle_post", { p_post_id: id });
  if (error) console.error("投稿の削除に失敗しました:", error.message);

  revalidatePath("/board");
  if (circleId) revalidatePath(`/circles/${circleId}`);
}

/** お知らせへの固定・解除（管理者のみ。判定は DB 側） */
export async function togglePin(formData: FormData): Promise<void> {
  await requireUser();
  const id = String(formData.get("post_id") ?? "");
  const pinned = formData.get("pinned") === "true";
  const circleId = String(formData.get("circle_id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_post_pinned", {
    p_post_id: id,
    p_pinned: pinned,
  });
  if (error) console.error("固定の変更に失敗しました:", error.message);

  revalidatePath("/board");
  if (circleId) revalidatePath(`/circles/${circleId}`);
}
