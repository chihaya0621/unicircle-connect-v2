import { SUPABASE_URL } from "@/lib/supabase";

export const IMAGE_BUCKET = "images";

/** Storage 側と揃えた上限（5MB） */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

/**
 * バケット内のパスから公開URLを組み立てる。
 *
 * supabase-js の getPublicUrl と同じ結果になるが、
 * クライアントを作らずに済むので Server Component から気軽に呼べる。
 * DB にはパスだけを保存しているので、公開/非公開を切り替えても
 * この関数の差し替えだけで済む。
 */
export function imageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return `${SUPABASE_URL}/storage/v1/object/public/${IMAGE_BUCKET}/${path}`;
}

/** 拡張子を MIME から決める。ファイル名をそのまま使うと日本語や記号で壊れるため。 */
export function extensionFor(type: string): string | null {
  switch (type) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    default:
      return null;
  }
}
