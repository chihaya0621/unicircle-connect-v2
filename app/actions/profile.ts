"use server";

import { revalidatePath } from "next/cache";

import { requireRole, requireUser } from "@/lib/dal";
import { createClient } from "@/lib/supabase-server";

export type ActionState = { error?: string; notice?: string } | null;

/**
 * プロフィール更新。
 *
 * 対象は常に自分自身。RPC 側も auth.uid() を使うので、
 * 他人のプロフィールを書き換える経路は存在しない。
 */
export async function updateProfile(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const name = String(formData.get("name") ?? "").trim();
  const bio = String(formData.get("bio") ?? "").trim();
  const skillsRaw = String(formData.get("skills") ?? "");
  const yearRaw = String(formData.get("enrollment_year") ?? "").trim();

  if (!name) return { error: "氏名を入力してください。" };
  if (name.length > 50) {
    return { error: "氏名は50文字以内で入力してください。" };
  }

  // スキルは「,」区切りで入力してもらい、配列に直す
  const skills = skillsRaw
    .split(/[,、]/)
    .map((s) => s.trim())
    .filter(Boolean);

  let enrollmentYear: number | undefined;
  if (yearRaw) {
    const parsed = Number(yearRaw);
    if (!Number.isInteger(parsed) || parsed < 1900 || parsed > 2100) {
      return { error: "入学年度は西暦4桁で入力してください。" };
    }
    enrollmentYear = parsed;
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_my_profile", {
    p_name: name,
    p_bio: bio || undefined,
    p_skills: user.role === "student" ? skills : undefined,
    p_enrollment_year: enrollmentYear,
  });

  if (error) return { error: error.message };

  // 氏名はヘッダーにも出るのでレイアウトごと再検証する
  revalidatePath("/", "layout");
  return { notice: "プロフィールを更新しました。" };
}

/**
 * 印影を決める。職員のみ（0029）。
 *
 * 文字を空にすると未設定に戻る。そのときは押印の際に氏名の頭2字で
 * 認印が作られるので、決めていない職員でも承認は止まらない。
 */
export async function updateSeal(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("staff");

  const text = String(formData.get("seal_text") ?? "").trim();
  const shape = String(formData.get("seal_shape") ?? "circle");

  if ([...text].length > 4) {
    return { error: "印影に彫れるのは4字までです。" };
  }
  if (shape !== "circle" && shape !== "square") {
    return { error: "印影の形が不正です。" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_my_seal", {
    p_text: text || null,
    p_shape: shape,
  });
  if (error) return { error: error.message };

  revalidatePath("/mypage");
  return {
    notice: text ? `印影を「${text}」にしました。` : "印影を未設定に戻しました。",
  };
}
