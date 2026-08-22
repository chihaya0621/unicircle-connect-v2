import type { CSSProperties, ReactNode } from "react";

/**
 * トップページのヒーロー。
 *
 * 二層で「つながる」を言い直している。
 *   上: 散らばった文字が集まって製品名になる（キネティック・タイポ）
 *   下: 抽象アイコンを線が結び、その上を信号が流れ続ける
 *
 * 具体的なサークル名やイベント名は出さない。ここはまだ何も知らない人が
 * 見る場所なので、機能の抽象度を保ったまま関係だけを見せる。
 *
 * 動きは CSS のみ。クライアント JS を持たないので Server Component のまま置ける。
 */

const TITLE = ["UniCircle", "Connect"];

/**
 * 文字ごとの散らばり方。
 *
 * 乱数を使うとサーバーとクライアントで値が変わってハイドレーションが壊れるので、
 * 添字から決定的に求める。
 */
function scatter(i: number): CSSProperties {
  const fract = (n: number) => n - Math.floor(n);
  const a = fract(Math.sin(i * 12.9898) * 43758.5453);
  const b = fract(Math.sin(i * 78.233) * 12345.6789);

  return {
    "--i": i,
    "--kx": `${(a * 1.8 - 0.9).toFixed(2)}em`,
    "--ky": `${(b * 1.7 - 0.5).toFixed(2)}em`,
    "--kr": `${((a - 0.5) * 44).toFixed(0)}deg`,
  } as CSSProperties;
}

/* --- 抽象アイコン。特定の団体や行事を指さない、関係だけを表す図形 --- */

const GLYPH_PROPS = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

/** 集まり: 三つの点が互いに結ばれている */
function GlyphGroup() {
  return (
    <svg {...GLYPH_PROPS} className="size-1/2">
      <circle cx="12" cy="5.5" r="2.6" />
      <circle cx="5.5" cy="17" r="2.6" />
      <circle cx="18.5" cy="17" r="2.6" />
      <path d="M10.2 7.7 7.3 14.8M13.8 7.7l2.9 7.1M8.1 17h7.8" />
    </svg>
  );
}

