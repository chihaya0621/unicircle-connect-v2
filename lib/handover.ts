import "server-only";

import type { HandoverStatus } from "@/lib/database.types";
import { createClient } from "@/lib/supabase-server";

/**
 * 代表の引き継ぎ（0030）。
 *
 * 読める範囲は RLS が決める。申し送りには内輪の事情が書かれうるので、
 * そのサークルのメンバーと大学の職員以外には1件も返らない。
 */
export type Handover = {
  id: string;
  circle_id: string;
  from_user_id: string | null;
  to_user_id: string | null;
  from_name: string;
  to_name: string;
  note: string | null;
  status: HandoverStatus;
  term_year: number;
  created_at: string;
  decided_at: string | null;
};

const COLUMNS =
  "id, circle_id, from_user_id, to_user_id, from_name, to_name, note, status, term_year, created_at, decided_at";

/** 処理中の申し出。同時に1件までなので、あっても1つ */
export async function getPendingHandover(
  circleId: string,
): Promise<Handover | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("circle_handovers")
    .select(COLUMNS)
    .eq("circle_id", circleId)
    .eq("status", "pending")
    .maybeSingle<Handover>();

  if (error) {
    console.error("引き継ぎの取得に失敗しました:", error.message);
    return null;
  }
  return data;
}

/**
 * これまでの代替わり。新しい順。
 *
 * 断られた申し出も残す。次の代に「一度断られた経緯」が伝わることに
 * 意味がある。取り下げたものは出さない（申し出た側の操作ミスも混ざる）。
 */
export async function listHandovers(circleId: string): Promise<Handover[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("circle_handovers")
    .select(COLUMNS)
    .eq("circle_id", circleId)
    .in("status", ["accepted", "declined"])
    .order("created_at", { ascending: false })
    .returns<Handover[]>();

  if (error) {
    console.error("引き継ぎの履歴の取得に失敗しました:", error.message);
    return [];
  }
  return data ?? [];
}

/**
 * いまの代が最初に読む申し送り。
 *
 * 成立した引き継ぎのうち、いちばん新しいもの1件。
 * 代が替わるたびに置き換わるので、常に「前の代からの伝言」になる。
 */
export async function getCurrentNote(
  circleId: string,
): Promise<Handover | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("circle_handovers")
    .select(COLUMNS)
    .eq("circle_id", circleId)
    .eq("status", "accepted")
    .not("note", "is", null)
    .order("decided_at", { ascending: false })
    .limit(1)
    .maybeSingle<Handover>();
  return data;
}

/** いまの年度。4月はじまり */
export function currentTermYear(at: Date = new Date()): number {
  // 日本時間で判定する。サーバーの時間帯に引きずられると、
  // 3月末と4月頭の境目で年度がずれる
  const jst = new Date(at.getTime() + 9 * 3600 * 1000);
  const y = jst.getUTCFullYear();
  return jst.getUTCMonth() + 1 >= 4 ? y : y - 1;
}

/**
 * 今年度まだ代替わりしていないサークル（職員向け）。
 *
 * 年度が替わっても代表が前のままだと、卒業した人がサークルを
 * 握ったままになる。職員が気づけるよう一覧にする。
 */
export async function listStaleCircles(universityId: string | null) {
  if (!universityId) return [];
  const supabase = await createClient();
  const year = currentTermYear();

  const { data, error } = await supabase
    .from("circles")
    .select("id, name, term_year")
    .eq("university_id", universityId)
    .eq("status", "approved")
    .or(`term_year.is.null,term_year.lt.${year}`)
    .order("name")
    .returns<{ id: string; name: string; term_year: number | null }[]>();

  if (error) {
    console.error("代替わりの確認に失敗しました:", error.message);
    return [];
  }
  return data ?? [];
}
