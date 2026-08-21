import "server-only";

import type { EventVisibility, UserRole } from "@/lib/database.types";
import type { EventRelation } from "@/lib/event-sources";
import { createClient } from "@/lib/supabase-server";

/**
 * 一覧表示に必要なイベント項目。
 * 主催者名は埋め込みリソースとして1クエリで取得する。
 */
export type EventListItem = {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  visibility: EventVisibility;
  target_grades: string[] | null;
  image_path: string | null;
  host_university_id: string | null;
  host_circle_id: string | null;
  host_university: { name: string } | null;
  /** サークル主催の場合、そのサークルの所属大学も併せて取得する */
  host_circle: { name: string; university_id: string | null } | null;
  scoped_universities: { university_id: string }[];
};

export type EventHost =
  | { kind: "university"; name: string }
  | { kind: "circle"; name: string };

/**
 * 排他的関連 (Exclusive Arc) を安全に解決する。
 *
 * events_host_check により host_university_id と host_circle_id は
 * ちょうど片方だけが NOT NULL であることが DB 側で保証されている。
 * ただし埋め込みリソース側は参照先が消えていれば null になり得るため、
 * 名前が取れないケースにもフォールバックを用意している。
 */
/** eventHost が実際に読む項目だけ。一覧用の全項目を揃えなくても呼べるようにする */
export type EventHostFields = Pick<
  EventListItem,
  "host_university_id" | "host_university" | "host_circle"
>;

export function eventHost(event: EventHostFields): EventHost {
  if (event.host_university_id) {
    return { kind: "university", name: event.host_university?.name ?? "大学" };
  }
  return { kind: "circle", name: event.host_circle?.name ?? "サークル" };
}

const EVENT_SELECT = `
  id,
  title,
  description,
  event_date,
  visibility,
  target_grades,
  image_path,
  host_university_id,
  host_circle_id,
  host_university:universities!events_host_university_id_fkey(name),
  host_circle:circles!events_host_circle_id_fkey(name, university_id),
  scoped_universities:event_universities(university_id)
` as const;

/**
 * SQL 側の考え方と揃えた可視判定。
 *
 *   public   … 誰でも
 *   scoped   … event_universities に列挙された大学、または主催大学
 *   internal … 主催大学のみ
 *
 * サークル主催の internal / scoped イベントは、主催サークルの
 * 所属大学を主催大学とみなす（host_circle_university_id）。
 */
export function eventVisibleTo(
  event: EventListItem,
  universityId: string | null,
) {
  if (event.visibility === "public") return true;
  if (!universityId) return false;

  const hostUniversity =
    event.host_university_id ?? event.host_circle?.university_id ?? null;

  if (hostUniversity === universityId) return true;

  if (event.visibility === "scoped") {
    return event.scoped_universities.some(
      (u) => u.university_id === universityId,
    );
  }
  return false;
}

/**
 * ロールと所属大学に応じた可視範囲でイベントを取得する。
 *
 * - general / 未ログイン: visibility = 'public' のみ
 * - student / staff:      public + 自大学の internal + 対象に含まれる scoped
 *
 * 開発環境の RLS は全許可 (`true`) のため、この絞り込みが実質的な
 * アクセス制御になっている。本番では同等のルールを RLS ポリシー側にも
 * 実装しないと、API を直接叩かれた際に学内限定イベントが漏れる。
 */
/** 1ページに並べる件数 */
export const EVENTS_PER_PAGE = 20;

/**
 * 閲覧者に見えるイベントを、開催日の近い順に1ページぶん返す。
 *
 * 絞り込みはすべて SQL 側で行う。アプリ側で間引くと、間引く前の件数で
 * ページを切ることになり、ページ番号と中身が食い違う。
 *
 * 公開範囲（internal / scoped）の判定は RLS の events_select が
 * そのまま行うので、ここでは重ねない。実データで両者の結果が
 * 一致することを確認済み（74件 = 74件）。
 * eventVisibleTo は詳細ページの単体判定に残している。
 */
export async function listVisibleEvents(
  role: UserRole | null,
  {
    page = 1,
    perPage = EVENTS_PER_PAGE,
    watchedUniversityIds = [],
  }: {
    page?: number;
    perPage?: number;
    /** 一般ユーザーが指定した大学。空なら絞らない */
    watchedUniversityIds?: string[];
  } = {},
) {
  const supabase = await createClient();
  const current = Math.max(1, page);
  const from = (current - 1) * perPage;

  let query = supabase
    .from("events")
    .select(EVENT_SELECT, { count: "exact" })
    .gte("event_date", new Date().toISOString())
    .order("event_date", { ascending: true })
    .range(from, from + perPage - 1);

  if (role === null || role === "general") {
    query = query.eq("visibility", "public");
  }

  // 未ログインには、大学主催かつ学外向けに立てられたものだけを出す。
  // 防災訓練や図書館ガイダンスまで並ぶと、探しているものに辿り着けない。
  if (role === null) {
    query = query
      .not("host_university_id", "is", null)
      .eq("public_listed", true);
  }

  // 一般ユーザーが大学を指定していれば、その大学のものに寄せる。
  // サークル主催は host_circle_id しか持たないので、対象大学の
  // サークルを引いてから ID で絞る。指定は20校までなので、
  // ここで組み立てる条件の長さは頭打ちになる。
  if (role === "general" && watchedUniversityIds.length > 0) {
    const { data: circles } = await supabase
      .from("circles")
      .select("id")
      .in("university_id", watchedUniversityIds);

    const clauses = [`host_university_id.in.(${watchedUniversityIds.join(",")})`];
    const circleIds = (circles ?? []).map((c) => c.id);
    if (circleIds.length > 0) {
      clauses.push(`host_circle_id.in.(${circleIds.join(",")})`);
    }
    query = query.or(clauses.join(","));
  }

  const { data, error, count } = await query.returns<EventListItem[]>();

  if (error) {
    // 画面全体を落とさず、空一覧＋エラー表示にフォールバックする
    console.error("イベント取得に失敗しました:", error.message);
    return {
      events: [] as EventListItem[],
      total: 0,
      page: current,
      perPage,
      error: error.message,
    };
  }

  return {
    events: data ?? [],
    total: count ?? 0,
    page: current,
    perPage,
    error: null,
  };
}

