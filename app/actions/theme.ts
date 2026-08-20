"use server";

import { revalidatePath } from "next/cache";

import type { Theme } from "@/lib/database.types";
import { requireUser } from "@/lib/dal";
import { createClient } from "@/lib/supabase-server";

export type ActionState = { error?: string; notice?: string } | null;

const THEMES: Theme[] = ["glass", "pop"];

/**
 * 表示テーマの変更。
 *
 * 対象は常に自分自身（RPC 側で auth.uid() を使う）。
 * 変更後はレイアウトごと再検証する。html の data-theme を差し替える必要が
 * あるため、ページ単位の再検証では反映されない。
 */
export async function setTheme(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUser();

  const theme = String(formData.get("theme") ?? "");
  if (!THEMES.includes(theme as Theme)) {
    return { error: "テーマの指定が不正です。" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_my_theme", {
    p_theme: theme as Theme,
  });

  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { notice: "テーマを変更しました。" };
}
