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
