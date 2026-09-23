import type { Page } from "@playwright/test";

/**
 * 横にはみ出していないかを調べる。
 *
 * 狭い画面で起きる崩れのほとんどは、これ一つで見つかる。
 * 幅の広い表・長い URL・負のマージン・固定幅の画像あたりが原因で、
 * 本文ごと横スクロールするようになる。実際に一度やっている。
 *
 * 落ちたときに「はみ出している」とだけ言われても直せないので、
 * どの要素が原因かまで返す。
 */
export type Overflow = {
  scrollWidth: number;
  clientWidth: number;
  /** はみ出している要素。読める形にしたもの */
  culprits: string[];
};

export async function findHorizontalOverflow(
  page: Page,
): Promise<Overflow | null> {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const limit = doc.clientWidth;

    // 1px のずれは丸め誤差で出る。それで落とすと直しようがない
    if (doc.scrollWidth <= limit + 1) return null;

    /**
     * 自分で横スクロールする器の中にあるものは、はみ出していて正しい。
     * カードを横に並べて指で送る作りは、器の外には出ていない。
     */
    const insideScroller = (el: Element) => {
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const ox = getComputedStyle(p).overflowX;
        if (ox === "auto" || ox === "scroll" || ox === "hidden") return true;
      }
      return false;
    };

    const culprits: string[] = [];
    for (const el of Array.from(document.body.querySelectorAll("*"))) {
      if (culprits.length >= 5) break;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.right <= limit + 1) continue;
      if (insideScroller(el)) continue;

      const cls =
        typeof el.className === "string"
          ? el.className.trim().split(/\s+/).slice(0, 3).join(".")
          : "";
      const text = (el.textContent ?? "").trim().slice(0, 24);
      culprits.push(
        `${el.tagName.toLowerCase()}${cls ? `.${cls}` : ""}` +
          ` 右端=${Math.round(r.right)}px` +
          (text ? ` 「${text}」` : ""),
      );
    }

    return { scrollWidth: doc.scrollWidth, clientWidth: limit, culprits };
  });
}

/** 失敗したときに読める文章にする */
export function describeOverflow(o: Overflow): string {
  return [
    `本文が横にはみ出しています（${o.scrollWidth}px > ${o.clientWidth}px）`,
    ...o.culprits.map((c) => `  - ${c}`),
  ].join("\n");
}
