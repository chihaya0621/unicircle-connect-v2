import "server-only";

import { cache } from "react";

import type { UserRole } from "@/lib/database.types";
import { getMyUniversityId } from "@/lib/dal";
import { createClient } from "@/lib/supabase-server";

export type PendingCounts = {
  /** 職員: 自大学のサークル設立申請のうち、自分がまだ押していないもの */
  circles: number;
  /** 職員: 自大学のサークル廃止申請のうち、自分がまだ押していないもの */
  closures: number;
  /** 職員: 自大学の施設への予約申請 */
  reservations: number;
  /** サークル管理者: 自分が管理するサークルへの参加申請 */
  members: number;
};

const EMPTY: PendingCounts = {
  circles: 0,
  closures: 0,
  reservations: 0,
  members: 0,
};

/**
 * 閲覧者が対応すべき「承認待ち」の件数。
 *
 * ヘッダーに出すためページ遷移のたびに呼ばれるので、
 * 行の中身は取らない。件数は head:true で数え、職員のサークルの申請だけは、
 * 自分がもう押したものを除くために ID を引く（1大学ぶんなので数件）。
 * React の cache で1レンダリング中の重複呼び出しもまとめる。
 *
 * 参加申請と予約は、RLS により自分に関係のないものがそもそも見えない。
 * 廃止の申請だけは、公開サークルなら他大学のものまで見えるので、
 * 自大学に絞るのはここでやる。
 */
export const getPendingCounts = cache(
  async (userId: string, role: UserRole): Promise<PendingCounts> => {
    if (role === "general") return EMPTY;

    const supabase = await createClient();

    if (role === "staff") {
      const universityId = await getMyUniversityId();
      if (!universityId) return EMPTY;

      const [setups, closures, reservations] = await Promise.all([
        supabase
          .from("circles")
          .select("id")
          .eq("status", "pending")
          .eq("university_id", universityId),
        supabase
          .from("circles")
          .select("id")
          .eq("university_id", universityId)
          .not("closure_requested_at", "is", null),
        supabase
          .from("facility_reservations")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending")
          .gte("end_time", new Date().toISOString()),
      ]);

      // 自分がもう押したものは数えない。あとはほかの職員の番で、
      // 数に入れたままだと、開いても押せるものが無い
      const setupIds = (setups.data ?? []).map((c) => c.id);
      const closureIds = (closures.data ?? []).map((c) => c.id);
      const targets = [...setupIds, ...closureIds];
      const { data: mine } =
        targets.length > 0
          ? await supabase
              .from("approvals")
              .select("target_type, target_id")
              .eq("approver_id", userId)
              .in("target_id", targets)
          : { data: [] };
      const done = new Set(
        (mine ?? []).map((a) => `${a.target_type}:${a.target_id}`),
      );

      return {
        circles: setupIds.filter((id) => !done.has(`circle:${id}`)).length,
        closures: closureIds.filter((id) => !done.has(`circle_closure:${id}`))
          .length,
        reservations: reservations.count ?? 0,
        members: 0,
      };
    }

    // 学生: 自分が管理者のサークルに来ている参加申請
    const { data: adminOf } = await supabase
      .from("circle_members")
      .select("circle_id")
      .eq("user_id", userId)
      .eq("role", "admin")
      .eq("status", "active");

    const circleIds = (adminOf ?? [])
      .map((m) => m.circle_id)
      .filter((id): id is string => Boolean(id));

    if (circleIds.length === 0) return EMPTY;

    const { count } = await supabase
      .from("circle_members")
      .select("id", { count: "exact", head: true })
      .in("circle_id", circleIds)
      .eq("status", "pending");

    return { ...EMPTY, members: count ?? 0 };
  },
);
