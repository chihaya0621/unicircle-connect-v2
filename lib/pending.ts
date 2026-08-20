import "server-only";

import { cache } from "react";

import type { UserRole } from "@/lib/database.types";
import { createClient } from "@/lib/supabase-server";

export type PendingCounts = {
  /** 職員: 自大学のサークル設立申請 */
  circles: number;
  /** 職員: 自大学の施設への予約申請 */
  reservations: number;
  /** サークル管理者: 自分が管理するサークルへの参加申請 */
  members: number;
};

const EMPTY: PendingCounts = { circles: 0, reservations: 0, members: 0 };

/**
 * 閲覧者が対応すべき「承認待ち」の件数。
 *
 * ヘッダーに出すためページ遷移のたびに呼ばれるので、
 * 件数だけを head:true で取り、行データは取得しない。
 * React の cache で1レンダリング中の重複呼び出しもまとめる。
 *
 * RLS により、自分に関係のない申請はそもそも見えない。
 * ここでの絞り込みは表示の意図を明示するためのもので、
 * 抜けがあっても他人の申請が数に混ざることはない。
 */
export const getPendingCounts = cache(
  async (userId: string, role: UserRole): Promise<PendingCounts> => {
    if (role === "general") return EMPTY;

    const supabase = await createClient();

    if (role === "staff") {
      const [circles, reservations] = await Promise.all([
        supabase
          .from("circles")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),
        supabase
          .from("facility_reservations")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending")
          .gte("end_time", new Date().toISOString()),
      ]);

      return {
        circles: circles.count ?? 0,
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

    return { circles: 0, reservations: 0, members: count ?? 0 };
  },
);
