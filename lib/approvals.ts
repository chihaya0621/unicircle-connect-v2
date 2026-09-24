import "server-only";

import { createClient } from "@/lib/supabase-server";
import type { SealShape } from "@/lib/database.types";

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
  /** 押した人。自分がもう押したかを見分けるのに使う。退職などで消えると null */
  approver_id: string | null;
  approver_name: string;
  comment: string | null;
  created_at: string;
  /** 押した時点の印影（0029） */
  seal_text: string | null;
  seal_shape: SealShape | null;
};

const ENTRY_COLUMNS =
  "id, target_type, decision, approver_id, approver_name, comment, created_at, seal_text, seal_shape";

export async function listApprovals(
  targetType: ApprovalTarget,
  targetId: string,
): Promise<ApprovalEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("approvals")
    .select(ENTRY_COLUMNS)
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
    .select(ENTRY_COLUMNS)
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
 * 対象ごとの承認の記録。承認待ちの一覧に押印欄を描くのに使う。
 *
 * 件数だけでは、誰が押したのか、自分はもう押したのかが読めない。
 * 紙の回覧と同じく、押された印影と空の欄を並べて見せる。
 */
export async function listApprovalsByTarget(
  targetType: ApprovalTarget,
  targetIds: string[],
): Promise<Map<string, ApprovalEntry[]>> {
  const byTarget = new Map<string, ApprovalEntry[]>();
  if (targetIds.length === 0) return byTarget;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("approvals")
    .select(`${ENTRY_COLUMNS}, target_id`)
    .eq("target_type", targetType)
    .in("target_id", targetIds)
    .order("created_at")
    .returns<(ApprovalEntry & { target_id: string })[]>();

  if (error) {
    console.error("承認の記録の取得に失敗しました:", error.message);
    return byTarget;
  }
  for (const row of data ?? []) {
    const list = byTarget.get(row.target_id) ?? [];
    list.push(row);
    byTarget.set(row.target_id, list);
  }
  return byTarget;
}

/**
 * 承認の記録が押された当時のままか確かめる。
 *
 * 記録は1件ずつ前の記録のハッシュを抱えているので、途中の1行を
 * 書き換えるとそこから後ろが合わなくなる（0029）。
 *
 * 検知できるのは「いまの中身が当時と違うこと」だけで、元の値に
 * きっちり戻されると分からない。公開鍵の署名ではないので、
 * 「誰が押していないか」の証明にもならない。
 */
export type ChainCheck = {
  ok: boolean;
  /** 何件目まで数えたか。落ちた場合は、そこで合わなくなった */
  checked: number;
  brokenAt: string | null;
};

export async function verifyApprovalChain(
  targetType: ApprovalTarget,
  targetId: string,
): Promise<ChainCheck | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("verify_approval_chain", {
    p_target_type: targetType,
    p_target_id: targetId,
  });

  if (error) {
    // 確かめられなかったことと、壊れていることは別。
    // null を返して、画面には「確認できません」と出す。
    console.error("承認の記録の検証に失敗しました:", error.message);
    return null;
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return { ok: row.ok, checked: row.checked, brokenAt: row.broken_at };
}

/** 自分の印影。職員以外は持たない */
export async function getMySeal(
  userId: string,
): Promise<{ text: string | null; shape: SealShape }> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("staff_profiles")
    .select("seal_text, seal_shape")
    .eq("user_id", userId)
    .maybeSingle();

  return {
    text: data?.seal_text ?? null,
    shape: (data?.seal_shape as SealShape) ?? "circle",
  };
}
