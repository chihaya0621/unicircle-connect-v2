import "server-only";

import type { EventVisibility, UserRole } from "@/lib/database.types";
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
  host_university_id: string | null;
  host_circle_id: string | null;
  host_university: { name: string } | null;
  host_circle: { name: string } | null;
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
export function eventHost(event: EventListItem): EventHost {
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
  host_university_id,
  host_circle_id,
  host_university:universities!events_host_university_id_fkey(name),
  host_circle:circles!events_host_circle_id_fkey(name)
` as const;

/**
 * ロールに応じた可視範囲でイベントを取得する。
 *
 * - general / 未ログイン: visibility = 'public' のみ
 * - student / staff:      学内限定を含む全件
 *
 * 開発環境の RLS は全許可 (`true`) のため、この絞り込みが実質的な
 * アクセス制御になっている。本番では同等のルールを RLS ポリシー側にも
 * 実装しないと、API を直接叩かれた際に学内限定イベントが漏れる。
 */
export async function listVisibleEvents(role: UserRole | null) {
  const supabase = await createClient();

  let query = supabase
    .from("events")
    .select(EVENT_SELECT)
    .gte("event_date", new Date().toISOString())
    .order("event_date", { ascending: true })
    .limit(50);

  if (role === null || role === "general") {
    query = query.eq("visibility", "public");
  }

  const { data, error } = await query.returns<EventListItem[]>();

  if (error) {
    // 画面全体を落とさず、空一覧＋エラー表示にフォールバックする
    console.error("イベント取得に失敗しました:", error.message);
    return { events: [] as EventListItem[], error: error.message };
  }

  return { events: data ?? [], error: null };
}
