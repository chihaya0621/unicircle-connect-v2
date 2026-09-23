/**
 * サークルの分野（0033）。DB の CHECK 制約と同じ値にすること。
 * 並びは一覧の絞り込みに出す順。
 */
export const CIRCLE_CATEGORIES = [
  { value: "sports", label: "運動" },
  { value: "music", label: "音楽" },
  { value: "culture", label: "文化・芸術" },
  { value: "academic", label: "学術・研究" },
  { value: "volunteer", label: "ボランティア・地域" },
  { value: "international", label: "国際交流" },
  { value: "other", label: "その他" },
] as const;

export type CircleCategory = (typeof CIRCLE_CATEGORIES)[number]["value"];

export function isCircleCategory(v: unknown): v is CircleCategory {
  return CIRCLE_CATEGORIES.some((c) => c.value === v);
}

export function categoryLabel(v: string | null | undefined): string | null {
  return CIRCLE_CATEGORIES.find((c) => c.value === v)?.label ?? null;
}
