"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/dal";
import { createClient } from "@/lib/supabase-server";

export type ActionState = { error?: string; notice?: string } | null;

/**
 * 気になるサークルの登録・解除。
 *
 * 判定と可視性の確認は DB 関数 toggle_circle_favorite に寄せている。
 * 見えないサークルを登録できると、ID を総当たりして非公開サークルの
 * 存在を確かめられてしまうため、そこは DB 側で必ず塞ぐ。
 */
export async function toggleCircleFavorite(formData: FormData) {
  await requireUser();

  const circleId = String(formData.get("circle_id") ?? "");
  if (!circleId) return;

  const supabase = await createClient();
  const { error } = await supabase.rpc("toggle_circle_favorite", {
    p_circle_id: circleId,
  });

  if (error) {
    console.error("気になる登録に失敗しました:", error.message);
    return;
  }

  revalidatePath("/circles");
  revalidatePath(`/circles/${circleId}`);
  revalidatePath("/mypage");
}

/**
 * 気にしている大学の指定。
 *
 * チェックした集合をそのまま送り、DB 側で総入れ替えする。
 * 差分を送る形にすると、途中で失敗したときに片側だけ反映されうる。
 */
export async function saveWatchedUniversities(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUser();

  const ids = formData.getAll("university_ids").map(String).filter(Boolean);

  if (ids.length > 20) {
    return { error: "指定できる大学は20校までです。" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_watched_universities", {
    p_university_ids: ids,
  });

  if (error) {
    return { error: `保存に失敗しました: ${error.message}` };
  }

  revalidatePath("/circles");
  revalidatePath("/events");
  revalidatePath("/mypage");

  return {
    notice:
      ids.length === 0
        ? "指定を解除しました。すべての大学の公開情報を表示します。"
        : `${ids.length}校を指定しました。`,
  };
}
