import "server-only";

import { cache } from "react";

import type {
  CircleStatus,
  CircleRole,
  MembershipStatus,
  Scope,
  UserRole,
} from "@/lib/database.types";
import { createClient } from "@/lib/supabase-server";
import type { CircleCategory } from "@/lib/circle-categories";
import type { DirectoryEntry } from "@/lib/discovery";

export type CircleListItem = {
  id: string;
  name: string;
  description: string | null;
  status: CircleStatus;
  scope: Scope;
  image_path: string | null;
  university_id: string | null;
  campus_id: string | null;
  /** 分野（0033） */
  category: string | null;
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
  /** 分野（0033） */
  category: string | null;
};

export type CircleDetail = CirclePublicProfile & {
  id: string;
  name: string;
  description: string | null;
  status: CircleStatus;
  scope: Scope;
  image_path: string | null;
  university_id: string | null;
  created_at: string;
  /** 廃止を申請した日時。承認が揃うまで status は動かさない */
  closure_requested_at: string | null;
  /** いまの代が引き継いだ年度。null は設立の代のまま（0030） */
  term_year: number | null;
  university: { name: string; website_url: string | null } | null;
  campus: { name: string; address: string | null } | null;
  scoped_universities: {
    university_id: string;
    university: { name: string } | null;
  }[];
};

const LIST_SELECT = `
  id, name, description, status, scope, image_path, university_id, campus_id,
  category,
  university:universities!circles_university_id_fkey(name),
  member_count:circle_members(count),
  scoped_universities:circle_universities(university_id)
` as const;

/**
 * 一度に返すサークルの上限。
 *
 * 通常は都道府県 → 大学 と辿るので数十件に収まるが、
 * 上の階層から検索されると全大学が対象になる。
 * 打ち止めにして、絞り込みを促す。
 *
 * 上限は、絞り込みを問い合わせに入れたあとで掛ける。先に全国から
 * 上限まで取ってからアプリで絞ると、上限の外のサークルが黙って消える。
 * 実際に、9件ある大学を選んでも1件しか出ないことがあった。
 */
export const CIRCLE_RESULT_LIMIT = 120;

/** 何にも一致させない条件。id は主キーなので NULL にならない */
const MATCH_NOTHING = "id.is.null";

/**
 * どこのサークルを出すか。問い合わせの時点で絞るための範囲。
 */
export type CircleArea =
  | { kind: "all" }
  /** 大学で絞る。一般ユーザーが指定した「気になる大学」 */
  | { kind: "universities"; universityIds: string[] }
  /** 拠点で絞る。拠点未設定のサークルは unassignedOf の大学のぶんだけ含める */
  | { kind: "campuses"; campusIds: string[]; unassignedOf: string[] };

/**
 * 都道府県 → 大学（拠点）と辿った先の範囲。
 *
 * 札の件数（listCampusDirectory）と同じ数え方にそろえる。拠点に属する
 * サークルと、代表拠点なら拠点未設定のサークル。拠点の無い大学は
 * 代表として扱われるので、その大学のサークルが全部入る。
 */
export function areaOfDirectory(entries: DirectoryEntry[]): CircleArea {
  return {
    kind: "campuses",
    campusIds: entries.flatMap((e) => (e.campusId ? [e.campusId] : [])),
    unassignedOf: entries.flatMap((e) => (e.isPrimary ? [e.universityId] : [])),
  };
}

function areaFilter(area: CircleArea): string | null {
  switch (area.kind) {
    case "all":
      return null;
    case "universities":
      return area.universityIds.length > 0
        ? `university_id.in.(${area.universityIds.join(",")})`
        : MATCH_NOTHING;
    case "campuses": {
      const parts = [
        area.campusIds.length > 0 &&
          `campus_id.in.(${area.campusIds.join(",")})`,
        area.unassignedOf.length > 0 &&
          `and(campus_id.is.null,university_id.in.(${area.unassignedOf.join(",")}))`,
      ].filter(Boolean);
      return parts.length > 0 ? parts.join(",") : MATCH_NOTHING;
    }
  }
}

