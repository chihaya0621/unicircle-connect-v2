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
  campus_id: string | null;
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

export type CirclePublicProfile = {
  /** 一般ユーザー・未ログインの一覧に載せるか */
  public_listed: boolean;
  public_intro: string | null;
  public_schedule: string | null;
  public_contact: string | null;
  /** 主な活動拠点。同じ大学のキャンパスのみ */
  campus_id: string | null;
};

export type CircleDetail = CirclePublicProfile & {
  id: string;
  name: string;
  description: string | null;
  status: ApprovalStatus;
  scope: Scope;
  image_path: string | null;
  university_id: string | null;
  created_at: string;
  university: { name: string } | null;
  campus: { name: string; address: string | null } | null;
  scoped_universities: { university: { name: string } | null }[];
};

const LIST_SELECT = `
  id, name, description, status, scope, image_path, university_id, campus_id,
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
    search = "",
  }: {
    isStaff?: boolean;
    showOtherUniversities?: boolean;
    myCircleIds?: Set<string>;
    search?: string;
  } = {},
) {
  const supabase = await createClient();

  let query = supabase
    .from("circles")
    .select(LIST_SELECT)
    .eq("status", "approved")
    .order("name")
    .limit(CIRCLE_RESULT_LIMIT);

  const clause = searchClause(
    ["name", "description", "public_intro"],
    search,
  );
  if (clause) query = query.or(clause);

  const { data, error } = await query.returns<CircleListItem[]>();

  if (error) {
    console.error("サークル取得に失敗しました:", error.message);
    return {
      circles: [] as CircleListItem[],
      hiddenCount: 0,
      truncated: false,
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

  return {
    circles,
    hiddenCount,
    truncated: (data ?? []).length >= CIRCLE_RESULT_LIMIT,
    error: null,
  };
}

/**
 * 検索語を PostgREST の or 条件にする。
 *
 * ilike のパターンに使う記号は落とす。% や _ を素通しすると
 * 「全部に一致する」検索語を作れてしまい、絞り込みの意味が無くなる。
 * カンマと括弧は or 条件の区切りなので、残すと式そのものが壊れる。
 */
/**
 * 一度に返すサークルの上限。
 *
 * 通常は都道府県 → 大学 と辿るので数十件に収まるが、
 * 上の階層から検索されると全大学が対象になる。
 * 打ち止めにして、絞り込みを促す。
 */
export const CIRCLE_RESULT_LIMIT = 120;

function searchClause(columns: string[], term: string): string | null {
  const safe = term.trim().replace(/[%_,()\\]/g, " ").trim();
  if (!safe) return null;
  return columns.map((c) => `${c}.ilike.%${safe}%`).join(",");
}

/**
 * 一般ユーザー向けの一覧。
 *
 * RLS が scope='public' の承認済みしか返さないので、ここでの絞り込みは
 * 認可ではなく「気にしている大学に寄せる」ためだけのもの。
 * 指定が無いときは全部見せる。最初に来た人に空の画面を出さないため。
 */
export async function listPublicCircles(
  watchedUniversityIds: string[],
  favoriteIds: Set<string> = new Set(),
  /** 拠点で絞る。代表キャンパスなら拠点未設定のものも含める */
  campus?: { id: string; includeUnassigned: boolean },
  search = "",
) {
  const supabase = await createClient();

  let query = supabase
    .from("circles")
    .select(LIST_SELECT)
    .eq("status", "approved")
    .order("name")
    .limit(CIRCLE_RESULT_LIMIT);

  // 名前だけでなく紹介文も対象にする。「初心者歓迎」のような
  // 言葉で探す人が、名前だけの検索では何も見つけられない。
  const clause = searchClause(
    ["name", "description", "public_intro"],
    search,
  );
  if (clause) query = query.or(clause);

  const { data, error } = await query.returns<CircleListItem[]>();

  if (error) {
    console.error("サークル取得に失敗しました:", error.message);
    return {
      circles: [] as CircleListItem[],
      hiddenCount: 0,
      truncated: false,
      error: error.message,
    };
  }

  const all = data ?? [];
  const watched = new Set(watchedUniversityIds);
  const inWatched =
    watched.size === 0
      ? all
      : all.filter((c) => c.university_id && watched.has(c.university_id));

  const visible = campus
    ? inWatched.filter(
        (c) =>
          c.campus_id === campus.id ||
          (campus.includeUnassigned && c.campus_id === null),
      )
    : inWatched;

  // 気になるものを先頭に。並びに元々意味が無いので、
  // 自分で印を付けたものから読めるようにする。
  const circles = [...visible].sort((x, y) => {
    const fav = Number(favoriteIds.has(y.id)) - Number(favoriteIds.has(x.id));
    return fav !== 0 ? fav : x.name.localeCompare(y.name, "ja");
  });

  return {
    circles,
    hiddenCount: all.length - visible.length,
    // 上限に達したなら、絞り込めばもっと出てくる可能性がある
    truncated: all.length >= CIRCLE_RESULT_LIMIT,
    error: null,
  };
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

/**
 * サークル1件。取得できなければ null。
 *
 * エラーは握り潰さずに記録する。クエリが失敗したときと本当に
 * 存在しないときの区別が付かないと、呼び出し側が一律 404 を返し、
 * 原因の分からない「全部 404」になる（列を足したのに
 * マイグレーションが未適用、といった場合がこれに当たる）。
 */
export const getCircle = cache(
  async (circleId: string): Promise<CircleDetail | null> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("circles")
      .select(
        `id, name, description, status, scope, image_path, university_id, created_at,
         public_listed, public_intro, public_schedule, public_contact, campus_id,
         university:universities!circles_university_id_fkey(name),
         campus:campuses!circles_campus_id_fkey(name, address),
         scoped_universities:circle_universities(
           university:universities!circle_universities_university_id_fkey(name)
         )`,
      )
      .eq("id", circleId)
      .maybeSingle()
      .returns<CircleDetail>();

    if (error) {
      console.error(
        `サークル(${circleId})の取得に失敗しました:`,
        error.message,
      );
      return null;
    }
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
