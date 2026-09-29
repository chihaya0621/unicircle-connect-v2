// 読むときの仮の起点。http にしておくと、「\」を「/」と読むなど、
// ブラウザが本物の URL を読むときと同じ規則で読める
const BASE = "http://localhost";

/**
 * 外から受け取った行き先を、このアプリの中のパスに限る。
 * ログイン後の戻り先（?next=）と、通知のリンクに使う。
 *
 * 「/ で始まり // で始まらない」だけでは足りない。「/\example.com」や、
 * 間にタブ・改行を挟んだものは、ブラウザが「//example.com」と読み、
 * よそのサイトへ移ってしまう。仮の起点に対して URL として読み、
 * 起点が変わらないものだけを通す。読んだあとの形が「//」で始まるもの
 * （「/..//example.com」は「//example.com」になる）も落とす。
 */
export function safePath(value: unknown): string | null {
  if (typeof value !== "string" || !value.startsWith("/")) return null;
  try {
    const url = new URL(value, BASE);
    if (url.origin !== BASE) return null;
    const path = url.pathname + url.search + url.hash;
    return path.startsWith("//") ? null : path;
  } catch {
    return null;
  }
}
