import type { ReactNode } from "react";

/**
 * ページ上部の見出し。
 *
 * 装飾の図形は variant で切り替える。全ページが同じ配置だと単調なので、
 * ページごとに違う形を割り当てて印象を変えている。
 *
 * 色はすべてテーマ変数（--orb-* / --accent）を参照するので、
 * テーマを切り替えると装飾の色も一緒に変わる。
 */
export type HeroVariant =
  | "circles" // 右上に大きな円、左下に小さな円
  | "arc" // 右下から大きな弧
  | "ribbon" // 斜めに走る帯
  | "blobs" // 有機的な塊を2つ
  | "stack" // 傾けた角丸の四角を重ねる
  | "wave"; // 下辺を大きな楕円で削る

/** 図形の定義。テーマ色を参照するので、色の指定は変数で書く。 */
function Decoration({ variant }: { variant: HeroVariant }) {
  const orb = (n: number, alpha = 1) =>
    `radial-gradient(circle at 32% 30%, rgb(var(--orb-${n})), rgb(var(--orb-${n}) / ${alpha * 0.55}))`;

  switch (variant) {
    case "circles":
      return (
        <>
          <span
            aria-hidden
            className="pointer-events-none absolute -right-12 -top-16 size-56 rounded-full opacity-90"
            style={{ background: orb(2) }}
          />
          <span
            aria-hidden
            className="pointer-events-none absolute -bottom-10 left-24 size-28 rounded-full opacity-70"
            style={{ background: orb(1) }}
          />
        </>
      );

    case "arc":
      return (
        <>
          {/* 四分円。角丸を一方向だけ極端にして弧を作る */}
          <span
            aria-hidden
            className="pointer-events-none absolute -bottom-24 -right-16 size-72 opacity-80"
            style={{
              background: orb(3),
              borderRadius: "100% 0 0 0",
            }}
          />
          <span
            aria-hidden
            className="pointer-events-none absolute -left-6 -top-8 size-24 rounded-full opacity-60"
            style={{ background: orb(4) }}
          />
        </>
      );

    case "ribbon":
      return (
        <>
          <span
            aria-hidden
            className="pointer-events-none absolute -left-8 top-4 h-40 w-[130%] opacity-25"
            style={{
              background:
                "linear-gradient(100deg, rgb(var(--orb-1)), rgb(var(--orb-4)) 45%, rgb(var(--orb-2)))",
              borderRadius: "50% 50% 46% 54% / 62% 58% 42% 38%",
              transform: "rotate(-7deg)",
            }}
          />
          <span
            aria-hidden
            className="pointer-events-none absolute -right-6 -top-10 size-32 rounded-full opacity-70"
            style={{ background: orb(3) }}
          />
        </>
      );

    case "blobs":
      return (
        <>
          <span
            aria-hidden
            className="pointer-events-none absolute -right-10 -top-12 size-52 opacity-80"
            style={{
              background: orb(1),
              borderRadius: "62% 38% 44% 56% / 48% 58% 42% 52%",
            }}
          />
          <span
            aria-hidden
            className="pointer-events-none absolute -bottom-14 right-40 size-36 opacity-60"
            style={{
              background: orb(4),
              borderRadius: "40% 60% 55% 45% / 55% 45% 60% 40%",
            }}
          />
        </>
      );

    case "stack":
      return (
        <>
          <span
            aria-hidden
            className="pointer-events-none absolute -right-14 -top-10 size-44 rounded-[2rem] opacity-70"
            style={{ background: orb(2), transform: "rotate(18deg)" }}
          />
          <span
            aria-hidden
            className="pointer-events-none absolute -top-4 right-16 size-28 rounded-[1.25rem] opacity-80"
            style={{ background: orb(1), transform: "rotate(-12deg)" }}
          />
          <span
            aria-hidden
            className="pointer-events-none absolute -bottom-8 left-16 size-20 rounded-[1rem] opacity-60"
            style={{ background: orb(3), transform: "rotate(24deg)" }}
          />
        </>
      );

    case "wave":
      return (
        <>
          <span
            aria-hidden
            className="pointer-events-none absolute -bottom-28 -left-10 h-44 w-[130%] opacity-25"
            style={{
              background:
                "linear-gradient(90deg, rgb(var(--orb-3)), rgb(var(--orb-1)))",
              borderRadius: "50%",
            }}
          />
          <span
            aria-hidden
            className="pointer-events-none absolute -right-8 -top-12 size-40 rounded-full opacity-75"
            style={{ background: orb(2) }}
          />
        </>
      );
  }
}

export function PageHero({
  variant = "circles",
  eyebrow,
  title,
  description,
  lead,
  action,
}: {
  variant?: HeroVariant;
  /** 背後に薄く敷く英字。参考にした採用サイトの体裁に合わせている */
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  /** タイトルの左に置く大きな要素（カレンダーの月番号など） */
  lead?: ReactNode;
  /** 右側に置く操作。ボタンやリンクを想定 */
  action?: ReactNode;
}) {
  return (
    <header className="glass-panel relative mb-6 overflow-hidden p-0">
      <Decoration variant={variant} />

      <div className="relative flex flex-wrap items-end justify-between gap-6 p-6">
        <div className="flex min-w-0 items-end gap-5">
          {lead}
          <div className="min-w-0">
            {eyebrow && (
              <p
                className="text-xs font-bold uppercase tracking-[0.2em]"
                style={{ color: "rgb(var(--accent) / 0.75)" }}
              >
                {eyebrow}
              </p>
            )}
            <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
              {title}
            </h1>
            {description && (
              <p className="mt-1.5 text-sm text-gray-600 dark:text-gray-400">
                {description}
              </p>
            )}
          </div>
        </div>

        {action && (
          <div className="flex flex-wrap items-center gap-2 pb-1">{action}</div>
        )}
      </div>
    </header>
  );
}
