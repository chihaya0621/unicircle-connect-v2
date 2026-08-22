import "server-only";

import { createClient } from "@/lib/supabase-server";

/**
 * 承認の記録。
 *
 * 紙の決裁で回覧の判を見返すのと同じで、誰がいつ通したかを
 * 後から辿れるようにする。RLS により、対象そのものが読める人だけが読める。
 */
export type ApprovalTarget = "circle" | "circle_closure" | "reservation";

export type ApprovalEntry = {
  id: string;
  target_type: ApprovalTarget;
  decision: "approved" | "rejected";
  approver_name: string;
  comment: string | null;
  created_at: string;
};

export async function listApprovals(
  targetType: ApprovalTarget,
  targetId: string,
): Promise<ApprovalEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("approvals")
    .select("id, target_type, decision, approver_name, comment, created_at")
    .eq("target_type", targetType)
    .eq("target_id", targetId)
    .order("created_at")
    .returns<ApprovalEntry[]>();

  if (error) {
    console.error("承認履歴の取得に失敗しました:", error.message);
    return [];
  }
  return data ?? [];
}

/**
 * サークルの設立と廃止の履歴をまとめて引く。
 *
 * 画面では1本の時系列として見せたい。別々に問い合わせて
 * 結合すると往復が増えるので、対象種別で分けずに取る。
 */
export async function listCircleApprovals(
  circleId: string,
): Promise<ApprovalEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("approvals")
    .select("id, target_type, decision, approver_name, comment, created_at")
    .in("target_type", ["circle", "circle_closure"])
    .eq("target_id", circleId)
    .order("created_at")
    .returns<ApprovalEntry[]>();

  if (error) {
    console.error("承認履歴の取得に失敗しました:", error.message);
    return [];
  }
  return data ?? [];
}

/** 大学が定めた必要承認者数。取得できなければ1人として扱う */
export async function getRequiredApprovals(
  universityId: string | null,
): Promise<number> {
  if (!universityId) return 1;
  const supabase = await createClient();
  const { data } = await supabase
    .from("universities")
    .select("required_circle_approvals")
    .eq("id", universityId)
    .maybeSingle();
  return data?.required_circle_approvals ?? 1;
}

/** その大学に登録されている職員の数。必要承認者数の上限になる */
export async function countStaff(universityId: string | null): Promise<number> {
  if (!universityId) return 0;
  const supabase = await createClient();
  const { count } = await supabase
    .from("staff_profiles")
    .select("user_id", { count: "exact", head: true })
    .eq("university_id", universityId);
  return count ?? 0;
}

/**
 * 対象ごとに集まっている承認の数。
 *
 * 承認キューで「あと何人か」を出すのに使う。件数だけを数えるので、
 * 誰が押したかは返さない。
 */
export async function countApprovals(
  targetType: ApprovalTarget,
  targetIds: string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (targetIds.length === 0) return counts;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("approvals")
    .select("target_id")
    .eq("target_type", targetType)
    .eq("decision", "approved")
    .in("target_id", targetIds);

  if (error) {
    console.error("承認数の取得に失敗しました:", error.message);
    return counts;
  }
  for (const row of data ?? []) {
    counts.set(row.target_id, (counts.get(row.target_id) ?? 0) + 1);
  }
  return counts;
}
