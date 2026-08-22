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

export type DirectoryEntry = {
  universityId: string;
  universityName: string;
  campusId: string | null;
  campusName: string | null;
  /** 一覧に出す名前。キャンパスが複数ある大学だけ括弧を付ける */
  label: string;
  prefecture: string | null;
  websiteUrl: string | null;
  /** 拠点未設定のサークルを引き受ける代表キャンパスか */
  isPrimary: boolean;
  /** その閲覧者に見えるサークルの数 */
  circleCount: number;
};

/**
 * 公開のサークル探索に使う、大学 × キャンパスの一覧。
 *
 * 都道府県の絞り込みはキャンパス側の所在地で行う。大学の所在地だけで
 * 判定すると、県をまたいでキャンパスを構える大学が片方の県からしか
 * 見つからない。
 *
 * 名前は「大学名（キャンパス名）」だが、キャンパスが1つしかない大学に
 * 括弧を付けても情報が増えないので、複数ある大学だけに付ける。
 *
 * 件数は SQL の集約ではなくアプリ側で数える。RLS が閲覧者ごとに
 * 見える行を変えるので、埋め込み集約だと見えないサークルまで数に入る。
 * 素の行を引いて数えれば、数と一覧が必ず一致する。
 */
export async function listCampusDirectory(): Promise<DirectoryEntry[]> {
  const supabase = await createClient();

  const [{ data: universities }, { data: campuses }, { data: circles }] =
    await Promise.all([
      supabase
        .from("universities")
        .select("id, name, name_kana, prefecture, website_url"),
      supabase
        .from("campuses")
        .select("id, university_id, name, prefecture, created_at")
        .order("created_at"),
      supabase
        .from("circles")
        .select("university_id, campus_id")
        .eq("status", "approved"),
    ]);

  // 拠点ごとの件数と、拠点未設定の件数を大学ごとに分けて数える
  const byCampus = new Map<string, number>();
  const unassigned = new Map<string, number>();
  for (const c of circles ?? []) {
    if (c.campus_id) {
      byCampus.set(c.campus_id, (byCampus.get(c.campus_id) ?? 0) + 1);
    } else if (c.university_id) {
      unassigned.set(
        c.university_id,
        (unassigned.get(c.university_id) ?? 0) + 1,
      );
    }
  }

  const campusesOf = new Map<string, NonNullable<typeof campuses>>();
  for (const c of campuses ?? []) {
    const list = campusesOf.get(c.university_id) ?? [];
    list.push(c);
    campusesOf.set(c.university_id, list);
  }

  const entries: DirectoryEntry[] = [];

  for (const u of universities ?? []) {
    const list = campusesOf.get(u.id) ?? [];

    // キャンパスが1つも無い大学も一覧から落とさない
    if (list.length === 0) {
      entries.push({
        universityId: u.id,
        universityName: u.name,
        campusId: null,
        campusName: null,
        label: u.name,
        prefecture: u.prefecture,
        websiteUrl: u.website_url,
        isPrimary: true,
        circleCount: unassigned.get(u.id) ?? 0,
      });
      continue;
    }

    // 拠点未設定のサークルは代表キャンパスに寄せる。
    // 本部（大学と同じ都道府県）を優先し、無ければ最初に作られたもの。
    const primary =
      list.find((c) => c.prefecture && c.prefecture === u.prefecture) ?? list[0];
    const multi = list.length > 1;

    for (const c of list) {
      const isPrimary = c.id === primary.id;
      entries.push({
        universityId: u.id,
        universityName: u.name,
        campusId: c.id,
        campusName: c.name,
        label: multi ? `${u.name}（${c.name}）` : u.name,
        prefecture: c.prefecture ?? u.prefecture,
        websiteUrl: u.website_url,
        isPrimary,
        circleCount:
          (byCampus.get(c.id) ?? 0) +
          (isPrimary ? (unassigned.get(u.id) ?? 0) : 0),
      });
    }
  }

  return entries.sort((a, b) => a.label.localeCompare(b.label, "ja"));
}

export type Campus = {
  id: string;
  name: string;
  address: string | null;
  prefecture: string | null;
};

/** ある大学のキャンパス。誰でも読める（0023 のポリシー） */
export async function listCampuses(
  universityId: string | null,
): Promise<Campus[]> {
  if (!universityId) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("campuses")
    .select("id, name, address, prefecture")
    .eq("university_id", universityId)
    .order("name");

  if (error) {
    console.error("キャンパスの取得に失敗しました:", error.message);
    return [];
  }
  return data ?? [];
}