/**
 * 自分がイベントを主催できるサークル。
 * サークルイベントを作れるのは、承認済みサークルの管理者のみ。
 */
export async function listHostableCircles(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("circle_members")
    .select(`circle:circles!circle_members_circle_id_fkey(id, name, status)`)
    .eq("user_id", userId)
    .eq("role", "admin")
    .eq("status", "active")
    .returns<{ circle: { id: string; name: string; status: string } | null }[]>();

  return (data ?? [])
    .map((m) => m.circle)
    .filter(
      (c): c is { id: string; name: string; status: string } =>
        c !== null && c.status === "approved",
    );
}

export type EventDetail = EventListItem & {
  created_at: string;
  scoped_university_names: { university: { name: string } | null }[];
};

export async function getEvent(eventId: string): Promise<EventDetail | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("events")
    .select(
      `${EVENT_SELECT},
       created_at,
       scoped_university_names:event_universities(
         university:universities!event_universities_university_id_fkey(name)
       )`,
    )
    .eq("id", eventId)
    .maybeSingle()
    .returns<EventDetail>();
  return data ?? null;
}

/**
 * 閲覧者がそのイベントを削除できるか。
 * 大学主催なら同じ大学の職員、サークル主催ならそのサークルの管理者。
 * 最終判定は delete_event 側で行うので、ここはボタンの出し分け用。
 */
export async function canManageEvent(
  event: Pick<EventListItem, "host_university_id" | "host_circle_id">,
  userId: string,
  universityId: string | null,
  role: UserRole,
) {
  if (event.host_circle_id) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("circle_members")
      .select("role, status")
      .eq("circle_id", event.host_circle_id)
      .eq("user_id", userId)
      .maybeSingle();
    return data?.role === "admin" && data.status === "active";
  }
  return role === "staff" && event.host_university_id === universityId;
}

/**
 * そのサークルが主催する、これからのイベント。
 *
 * サークルのページに「次の予定」を出すために使う。
 * RLS が効くので、閲覧者に見えないイベントは最初から返らない。
 */
export async function listUpcomingCircleEvents(circleId: string, limit = 1) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("events")
    .select(EVENT_SELECT)
    .eq("host_circle_id", circleId)
    .gte("event_date", new Date().toISOString())
    .order("event_date", { ascending: true })
    .limit(limit)
    .returns<EventListItem[]>();
  return data ?? [];
}

/**
 * そのサークルが主催した、終了済みのイベント。
 * 活動の記録として新しい順に返す。
 */
export async function listPastCircleEvents(circleId: string, limit = 20) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("events")
    .select(EVENT_SELECT)
    .eq("host_circle_id", circleId)
    .lt("event_date", new Date().toISOString())
    .order("event_date", { ascending: false })
    .limit(limit)
    .returns<EventListItem[]>();
  return data ?? [];
}

/**
 * 閲覧者から見た各イベントの関係を求める。
 *
 * 一覧は時系列で並べたままにして、色分けだけで目立たせる。
 * 並べ替えると「次に何があるか」が読み取れなくなるため。
 * 絞り込みはカレンダー側の役割。
 */
export async function resolveEventRelations(
  userId: string,
  events: Pick<EventListItem, "id" | "host_circle_id">[],
): Promise<Map<string, EventRelation>> {
  const relations = new Map<string, EventRelation>();
  if (events.length === 0) return relations;

  const supabase = await createClient();
  const [{ data: joined }, { data: memberships }] = await Promise.all([
    supabase
      .from("event_participants")
      .select("event_id")
      .eq("user_id", userId)
      .eq("status", "going")
      .in(
        "event_id",
        events.map((e) => e.id),
      ),
    supabase
      .from("circle_members")
      .select("circle_id")
      .eq("user_id", userId)
      .eq("status", "active"),
  ]);

  const joinedIds = new Set((joined ?? []).map((j) => j.event_id));
  const myCircles = new Set(
    (memberships ?? []).map((m) => m.circle_id).filter(Boolean) as string[],
  );

  for (const e of events) {
    if (joinedIds.has(e.id)) relations.set(e.id, "joined");
    else if (e.host_circle_id && myCircles.has(e.host_circle_id))
      relations.set(e.id, "my-circle");
    else relations.set(e.id, "other");
  }
  return relations;
}

/**
 * そのイベントに自分が仕掛けているリマインド。未設定なら null。
 *
 * RLS で自分の行しか読めないので、利用者の絞り込みは不要。
 */
export async function getMyEventReminder(
  eventId: string,
): Promise<number | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("event_reminders")
    .select("lead_minutes")
    .eq("event_id", eventId)
    .maybeSingle();

  if (error) {
    console.error("リマインドの取得に失敗しました:", error.message);
    return null;
  }
  return data?.lead_minutes ?? null;
}
