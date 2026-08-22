import "server-only";

import type { UserRole } from "@/lib/database.types";
import { createClient } from "@/lib/supabase-server";
import type { EventSource } from "@/lib/event-sources";
import {
  eventHost,
  eventVisibleTo,
  type EventHostFields,
  type EventListItem,
} from "@/lib/events";

export type CalendarEvent = EventListItem & {
  source: EventSource;
  host_circle_university_id: string | null;
  /** 主催団体の表示名。どの団体のイベントか一目で分かるようにする。 */
  host_name: string;
  host_kind: "university" | "circle";
};

export type CalendarFilters = {
  /** 他大学の公式イベントを表示する大学ID。チェックリストで選ぶ。 */
  universities: string[];
  /** 自大学の未所属サークルの公開イベントを表示するか */
  showUnjoinedCircles: boolean;
  /** 検索語。指定時のみ他大学のサークル公開イベントも対象に含める。 */
  search: string;
};

const CALENDAR_SELECT = `
  id, title, description, event_date, visibility, target_grades, image_path,
  host_university_id, host_circle_id,
  host_university:universities!events_host_university_id_fkey(name),
  host_circle:circles!events_host_circle_id_fkey(name, university_id),
  scoped_universities:event_universities(university_id)
` as const;

/**
 * 指定した期間のイベントを、閲覧者の文脈に合わせて取得する。
 *
 * 方針（要件より）:
 *   既定で出す … 自大学主催 / 所属サークル主催 / 参加確定
 *   設定で出す … 他大学主催（選択した大学のみ）/ 自大学の未所属サークル
 *   検索時のみ … 他大学のサークルの公開イベント
 *
 * 一般ユーザーだけは別扱いにする。所属大学もサークルも参加登録も
 * 持たないため、上の分類はどれ一つ成立せず、何も表示されなくなる。
 * 指定した大学の公開イベントを「公開」の一種類として出す。
 *
 * 絞り込みはアプリ側で行う。分類ごとに条件が異なり、PostgREST の
 * 単一クエリでは表現しづらいうえ、可視判定 (eventVisibleTo) と
 * 二重管理になるのを避けたいため。
 */
