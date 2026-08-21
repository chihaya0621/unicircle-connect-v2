import "server-only";

import { createClient } from "@/lib/supabase-server";

/**
 * 公開情報の探索まわり。
 *
 * 一般ユーザー（高校生・企業）は所属大学を持たないので、
 * 「何を既定で見せるか」の手がかりが本人の指定しかない。
 * ここではその指定と、気になるサークルの控えを読む。
 *
 * どちらも RLS で自分の行しか読めないので、
 * 呼び出し側で利用者を絞る必要はない。
 */

/** 気にしている大学の ID。未指定なら空配列 */
export async function listWatchedUniversityIds(): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("watched_universities")
    .select("university_id");

  if (error) {
    console.error("指定大学の取得に失敗しました:", error.message);
    return [];
  }
  return (data ?? []).map((row) => row.university_id);
}

/** 気になるサークルの ID。カードの状態表示に使う */
export async function listFavoriteCircleIds(): Promise<Set<string>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("circle_favorites")
    .select("circle_id");

  if (error) {
    console.error("気になるサークルの取得に失敗しました:", error.message);
    return new Set();
  }
  return new Set((data ?? []).map((row) => row.circle_id));
}

/** 大学の選択肢。指定パネルと絞り込みで共有する */
export async function listUniversities() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("universities")
    .select("id, name")
    .order("name");
  return data ?? [];
}

export type UniversitySummary = {
  id: string;
  name: string;
  name_kana: string | null;
  prefecture: string | null;
  website_url: string | null;
  /** その閲覧者に見えるサークルの数 */
  circleCount: number;
};

/**
 * 大学の一覧に、公開サークルの件数を添えて返す。
 *
 * 件数は SQL の集約ではなくアプリ側で数える。RLS が閲覧者ごとに
 * 見える行を変えるので、埋め込み集約だと「見えないサークルまで
 * 数に入る」形になりかねない。素の行を引いて数えれば、
 * 数と一覧が必ず一致する。
 *
 * 大学数は多くても数百件なので、まとめて引いて構わない。
 */
export async function listUniversityDirectory(): Promise<UniversitySummary[]> {
  const supabase = await createClient();

  const [{ data: universities }, { data: circles }] = await Promise.all([
    supabase
      .from("universities")
      .select("id, name, name_kana, prefecture, website_url"),
    supabase.from("circles").select("university_id").eq("status", "approved"),
  ]);

  const counts = new Map<string, number>();
  for (const c of circles ?? []) {
    if (!c.university_id) continue;
    counts.set(c.university_id, (counts.get(c.university_id) ?? 0) + 1);
  }

  return (universities ?? [])
    .map((u) => ({ ...u, circleCount: counts.get(u.id) ?? 0 }))
    .sort((a, b) =>
      (a.name_kana ?? a.name).localeCompare(b.name_kana ?? b.name, "ja"),
    );
}

export type Campus = { id: string; name: string; address: string | null };

/** ある大学のキャンパス。誰でも読める（0023 のポリシー） */
export async function listCampuses(
  universityId: string | null,
): Promise<Campus[]> {
  if (!universityId) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("campuses")
    .select("id, name, address")
    .eq("university_id", universityId)
    .order("name");

  if (error) {
    console.error("キャンパスの取得に失敗しました:", error.message);
    return [];
  }
  return data ?? [];
}
