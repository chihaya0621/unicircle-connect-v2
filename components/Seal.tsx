import type { SealShape } from "@/lib/database.types";

/**
 * 印影。
 *
 * 画像は持たず、文字と形から毎回描く。保存も配信も要らず、
 * 拡大しても粗くならないので、画面でも紙でも同じものが出る。
 *
 * 組み方は実物の認印に合わせている。縦に読み、4字のときだけ
 * 右上→右下→左上→左下の順で回る。横一列に並べると判子に見えない。
 */

/** 朱肉の色。CMYK 4色で再現できる範囲に収めてある（M90 Y75 相当） */
const VERMILION = "#C8322E";

/**
 * 文字から傾きを決める。
 *
 * 押した跡がすべて真っ直ぐだと、並べたときに機械的に見える。
 * かといって乱数を使うと、サーバーでの描画とブラウザでの再水和で
 * 値がずれる。掲示板の紙と同じ理由で、文字から決定的に引く。
 */
function tilt(text: string): number {
  let hash = 2166136261; // FNV-1a
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  // murmur3 の最終撹拌。これが無いと、似た文字列で値が固まる
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 2246822507);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 3266489909);
  hash ^= hash >>> 16;
  return ((hash >>> 0) / 4294967296 - 0.5) * 7;
}

/** 字数ごとの配置。座標は 100×100 の枠の中 */
function layout(chars: string[]): { x: number; y: number; size: number }[] {
  switch (chars.length) {
    case 1:
      return [{ x: 50, y: 50, size: 52 }];
    case 2:
      return [
        { x: 50, y: 31, size: 38 },
        { x: 50, y: 69, size: 38 },
      ];
    case 3:
      return [
        { x: 50, y: 24, size: 28 },
        { x: 50, y: 50, size: 28 },
        { x: 50, y: 76, size: 28 },
      ];
    default:
      // 右上 → 右下 → 左上 → 左下。縦書きを2列に折った並び
      return [
        { x: 69, y: 31, size: 32 },
        { x: 69, y: 69, size: 32 },
        { x: 31, y: 31, size: 32 },
        { x: 31, y: 69, size: 32 },
      ];
  }
}

export function Seal({
  text,
  shape = "circle",
  size = 40,
  className = "",
}: {
  /** 彫られている文字。空なら何も描かない */
  text: string | null | undefined;
  shape?: SealShape | null;
  /** 一辺の大きさ（px） */
  size?: number;
  className?: string;
}) {
  const chars = [...(text ?? "").trim()].slice(0, 4);
  if (chars.length === 0) return null;

  const spots = layout(chars);
  const angle = tilt(chars.join(""));
  const stroke = 6;

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={`shrink-0 ${className}`}
      role="img"
      aria-label={`${chars.join("")} の印`}
      style={{ transform: `rotate(${angle.toFixed(2)}deg)` }}
    >
      {shape === "square" ? (
        <rect
          x={stroke / 2}
          y={stroke / 2}
          width={100 - stroke}
          height={100 - stroke}
          rx="6"
          fill="none"
          stroke={VERMILION}
          strokeWidth={stroke}
        />
      ) : (
        <circle
          cx="50"
          cy="50"
          r={50 - stroke / 2}
          fill="none"
          stroke={VERMILION}
          strokeWidth={stroke}
        />
      )}
      {chars.map((c, i) => (
        <text
          key={`${c}-${i}`}
          x={spots[i].x}
          y={spots[i].y}
          fill={VERMILION}
          fontSize={spots[i].size}
          fontWeight={700}
          textAnchor="middle"
          dominantBaseline="central"
        >
          {c}
        </text>
      ))}
    </svg>
  );
}

/**
 * まだ押されていない欄。
 *
 * 紙の決裁では、空の判子欄があるから「あと何人か」が見て分かる。
 * 承認済みのものだけ並べると、残りが何人なのかが読めない。
 */
export function EmptySeal({
  size = 40,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={`shrink-0 ${className}`}
      aria-hidden="true"
    >
      <circle
        cx="50"
        cy="50"
        r="47"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        strokeDasharray="7 7"
        opacity="0.35"
      />
    </svg>
  );
}