function idsFilter(ids: Set<string>): string {
  return ids.size > 0 ? `id.in.(${[...ids].join(",")})` : MATCH_NOTHING;
}

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
 * 「自大学か所属中か」は問い合わせで絞る。参加資格の判定はアプリ側で行う。
 * PostgREST では「scope 別に条件を変える」複合条件を1クエリで表現しづらいうえ、
 * 判定ロジックが circle_allows_university() と二重管理になるため。
 */
export async function listApprovedCircles(
  viewerUniversityId: string | null,
  {
    isStaff = false,
    showOtherUniversities = false,
    myCircleIds = new Set<string>(),
    search = "",
    category = null,
    onlyIds,
  }: {
    isStaff?: boolean;
    showOtherUniversities?: boolean;
    myCircleIds?: Set<string>;
    search?: string;
    /** 分野で絞る（0033）。null なら全部 */
    category?: CircleCategory | null;
    /** この ID だけを出す（気になるのみ）。大学は問わない */
    onlyIds?: Set<string>;
  } = {},
) {
  const supabase = await createClient();

  const clause = searchClause(
    ["name", "description", "public_intro"],
    search,
  );
  const ownOnly = !showOtherUniversities && !onlyIds;
  const ownFilter =
    [
      viewerUniversityId && `university_id.eq.${viewerUniversityId}`,
      myCircleIds.size > 0 && `id.in.(${[...myCircleIds].join(",")})`,
    ]
      .filter(Boolean)
      .join(",") || MATCH_NOTHING;

  let query = supabase
    .from("circles")
    .select(LIST_SELECT)
    .eq("status", "approved")
    .order("name")
    .limit(CIRCLE_RESULT_LIMIT + 1);
  if (clause) query = query.or(clause);
  if (category) query = query.eq("category", category);
  if (onlyIds) query = query.or(idsFilter(onlyIds));
  if (ownOnly) query = query.or(ownFilter);

  // 畳んでいる他大学のサークルの数。参加資格の判定に要る列だけを取って数える
  let others = supabase
    .from("circles")
    .select("id, scope, university_id, scoped_universities:circle_universities(university_id)")
    .eq("status", "approved");
  if (clause) others = others.or(clause);
  if (category) others = others.eq("category", category);
  if (viewerUniversityId) others = others.neq("university_id", viewerUniversityId);

  const [{ data, error }, hidden] = await Promise.all([
    query.returns<CircleListItem[]>(),
    ownOnly
      ? others.returns<
          Pick<CircleListItem, "id" | "scope" | "university_id" | "scoped_universities">[]
        >()
      : null,
  ]);

  if (error) {
    console.error("サークル取得に失敗しました:", error.message);
    return {
      circles: [] as CircleListItem[],
      hiddenCount: 0,
      truncated: false,
      error: error.message,
    };
  }

  const rows = data ?? [];
  const truncated = rows.length > CIRCLE_RESULT_LIMIT;

  // 参加資格のあるものだけに絞る（職員は承認業務のため自大学を全件見る）
  const eligibleFor = (
    c: Pick<CircleListItem, "scope" | "university_id" | "scoped_universities">,
  ) =>
    isStaff
      ? c.university_id === viewerUniversityId || c.scope === "public"
      : circleAllowsUniversity(c, viewerUniversityId);

  const visible = rows.slice(0, CIRCLE_RESULT_LIMIT).filter(eligibleFor);
  const hiddenCount = (hidden?.data ?? []).filter(
    (c) => !myCircleIds.has(c.id) && eligibleFor(c),
  ).length;

  // 所属中のサークルを先頭に。一覧の並びに元々意味が無いので、
  // 自分に関係のあるものから読めるようにする。
  const circles = [...visible].sort((x, y) => {
    const mine = Number(myCircleIds.has(y.id)) - Number(myCircleIds.has(x.id));
    return mine !== 0 ? mine : x.name.localeCompare(y.name, "ja");
  });

  return { circles, hiddenCount, truncated, error: null };
}

