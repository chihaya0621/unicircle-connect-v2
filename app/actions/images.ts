"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/dal";
import {
  ALLOWED_IMAGE_TYPES,
  IMAGE_BUCKET,
  MAX_IMAGE_BYTES,
  extensionFor,
} from "@/lib/images";
import { createClient } from "@/lib/supabase-server";

export type ActionState = { error?: string; notice?: string } | null;

/**
 * 画像のアップロード。
 *
 * 他のデータと違い、Storage への書き込みは RPC を経由できない
 * （Storage API を直接叩くしかない）ため、storage.objects の
 * ポリシーが権限判定を担う。パスから対象を判別して、
 * サークル管理者・イベント主催者だけが書き込める。
 *
 * ファイル名は使わず MIME から拡張子を決める。日本語や記号を含む
 * ファイル名をそのままパスにすると壊れるため。
 */
async function upload(
  kind: "circles" | "events",
  id: string,
  file: File,
): Promise<{ path?: string; error?: string }> {
  if (file.size === 0) return { error: "ファイルが選択されていません。" };
  if (file.size > MAX_IMAGE_BYTES) {
    return { error: "画像は5MB以内にしてください。" };
  }
  const ext = extensionFor(file.type);
  if (!ext || !ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return { error: "JPEG / PNG / WebP / GIF のみ利用できます。" };
  }

  const supabase = await createClient();
  // 同じ名前で上書きせず毎回新しいパスにする。
  // CDN やブラウザのキャッシュで古い画像が残るのを避けるため。
  const path = `${kind}/${id}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from(IMAGE_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });

  if (error) return { error: error.message };
  return { path };
}

/** 差し替え時に古い画像を消す。失敗しても本処理は続ける。 */
async function removeOld(oldPath: string | null | undefined) {
  if (!oldPath) return;
  const supabase = await createClient();
  const { error } = await supabase.storage.from(IMAGE_BUCKET).remove([oldPath]);
  if (error) console.error("古い画像の削除に失敗しました:", error.message);
}

export async function uploadCircleImage(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUser();

  const circleId = String(formData.get("circle_id") ?? "");
  const file = formData.get("image");
  if (!circleId) return { error: "サークルが指定されていません。" };
  if (!(file instanceof File)) return { error: "画像を選択してください。" };

  const supabase = await createClient();
  const { data: before } = await supabase
    .from("circles")
    .select("image_path")
    .eq("id", circleId)
    .maybeSingle();

  const { path, error } = await upload("circles", circleId, file);
  if (error) return { error };

  const { error: rpcError } = await supabase.rpc("set_circle_image", {
    p_circle_id: circleId,
    p_path: path,
  });
  if (rpcError) return { error: rpcError.message };

  await removeOld(before?.image_path);

  revalidatePath("/circles");
  revalidatePath(`/circles/${circleId}`);
  return { notice: "画像を設定しました。" };
}

export async function removeCircleImage(formData: FormData): Promise<void> {
  await requireUser();
  const circleId = String(formData.get("circle_id") ?? "");
  if (!circleId) return;

  const supabase = await createClient();
  const { data: before } = await supabase
    .from("circles")
    .select("image_path")
    .eq("id", circleId)
    .maybeSingle();

  const { error } = await supabase.rpc("set_circle_image", {
    p_circle_id: circleId,
    p_path: undefined,
  });
  if (error) {
    console.error("画像の削除に失敗しました:", error.message);
    return;
  }
  await removeOld(before?.image_path);

  revalidatePath("/circles");
  revalidatePath(`/circles/${circleId}`);
}

export async function uploadEventImage(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUser();

  const eventId = String(formData.get("event_id") ?? "");
  const file = formData.get("image");
  if (!eventId) return { error: "イベントが指定されていません。" };
  if (!(file instanceof File)) return { error: "画像を選択してください。" };

  const supabase = await createClient();
  const { data: before } = await supabase
    .from("events")
    .select("image_path")
    .eq("id", eventId)
    .maybeSingle();

  const { path, error } = await upload("events", eventId, file);
  if (error) return { error };

  const { error: rpcError } = await supabase.rpc("set_event_image", {
    p_event_id: eventId,
    p_path: path,
  });
  if (rpcError) return { error: rpcError.message };

  await removeOld(before?.image_path);

  revalidatePath("/events");
  revalidatePath(`/events/${eventId}`);
  return { notice: "画像を設定しました。" };
}

export async function removeEventImage(formData: FormData): Promise<void> {
  await requireUser();
  const eventId = String(formData.get("event_id") ?? "");
  if (!eventId) return;

  const supabase = await createClient();
  const { data: before } = await supabase
    .from("events")
    .select("image_path")
    .eq("id", eventId)
    .maybeSingle();

  const { error } = await supabase.rpc("set_event_image", {
    p_event_id: eventId,
    p_path: undefined,
  });
  if (error) {
    console.error("画像の削除に失敗しました:", error.message);
    return;
  }
  await removeOld(before?.image_path);

  revalidatePath("/events");
  revalidatePath(`/events/${eventId}`);
}
