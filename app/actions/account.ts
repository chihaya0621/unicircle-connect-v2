"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/dal";
import { createClient } from "@/lib/supabase-server";

export type ActionState = { error?: string; notice?: string } | null;

/**
 * アカウントの削除。一般アカウントのみ。
 *
 * 学生・職員は大学が管理する立場なので、本人の操作では消せない
 * （DB 側でも同じ判定をしている）。消すと気になる大学・気になる
 * サークル・通知まで連鎖して消えるので、確認の入力を求める。
 */
export async function deleteAccount(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  if (String(formData.get("confirm") ?? "").trim() !== "削除") {
    return { error: "確認のため「削除」と入力してください。" };
  }
  if (user.role !== "general") {
    return {
      error:
        "学生・職員アカウントはご自身では削除できません。大学の担当窓口にお問い合わせください。",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_my_account");
  if (error) return { error: `削除に失敗しました: ${error.message}` };

  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}