/** 予定: 枠の中に時間が刻まれている */
function GlyphSchedule() {
  return (
    <svg {...GLYPH_PROPS} className="size-1/2">
      <rect x="3.5" y="5.5" width="17" height="15" rx="3" />
      <path d="M3.5 10.5h17M8 3.5v4M16 3.5v4" />
      <circle cx="8.5" cy="15" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="14" cy="15" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** 場所: 屋根のある区画 */
function GlyphPlace() {
  return (
    <svg {...GLYPH_PROPS} className="size-1/2">
      <path d="M3.5 10 12 3.5 20.5 10v9a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19z" />
      <path d="M9.5 20.5v-6h5v6" />
    </svg>
  );
}

/** やりとり: 重なった二つの吹き出し */
function GlyphTalk() {
  return (
    <svg {...GLYPH_PROPS} className="size-1/2">
      <path d="M3.5 7.5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H8l-3.5 3v-3a1 1 0 0 1-1-1z" />
      <path d="M18 9.5h.5a2 2 0 0 1 2 2v4a1 1 0 0 1-1 1v3l-3.5-3h-3" />
    </svg>
  );
}

/** 知らせ: 中心から広がる波 */
function GlyphSignal() {
  return (
    <svg {...GLYPH_PROPS} className="size-1/2">
      <circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none" />
      <path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4" />
      <path d="M4.9 4.9a10 10 0 0 0 0 14.2M19.1 4.9a10 10 0 0 1 0 14.2" />
    </svg>
  );
}

/** 中心。ばらばらのものが集まる一点 */
function GlyphHub() {
  return (
    <svg {...GLYPH_PROPS} className="size-1/2" strokeWidth={1.5}>
      <circle cx="12" cy="12" r="7" />
      <circle cx="12" cy="12" r="2.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** 節点の配置。単位は網の枠に対する % */
const NODES = [
  { x: 50, y: 11, orb: 1, size: "size-14", Glyph: GlyphGroup },
  { x: 86, y: 33, orb: 2, size: "size-12", Glyph: GlyphSchedule },
  { x: 72, y: 76, orb: 3, size: "size-13", Glyph: GlyphPlace },
  { x: 24, y: 70, orb: 4, size: "size-12", Glyph: GlyphTalk },
  { x: 12, y: 30, orb: 3, size: "size-12", Glyph: GlyphSignal },
] as const;

/** 線。中心から各節点へ、加えて外周どうしを2本結んで網にする */
const LINES = [
  "M50 47 Q45 28 50 11",
  "M50 47 Q71 39 86 33",
  "M50 47 Q65 61 72 76",
  "M50 47 Q35 59 24 70",
  "M50 47 Q29 38 12 30",
  "M50 11 Q74 17 86 33",
  "M24 70 Q47 82 72 76",
];

export function HomeHero({ action }: { action: ReactNode }) {
  let charIndex = 0;

  return (
    <section className="grid items-center gap-10 md:grid-cols-[1.05fr_0.95fr]">
      <div className="min-w-0">
        <p
          className="mb-4 text-xs font-bold uppercase tracking-[0.24em]"
          style={{ color: "rgb(var(--accent) / 0.75)" }}
        >
          University circles, connected
        </p>

        {/* 文字を1つずつに割るので、読み上げには元の文字列を渡す */}
        <h1
          className="text-[13vw] font-black leading-[1.05] tracking-tighter sm:text-6xl lg:text-7xl"
          aria-label={TITLE.join(" ")}
        >
          <span className="kinetic" aria-hidden>
            {TITLE.map((word) => (
              <span key={word} className="flex">
                {[...word].map((char, i) => (
                  <i key={`${word}-${i}`} style={scatter(charIndex++)}>
                    {char}
                  </i>
                ))}
              </span>
            ))}
          </span>
        </h1>

        <p className="mt-6 text-xl font-bold tracking-tight sm:text-2xl">
          大学生活の「つながる」を、ひとつの場所に。
        </p>
        <p className="mt-3 max-w-xl text-gray-600 dark:text-gray-400">
          サークル活動の管理・イベントの告知・大学施設の予約を、
          ばらばらのままにしないためのプラットフォームです。
        </p>

        <div className="mt-8 flex flex-wrap gap-3">{action}</div>
      </div>

      {/* 装飾。読み上げからは丸ごと外す */}
      <div
        className="thread-net mx-auto aspect-square w-full max-w-md"
        aria-hidden
      >
        <svg viewBox="0 0 100 100" preserveAspectRatio="none">
          {LINES.map((d, i) => (
            <g key={d} style={{ "--i": i } as CSSProperties}>
              <path className="thread-line" d={d} />
              <path
                className="thread-line thread-pulse"
                d={d}
                style={{ stroke: `rgb(var(--orb-${(i % 4) + 1}))` }}
              />
            </g>
          ))}
        </svg>

        {NODES.map(({ x, y, orb, size, Glyph }, i) => (
          <span
            key={i}
            className="thread-node"
            style={{ left: `${x}%`, top: `${y}%`, "--i": i + 1 } as CSSProperties}
          >
            <span
              className={`glass grid ${size} place-items-center rounded-full`}
              style={{
                color: `rgb(var(--orb-${orb}))`,
                borderRadius: "9999px",
              }}
            >
              <Glyph />
            </span>
          </span>
        ))}

        {/* 中心。ここに集まる、という一点 */}
        <span
          className="thread-node thread-hub"
          style={{ left: "50%", top: "47%", "--i": 0 } as CSSProperties}
        >
          <span
            className="grid size-20 place-items-center rounded-full text-white"
            style={{
              background:
                "linear-gradient(135deg, rgb(var(--btn-from)), rgb(var(--btn-to)))",
              boxShadow: "0 14px 30px -10px rgb(var(--btn-from) / 0.6)",
            }}
          >
            <GlyphHub />
          </span>
        </span>
      </div>
    </section>
  );
}