/**
 * 検索語を PostgREST の or 条件にする。
 *
 * ilike のパターンに使う記号は落とす。% や _ を素通しすると
 * 「全部に一致する」検索語を作れてしまい、絞り込みの意味が無くなる。
 * カンマと括弧は or 条件の区切りなので、残すと式そのものが壊れる。
 */
function searchClause(columns: string[], term: string): string | null {
  const safe = term.trim().replace(/[%_,()\\]/g, " ").trim();
  if (!safe) return null;
  return columns.map((c) => `${c}.ilike.%${safe}%`).join(",");
}

/**
 * 一般ユーザー・未ログイン向けの一覧。
 *
 * RLS が scope='public' の承認済みしか返さないので、ここでの絞り込みは
 * 認可ではなく「見たい範囲に寄せる」ためだけのもの。
 * 範囲の指定が無いときは全部見せる。最初に来た人に空の画面を出さないため。
 */
export async function listPublicCircles({
  area = { kind: "all" },
  favoriteIds = new Set<string>(),
  onlyIds,
  search = "",
  category = null,
}: {
  area?: CircleArea;
  /** 印を付けたものを先頭に並べる */
  favoriteIds?: Set<string>;
  /** この ID だけを出す（気になるのみ） */
  onlyIds?: Set<string>;
  search?: string;
  /** 分野で絞る（0033）。null なら全部 */
  category?: CircleCategory | null;
} = {}) {
  const supabase = await createClient();

  let query = supabase
    .from("circles")
    .select(LIST_SELECT)
    .eq("status", "approved")
    .order("name")
    .limit(CIRCLE_RESULT_LIMIT + 1);

  // 名前だけでなく紹介文も対象にする。「初心者歓迎」のような
  // 言葉で探す人が、名前だけの検索では何も見つけられない。
  const clause = searchClause(
    ["name", "description", "public_intro"],
    search,
  );
  if (clause) query = query.or(clause);
  if (category) query = query.eq("category", category);
  const inArea = areaFilter(area);
  if (inArea) query = query.or(inArea);
  if (onlyIds) query = query.or(idsFilter(onlyIds));

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

  const rows = data ?? [];

  // 気になるものを先頭に。並びに元々意味が無いので、
  // 自分で印を付けたものから読めるようにする。
  const circles = rows.slice(0, CIRCLE_RESULT_LIMIT).sort((x, y) => {
    const fav = Number(favoriteIds.has(y.id)) - Number(favoriteIds.has(x.id));
    return fav !== 0 ? fav : x.name.localeCompare(y.name, "ja");
  });

  return {
    circles,
    hiddenCount: 0,
    // 上限を超えたなら、絞り込めばもっと出てくる
    truncated: rows.length > CIRCLE_RESULT_LIMIT,
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
         category, closure_requested_at, term_year,
         university:universities!circles_university_id_fkey(name, website_url),
         campus:campuses!circles_campus_id_fkey(name, address),
         scoped_universities:circle_universities(
           university_id,
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
        circle: { id: string; name: string; status: CircleStatus } | null;
      }[]
    >();
  return data ?? [];
}

/**
 * 廃止の申請が出ているサークル。職員の承認キュー用。
 *
 * 申請中も status は 'approved' のままなので、
 * closure_requested_at の有無で拾う。
 */
export async function listClosureRequests(universityId: string | null) {
  if (!universityId) return [] as CircleListItem[];

  const supabase = await createClient();
  const { data } = await supabase
    .from("circles")
    .select(LIST_SELECT)
    .eq("university_id", universityId)
    .not("closure_requested_at", "is", null)
    .order("closure_requested_at")
    .returns<CircleListItem[]>();

  return data ?? [];
}
