import { pickCircleIcon, type CircleGlyph, type CircleTone } from "@/lib/circle-icons";

/** 分野ごとの色。暗い画面では背景を沈め、線を明るくする */
const TONE_CLASS: Record<CircleTone, string> = {
  emerald:
    "border-emerald-200/80 bg-emerald-50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/60 dark:text-emerald-300",
  violet:
    "border-violet-200/80 bg-violet-50 text-violet-700 dark:border-violet-800/60 dark:bg-violet-950/60 dark:text-violet-300",
  rose: "border-rose-200/80 bg-rose-50 text-rose-700 dark:border-rose-800/60 dark:bg-rose-950/60 dark:text-rose-300",
  sky: "border-sky-200/80 bg-sky-50 text-sky-700 dark:border-sky-800/60 dark:bg-sky-950/60 dark:text-sky-300",
  amber:
    "border-amber-200/80 bg-amber-50 text-amber-700 dark:border-amber-800/60 dark:bg-amber-950/60 dark:text-amber-300",
  teal: "border-teal-200/80 bg-teal-50 text-teal-700 dark:border-teal-800/60 dark:bg-teal-950/60 dark:text-teal-300",
  indigo:
    "border-indigo-200/80 bg-indigo-50 text-indigo-700 dark:border-indigo-800/60 dark:bg-indigo-950/60 dark:text-indigo-300",
};

/** 24×24 の線の絵。塗りの点だけ fill を使う */
const DOT = { fill: "currentColor", stroke: "none" } as const;

