/**
 * 画像の無いサークルに出すアイコンの選び方。
 *
 * サークルの画像は管理者が上げたものだけで、多くのサークルには無い。
 * 名前の頭文字だけでは、一覧でどんなサークルかが分からなかった。
 * 名前の言葉から絵柄を選び（写真ならカメラ、ボードゲームならサイコロ）、
 * 合う言葉が無ければ分野で選ぶ。色は分野で決める。
 *
 * サーバーとクライアントの両方から使う。
 */

export type CircleGlyph =
  | "camera"
  | "dice"
  | "gamepad"
  | "code"
  | "mic"
  | "music"
  | "chat"
  | "globe"
  | "tennis"
  | "soccer"
  | "ball"
  | "water"
  | "mountain"
  | "bike"
  | "trophy"
  | "palette"
  | "spark"
  | "book"
  | "flask"
  | "star"
  | "cup"
  | "leaf"
  | "heart";

export type CircleTone =
  | "emerald"
  | "violet"
  | "rose"
  | "sky"
  | "amber"
  | "teal"
  | "indigo";

/** 名前の言葉と絵柄。上から順に見て、最初に当たったものを使う */
const NAME_RULES: [RegExp, CircleGlyph][] = [
  [/写真|カメラ|フォト|photo|映画|映像|動画/i, "camera"],
  [/ボードゲーム|カードゲーム|将棋|囲碁|チェス|麻雀|trpg|tcg/i, "dice"],
  [/eスポーツ|e-?sports|ゲーム/i, "gamepad"],
  [/プログラミング|プログラム|情報|コンピュータ|ロボ|ハッカソン|電子|\bit\b|\bai\b|web|アプリ/i, "code"],
  [/合唱|コーラス|アカペラ|声楽|放送/, "mic"],
  [/軽音|バンド|音楽|吹奏|オーケストラ|管弦|ジャズ|ギター|ピアノ|ロック|和太鼓|邦楽/, "music"],
  [/語学|英語|英会話|中国語|韓国語|ディベート|弁論|手話|\bess\b/i, "chat"],
  [/国際|国連|留学|異文化|多文化/, "globe"],
  [/テニス|野球|ソフトボール/, "tennis"],
  [/サッカー|フットサル/, "soccer"],
  [/バスケ|バレー|ハンドボール|ドッジ|ラグビー|バドミントン|卓球|ボール/, "ball"],
  [/水泳|競泳|ボート|ヨット|カヌー|ダイビング|サーフ|釣り/, "water"],
  [/登山|山岳|ワンダーフォーゲル|ワンゲル|アウトドア|キャンプ|スキー|スノーボード|ハイキング/, "mountain"],
  [/自転車|サイクリング/, "bike"],
  [/陸上|ランニング|マラソン|駅伝|空手|柔道|剣道|弓道|合気道|ボクシング|筋トレ|フィットネス|武道/, "trophy"],
  [/美術|イラスト|漫画|マンガ|アニメ|デザイン|書道|陶芸|手芸|クラフト|絵/, "palette"],
  [/演劇|劇団|落語|お笑い|漫才|ダンス|よさこい|チア|ミュージカル/, "spark"],
  [/文芸|読書|文学|小説|歴史|哲学/, "book"],
  [/天文|宇宙|星/, "star"],
  [/茶道|華道|カフェ|料理|グルメ|スイーツ|お菓子/, "cup"],
  [/環境|environment|園芸|農|自然|植物|エコ|\beco/i, "leaf"],
  [/ボランティア|福祉|地域|子ども|まちづくり|募金/, "heart"],
  // 「研究」は広く使われるので最後に見る（「写真研究会」はカメラにする）
  [/化学|科学|理科|実験|生物|物理|数学|研究/, "flask"],
];

/** 名前で決まらないときの、分野ごとの絵柄と色 */
const BY_CATEGORY: Record<string, { glyph: CircleGlyph; tone: CircleTone }> = {
  sports: { glyph: "ball", tone: "emerald" },
  music: { glyph: "music", tone: "violet" },
  culture: { glyph: "palette", tone: "rose" },
  academic: { glyph: "book", tone: "sky" },
  volunteer: { glyph: "heart", tone: "amber" },
  international: { glyph: "globe", tone: "teal" },
  other: { glyph: "spark", tone: "indigo" },
};

export function pickCircleIcon(
  name: string,
  category: string | null | undefined,
): { glyph: CircleGlyph; tone: CircleTone } {
  const byCategory = BY_CATEGORY[category ?? "other"] ?? BY_CATEGORY.other;
  const text = name.normalize("NFKC");
  const rule = NAME_RULES.find(([pattern]) => pattern.test(text));
  return { glyph: rule ? rule[1] : byCategory.glyph, tone: byCategory.tone };
}
