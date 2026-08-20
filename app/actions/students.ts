"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/dal";
import { createClient } from "@/lib/supabase-server";

export type ActionState = { error?: string; notice?: string } | null;

function parseYear(raw: string): number | undefined | null {
  if (!raw) return undefined;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1900 || parsed > 2100) return null;
  return parsed;
}

/**
 * 学生の登録。
 *
 * 対象はメールアドレスで特定する。auth.users は API から直接読めないため、
 * 照会は register_student（SECURITY DEFINER）に任せている。
 * 所属大学は職員自身のものが使われるので、引数では渡さない。
 */
export async function registerStudent(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  if (user.role !== "staff") {
    return { error: "学生を登録できるのは大学職員のみです。" };
  }

  const email = String(formData.get("email") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const year = parseYear(String(formData.get("enrollment_year") ?? "").trim());

  if (!email) return { error: "メールアドレスを入力してください。" };
  if (!name) return { error: "氏名を入力してください。" };
  if (year === null) {
    return { error: "入学年度は西暦4桁で入力してください。" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("register_student", {
    p_email: email,
    p_name: name,
    p_enrollment_year: year,
  });

  if (error) return { error: error.message };

  revalidatePath("/staff/students");
  return {
    notice:
      data === "updated"
        ? `${name} さんの情報を更新しました。`
        : `${name} さんを学生として登録しました。`,
  };
}

/** 登録済みの学生情報の修正（職員のみ。判定は DB 側） */
export async function updateStudent(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  if (user.role !== "staff") {
    return { error: "学生情報を編集できるのは大学職員のみです。" };
  }

  const userId = String(formData.get("user_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const year = parseYear(String(formData.get("enrollment_year") ?? "").trim());

  if (!userId) return { error: "対象の学生が指定されていません。" };
  if (!name) return { error: "氏名を入力してください。" };
  if (year === null) {
    return { error: "入学年度は西暦4桁で入力してください。" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_student_info", {
    p_user_id: userId,
    p_name: name,
    p_enrollment_year: year,
  });

  if (error) return { error: error.message };

  revalidatePath("/staff/students");
  revalidatePath("/", "layout");
  return { notice: "更新しました。" };
}