function Glyph({ glyph }: { glyph: CircleGlyph }) {
  switch (glyph) {
    case "camera":
      return (
        <>
          <path d="M4 8h3l1.6-2.5h6.8L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
          <circle cx="12" cy="13.2" r="3.4" />
        </>
      );
    case "dice":
      return (
        <>
          <rect x="4" y="4" width="16" height="16" rx="3" />
          <circle cx="8.6" cy="8.6" r="1.25" {...DOT} />
          <circle cx="15.4" cy="8.6" r="1.25" {...DOT} />
          <circle cx="12" cy="12" r="1.25" {...DOT} />
          <circle cx="8.6" cy="15.4" r="1.25" {...DOT} />
          <circle cx="15.4" cy="15.4" r="1.25" {...DOT} />
        </>
      );
    case "gamepad":
      return (
        <>
          <rect x="2.5" y="7.5" width="19" height="10" rx="5" />
          <path d="M7.5 10.5v4M5.5 12.5h4" />
          <circle cx="15.6" cy="11.4" r="1.05" {...DOT} />
          <circle cx="17.8" cy="13.6" r="1.05" {...DOT} />
        </>
      );
    case "code":
      return <path d="M8 7.5L3.5 12 8 16.5M16 7.5l4.5 4.5-4.5 4.5M13.6 5l-3.2 14" />;
    case "mic":
      return (
        <>
          <rect x="9" y="3" width="6" height="11" rx="3" />
          <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M9 21h6" />
        </>
      );
    case "music":
      return (
        <>
          <path d="M9 18V5.5l11-2.2v12.5" />
          <circle cx="6.5" cy="18" r="2.5" />
          <circle cx="17.5" cy="15.8" r="2.5" />
        </>
      );
    case "chat":
      return (
        <>
          <path d="M4 5h16v11H10l-4.5 3.5V16H4z" />
          <path d="M8 9.5h8M8 12.5h5" />
        </>
      );
    case "globe":
      return (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" />
        </>
      );
    case "tennis":
      return (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M6 5.2c2.6 1.9 3.9 4.2 3.9 6.8S8.6 16.9 6 18.8M18 5.2c-2.6 1.9-3.9 4.2-3.9 6.8s1.3 4.9 3.9 6.8" />
        </>
      );
    case "soccer":
      return (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8.2l3.4 2.5-1.3 4h-4.2l-1.3-4z" />
          <path d="M12 3v5.2M20.4 9.6l-5 1.1M17.4 19.2l-3.3-4.5M6.6 19.2l3.3-4.5M3.6 9.6l5 1.1" />
        </>
      );
    case "ball":
      return (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3v18M5.7 5.6c2.3 2.4 2.3 10.4 0 12.8M18.3 5.6c-2.3 2.4-2.3 10.4 0 12.8" />
        </>
      );
    case "water":
      return (
        <path d="M3 8.5c1.5 0 1.5-1.4 3-1.4s1.5 1.4 3 1.4 1.5-1.4 3-1.4 1.5 1.4 3 1.4 1.5-1.4 3-1.4 1.5 1.4 3 1.4M3 13c1.5 0 1.5-1.4 3-1.4s1.5 1.4 3 1.4 1.5-1.4 3-1.4 1.5 1.4 3 1.4 1.5-1.4 3-1.4 1.5 1.4 3 1.4M3 17.5c1.5 0 1.5-1.4 3-1.4s1.5 1.4 3 1.4 1.5-1.4 3-1.4 1.5 1.4 3 1.4 1.5-1.4 3-1.4 1.5 1.4 3 1.4" />
      );
    case "mountain":
      return (
        <>
          <path d="M2.5 19.5l7-12 4.2 7 2.3-3.4 5.5 8.4z" />
          <path d="M7.7 10.6l1.8 1.4 1.8-1.4" />
        </>
      );
    case "bike":
      return (
        <>
          <circle cx="6" cy="16" r="3.5" />
          <circle cx="18" cy="16" r="3.5" />
          <path d="M6 16l3.8-6.5h5.6L18 16M9.8 9.5L8.3 6.5H6.3M15.4 9.5l-2.6 6.5H6" />
        </>
      );
    case "trophy":
      return (
        <>
          <path d="M8 4h8v5a4 4 0 0 1-8 0z" />
          <path d="M8 6H5.5v1.5A2.5 2.5 0 0 0 8 10M16 6h2.5v1.5A2.5 2.5 0 0 1 16 10M12 13v4M8.5 20.5h7M9.5 17h5v3.5h-5z" />
        </>
      );
    case "palette":
      return (
        <>
          <path d="M12 3a9 9 0 1 0 0 18c1 0 1.6-.8 1.6-1.6 0-.4-.2-.8-.4-1.1-.3-.3-.4-.7-.4-1.1 0-.9.7-1.6 1.6-1.6H16a5 5 0 0 0 5-5C21 6.5 17 3 12 3z" />
          <circle cx="7.6" cy="11" r="1.2" {...DOT} />
          <circle cx="10.6" cy="7.2" r="1.2" {...DOT} />
          <circle cx="15.1" cy="7.6" r="1.2" {...DOT} />
        </>
      );
    case "spark":
      return (
        <>
          <path d="M11 3.5l1.8 5.2L18 10.5l-5.2 1.8L11 17.5l-1.8-5.2L4 10.5l5.2-1.8z" />
          <path d="M18.5 15l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" />
        </>
      );
    case "book":
      return (
        <path d="M3 6c3-1.5 6-1.5 9 0v13c-3-1.5-6-1.5-9 0zM21 6c-3-1.5-6-1.5-9 0v13c3-1.5 6-1.5 9 0z" />
      );
    case "flask":
      return (
        <>
          <path d="M9.5 3h5M10.5 3v6.2L5.2 18a2 2 0 0 0 1.7 3h10.2a2 2 0 0 0 1.7-3l-5.3-8.8V3" />
          <path d="M7.4 15h9.2" />
        </>
      );
    case "star":
      return (
        <path d="M12 3.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z" />
      );
    case "cup":
      return (
        <>
          <path d="M5 9h11v4.5a4.5 4.5 0 0 1-4.5 4.5h-2A4.5 4.5 0 0 1 5 13.5z" />
          <path d="M16 10.5h1.5a2.5 2.5 0 0 1 0 5H16M4 21h13M8.5 3.5V6M12 3.5V6" />
        </>
      );
    case "leaf":
      return (
        <>
          <path d="M5 19c0-8 5-13 14-14 0 9-5 14-14 14z" />
          <path d="M5 19l8-8" />
        </>
      );
    case "heart":
      return (
        <path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 7.5 2.8C19.5 15.4 12 20 12 20z" />
      );
  }
}

/**
 * 画像の無いサークルのアイコン。名前と分野から絵柄と色を選ぶ
 * （lib/circle-icons.ts）。名前は隣に書いてあるので、読み上げには出さない。
 */
export function CircleIcon({
  name,
  category,
  className = "",
}: {
  name: string;
  category: string | null | undefined;
  /** 大きさと角の丸み（例: "size-12 rounded-xl"） */
  className?: string;
}) {
  const { glyph, tone } = pickCircleIcon(name, category);
  return (
    <div
      aria-hidden
      className={`flex shrink-0 items-center justify-center border ${TONE_CLASS[tone]} ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-[55%]"
      >
        <Glyph glyph={glyph} />
      </svg>
    </div>
  );
}
