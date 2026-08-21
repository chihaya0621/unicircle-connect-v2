/**
 * 都道府県の並び順。
 *
 * 五十音順でも辞書順でもなく、北から南へ並べる（JIS の都道府県コード順）。
 * 日本の住所欄はどこもこの順なので、他の順で並べると探しにくい。
 *
 * Client Component からも参照するため、server-only なモジュールとは分ける。
 */
export const PREFECTURES = [
  "北海道",
  "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県",
  "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
  "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県",
  "岐阜県", "静岡県", "愛知県", "三重県",
  "滋賀県", "京都府", "大阪府", "兵庫県", "奈良県", "和歌山県",
  "鳥取県", "島根県", "岡山県", "広島県", "山口県",
  "徳島県", "香川県", "愛媛県", "高知県",
  "福岡県", "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県",
] as const;

export type Prefecture = (typeof PREFECTURES)[number];

/** 未設定の大学をまとめる先。都道府県名と衝突しない文字列にしている */
export const PREFECTURE_UNKNOWN = "所在地未設定";

/** 並べ替え用の順位。未設定は最後 */
export function prefectureOrder(name: string): number {
  const index = (PREFECTURES as readonly string[]).indexOf(name);
  return index === -1 ? PREFECTURES.length : index;
}
