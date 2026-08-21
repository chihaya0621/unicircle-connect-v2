"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/dal";
import { createClient } from "@/lib/supabase-server";

export type ActionState = { error?: string; notice?: string } | null;

/**
 * キャンパスの追加・改名。
 *
 * どの大学に属するかは引数で受け取らない。DB 関数が職員自身の所属大学に
 * 固定するので、リクエストを改変してもよその大学には作れない。
 */
export async function saveCampus(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("staff");

  const id = String(formData.get("campus_id") ?? "") || null;
  const name = String(formData.get("name") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();

  if (!name) return { error: "キャンパス名を入力してください。" };
  if (name.length > 60) return { error: "キャンパス名は60文字までです。" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("upsert_campus", {
    p_id: id,
    p_name: name,
    p_address: address,
  });

  if (error) return { error: `保存に失敗しました: ${error.message}` };

  revalidatePath("/facilities");
  return { notice: id ? "キャンパスを更新しました。" : "キャンパスを追加しました。" };
}

/** 削除。使っていたサークルの拠点は外部キーで未設定に戻る。 */
export async function removeCampus(formData: FormData) {
  await requireRole("staff");

  const id = String(formData.get("campus_id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_campus", { p_id: id });
  if (error) console.error("キャンパスの削除に失敗しました:", error.message);

  revalidatePath("/facilities");
}