export async function listCalendarEvents({
  userId,
  role,
  universityId,
  from,
  to,
  filters,
}: {
  userId: string;
  role: UserRole;
  universityId: string | null;
  from: Date;
  to: Date;
  filters: CalendarFilters;
}) {
  const supabase = await createClient();

  // 所属サークル（active）と参加確定イベントを先に引く
  const [{ data: memberships }, { data: participations }] = await Promise.all([
    supabase
      .from("circle_members")
      .select("circle_id")
      .eq("user_id", userId)
      .eq("status", "active"),
    supabase
      .from("event_participants")
      .select("event_id")
      .eq("user_id", userId)
      .eq("status", "going"),
  ]);

  const myCircleIds = new Set(
    (memberships ?? []).map((m) => m.circle_id).filter(Boolean) as string[],
  );
  const joinedIds = new Set(
    (participations ?? []).map((p) => p.event_id).filter(Boolean) as string[],
  );

  const { data, error } = await supabase
    .from("events")
    .select(CALENDAR_SELECT)
    .gte("event_date", from.toISOString())
    .lt("event_date", to.toISOString())
    .order("event_date")
    .returns<
      (EventListItem & {
        host_circle: { name: string; university_id: string | null } | null;
      })[]
    >();

  if (error) {
    console.error("カレンダーの取得に失敗しました:", error.message);
    return { events: [] as CalendarEvent[], error: error.message };
  }

  const search = filters.search.trim().toLowerCase();
  const selectedUniversities = new Set(filters.universities);

  const events: CalendarEvent[] = [];

  for (const e of data ?? []) {
    // まず「そもそも見えるか」を判定する。ここを通らないものは
    // どの設定を有効にしても表示しない。
    const visible =
      role === "general"
        ? e.visibility === "public"
        : eventVisibleTo(e, universityId);
    if (!visible) continue;

    const hostCircleUniversity = e.host_circle?.university_id ?? null;
    const matchesSearch =
      search.length > 0 &&
      (e.title.toLowerCase().includes(search) ||
        (e.description ?? "").toLowerCase().includes(search));

    let source: EventSource | null = null;

    if (role === "general") {
      // 大学主催・サークル主催のどちらも、主管の大学で絞る。
      // 指定が無いうちは全部見せる（空の画面を出さないため）。
      const hostUniversity = e.host_university_id ?? hostCircleUniversity;
      const inScope =
        selectedUniversities.size === 0 ||
        (hostUniversity !== null && selectedUniversities.has(hostUniversity));
      if (inScope || matchesSearch) source = "public";
    } else if (joinedIds.has(e.id)) {
      source = "joined";
    } else if (e.host_circle_id && myCircleIds.has(e.host_circle_id)) {
      source = "my-circle";
    } else if (e.host_university_id && e.host_university_id === universityId) {
      source = "own-university";
    } else if (e.host_circle_id && hostCircleUniversity === universityId) {
      // 自大学の未所属サークル。設定で表示を有効にしたときだけ。
      if (filters.showUnjoinedCircles) source = "unjoined-circle";
    } else if (
      e.host_university_id &&
      selectedUniversities.has(e.host_university_id)
    ) {
      source = "other-university";
    } else if (e.host_circle_id && hostCircleUniversity) {
      // 他大学のサークルの公開イベントは既定では出さない。
      // 検索したときだけ結果に現れる。
      if (matchesSearch) source = "other-university";
    }

    // 検索語があるときは、分類に関わらず一致したものを拾う。
    // 「検索で見つけたい」という意図を、既定の絞り込みより優先する。
    if (!source && matchesSearch) source = "other-university";
    if (!source) continue;

    // 検索語があるときは一致しないものを落とす
    if (search.length > 0 && !matchesSearch) continue;

    const host = eventHost(e);
    events.push({
      ...e,
      source,
      host_circle_university_id: hostCircleUniversity,
      host_name: host.name,
      host_kind: host.kind,
    });
  }

  return { events, error: null };
}

/** カードデッキに載せる、直近の参加予定。Client Component へ渡すので素の値だけにする */
export type UpcomingEvent = {
  id: string;
  title: string;
  event_date: string;
  image_path: string | null;
  host_name: string;
  host_kind: "university" | "circle";
};

type UpcomingRow = EventHostFields & {
  id: string;
  title: string;
  event_date: string;
  image_path: string | null;
};

/**
 * 自分が参加登録している、これから開かれるイベントを近い順に取得する。
 *
 * event_participants は RLS で自分の行しか読めないので、
 * まず ID を集めてからイベント本体を引く二段構えにしている。
 * 埋め込み側の並び順で上位N件を取る書き方は PostgREST では素直に書けない。
 */
export async function listUpcomingJoinedEvents(
  userId: string,
  limit = 5,
): Promise<UpcomingEvent[]> {
  const supabase = await createClient();

  const { data: participations, error: joinError } = await supabase
    .from("event_participants")
    .select("event_id")
    .eq("user_id", userId)
    .eq("status", "going");

  if (joinError) {
    console.error("参加予定の取得に失敗しました:", joinError.message);
    return [];
  }

  const ids = (participations ?? [])
    .map((p) => p.event_id)
    .filter((id): id is string => Boolean(id));

  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from("events")
    .select(
      `id, title, event_date, image_path,
       host_university_id, host_circle_id,
       host_university:universities!events_host_university_id_fkey(name),
       host_circle:circles!events_host_circle_id_fkey(name, university_id)`,
    )
    .in("id", ids)
    .gte("event_date", new Date().toISOString())
    .order("event_date", { ascending: true })
    .limit(limit)
    .returns<UpcomingRow[]>();

  if (error) {
    console.error("参加予定の取得に失敗しました:", error.message);
    return [];
  }

  return (data ?? []).map((e) => {
    const host = eventHost(e);
    return {
      id: e.id,
      title: e.title,
      event_date: e.event_date,
      image_path: e.image_path,
      host_name: host.name,
      host_kind: host.kind,
    };
  });
}
