import "server-only";

import { cache } from "react";

import type {
  ApprovalStatus,
  CircleRole,
  MembershipStatus,
  UserRole,
} from "@/lib/database.types";
import { createClient } from "@/lib/supabase-server";

export type CircleListItem = {
  id: string;
  name: string;
  description: string | null;
  status: ApprovalStatus;
  university_id: string | null;
  university: { name: string } | null;
  member_count: { count: number }[];
};

export type CircleMember = {
  user_id: string;
  role: CircleRole;
  status: MembershipStatus;
  created_at: string;
  user: { name: string; role: UserRole } | null;
};

export type CircleDetail = {
  id: string;
  name: string;
  description: string | null;
  status: ApprovalStatus;
  university_id: string | null;
  created_at: string;
  university: { name: string } | null;
};

const LIST_SELECT = `
  id, name, description, status, university_id,
  university:universities!circles_university_id_fkey(name),
  member_count:circle_members(count)
` as const;

/**
 * 承認済みサークルの一覧。
 *
 * 一般ユーザー・未ログインでも閲覧自体はできる（参加はできない）。
 * 承認待ちのサークルは一覧に出さない。
 */
export async function listApprovedCircles() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("circles")
    .select(LIST_SELECT)
    .eq("status", "approved")
    .order("name")
    .returns<CircleListItem[]>();

  if (error) {
    console.error("サークル取得に失敗しました:", error.message);
    return { circles: [] as CircleListItem[], error: error.message };
  }
  return { circles: data ?? [], error: null };
}

/**
 * 職員の承認待ちキュー。自分の所属大学のものだけを返す。
 */
export async function listPendingCircles(staffUserId: string) {
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("staff_profiles")
    .select("university_id")
    .eq("user_id", staffUserId)
    .maybeSingle();

  if (!profile?.university_id) return [] as CircleListItem[];

  const { data } = await supabase
    .from("circles")
    .select(LIST_SELECT)
    .eq("status", "pending")
    .eq("university_id", profile.university_id)
    .order("name")
    .returns<CircleListItem[]>();

  return data ?? [];
}

export const getCircle = cache(
  async (circleId: string): Promise<CircleDetail | null> => {
    const supabase = await createClient();
    const { data } = await supabase
      .from("circles")
      .select(
        `id, name, description, status, university_id, created_at,
         university:universities!circles_university_id_fkey(name)`,
      )
      .eq("id", circleId)
      .maybeSingle()
      .returns<CircleDetail>();
    return data ?? null;
  },
);

/**
 * サークルのメンバー一覧。
 *
 * 承認待ち (pending) の申請者も含めて返す。誰に見せるかは呼び出し側で
 * 判断すること（管理者以外に申請者一覧を見せる必要はない）。
 */
export async function listMembers(circleId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("circle_members")
    .select(
      `user_id, role, status, created_at,
       user:users!circle_members_user_id_fkey(name, role)`,
    )
    .eq("circle_id", circleId)
    .order("created_at")
    .returns<CircleMember[]>();
  return data ?? [];
}

/**
 * 閲覧者自身の、そのサークルにおける状態。
 * 参加ボタンを出すか、管理UIを出すかの判断に使う。
 */
export const getMyMembership = cache(
  async (
    circleId: string,
    userId: string,
  ): Promise<{ role: CircleRole; status: MembershipStatus } | null> => {
    const supabase = await createClient();
    const { data } = await supabase
      .from("circle_members")
      .select("role, status")
      .eq("circle_id", circleId)
      .eq("user_id", userId)
      .maybeSingle();
    return data ?? null;
  },
);

export function isCircleAdmin(
  membership: { role: CircleRole; status: MembershipStatus } | null,
) {
  return membership?.role === "admin" && membership.status === "active";
}

/** 自分が所属しているサークル（ダッシュボード用） */
export async function listMyCircles(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("circle_members")
    .select(
      `role, status,
       circle:circles!circle_members_circle_id_fkey(id, name, status)`,
    )
    .eq("user_id", userId)
    .order("created_at")
    .returns<
      {
        role: CircleRole;
        status: MembershipStatus;
        circle: { id: string; name: string; status: ApprovalStatus } | null;
      }[]
    >();
  return data ?? [];
}
