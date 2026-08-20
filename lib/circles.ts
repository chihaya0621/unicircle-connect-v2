import "server-only";

import { cache } from "react";

import type {
  ApprovalStatus,
  CircleRole,
  MembershipStatus,
  Scope,
  UserRole,
} from "@/lib/database.types";
import { createClient } from "@/lib/supabase-server";

export type CircleListItem = {
  id: string;
  name: string;
  description: string | null;
  status: ApprovalStatus;
  scope: Scope;
  image_path: string | null;
  university_id: string | null;
  university: { name: string } | null;
  member_count: { count: number }[];
  scoped_universities: { university_id: string }[];
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
  scope: Scope;
  image_path: string | null;
  university_id: string | null;
  created_at: string;
  university: { name: string } | null;
  scoped_universities: { university: { name: string } | null }[];
};

const LIST_SELECT = `
  id, name, description, status, scope, image_path, university_id,
  university:universities!circles_university_id_fkey(name),
  member_count:circle_members(count),
  scoped_universities:circle_universities(university_id)
` as const;

/**
 * 閲覧者が参加できるサークルを、既定では自大学のものに絞って返す。
 *
 * インカレ（scope='public'）は大学を問わず参加できるため、増えるほど
 * 一覧を圧迫する。既定では他大学のサークルを畳み、必要なときだけ
 * showOtherUniversities で開く。
 *
 * ただし所属中のサークルは常に表示する。設定によって自分の所属先が
 * 一覧から消えるのは分かりにくいため。
 *
 * 絞り込みはアプリ側で行う。PostgREST では「scope 別に条件を変える」
 * 複合条件を1クエリで表現しづらいうえ、判定ロジックが
 * circle_allows_university() と二重管理になるため。
 */
export async function listApprovedCircles(
  viewerUniversityId: string | null,
  {
    isStaff = false,
    showOtherUniversities = false,
    myCircleIds = new Set<string>(),
  }: {
    isStaff?: boolean;
    showOtherUniversities?: boolean;
    myCircleIds?: Set<string>;
  } = {},
) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("circles")
    .select(LIST_SELECT)
    .eq("status", "approved")
    .order("name")
    .returns<CircleListItem[]>();

  if (error) {
    console.error("サークル取得に失敗しました:", error.message);
    return {
      circles: [] as CircleListItem[],
      hiddenCount: 0,
      error: error.message,
    };
  }

  // 参加資格のあるものだけに絞る（職員は承認業務のため自大学を全件見る）
  const eligible = (data ?? []).filter((c) =>
    isStaff
      ? c.university_id === viewerUniversityId || c.scope === "public"
      : circleAllowsUniversity(c, viewerUniversityId),
  );

  const isOwn = (c: CircleListItem) =>
    c.university_id === viewerUniversityId || myCircleIds.has(c.id);

  const visible = showOtherUniversities ? eligible : eligible.filter(isOwn);
  const hiddenCount = eligible.length - visible.length;

  // 所属中のサークルを先頭に。一覧の並びに元々意味が無いので、
  // 自分に関係のあるものから読めるようにする。
  const circles = [...visible].sort((x, y) => {
    const mine = Number(myCircleIds.has(y.id)) - Number(myCircleIds.has(x.id));
    return mine !== 0 ? mine : x.name.localeCompare(y.name, "ja");
  });

  return { circles, hiddenCount, error: null };
}

/** 自分が所属（active）しているサークルのID */
export async function getMyCircleIds(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("circle_members")
    .select("circle_id")
    .eq("user_id", userId)
    .eq("status", "active");
  return new Set(
    (data ?? []).map((m) => m.circle_id).filter(Boolean) as string[],
  );
}

/**
 * SQL 側の circle_allows_university() と同じ規則の TypeScript 実装。
 * 一覧の絞り込みに使う。実際の参加可否は DB 関数が最終判定を行う。
 */
export function circleAllowsUniversity(
  circle: Pick<CircleListItem, "scope" | "university_id" | "scoped_universities">,
  universityId: string | null,
) {
  if (circle.scope === "public") return true;
  if (!universityId) return false;
  if (circle.university_id === universityId) return true;
  if (circle.scope === "scoped") {
    return circle.scoped_universities.some(
      (u) => u.university_id === universityId,
    );
  }
  return false;
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
        `id, name, description, status, scope, image_path, university_id, created_at,
         university:universities!circles_university_id_fkey(name),
         scoped_universities:circle_universities(
           university:universities!circle_universities_university_id_fkey(name)
         )`,
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
