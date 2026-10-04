import { expect, test, type Page } from "@playwright/test";

import { statePath } from "./helpers/users";

/**
 * 施設の使用許可願（0037）。
 *
 * 公開デモのデータに書き込むので、出した予約はすぐに取り消す。取り消した行は
 * 「取り消し」として残るが、毎晩のデモの戻しで消える。日時は、デモの予約と
 * 重ならない半年以上先の早朝にする。
 */

/** 日本時間で今日から n 日後の日付（YYYY-MM-DD） */
function jstDate(days: number): string {
  return new Date(Date.now() + 9 * 3_600_000 + days * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

/** 予約の一覧（ReservationList）での、その日の 5:00 の書き方 */
function listed(date: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Tokyo",
  }).format(new Date(`${date}T05:00:00+09:00`));
}

/** 自分の予約から、その日の承認待ちを取り消す */
async function cancelOn(page: Page, date: string) {
  const waiting = page
    .getByRole("listitem")
    .filter({ hasText: listed(date) })
    .filter({ hasText: "承認待ち" });
  for (let i = 0; i < 3 && (await waiting.count()) > 0; i++) {
    await waiting.first().getByRole("button", { name: "取り消す" }).click();
    await expect(waiting).toHaveCount(0);
  }
}

test.describe("学生", () => {
  test.use({ storageState: statePath("student") });

  test("使用許可願を2日分まとめて出し、取り消せる", async ({ page }) => {
    const days = [jstDate(200), jstDate(207)];

    // 前の実行が途中で落ちて、同じ日時の予約が残っていれば先に取り消す
    await page.goto("/reservations");
    for (const day of days) await cancelOn(page, day);

    await page.goto("/facilities");
    await page
      .getByRole("region", { name: /^施設（/ })
      .getByRole("link", { name: "空き状況・予約" })
      .first()
      .click();
    await expect(page.getByRole("heading", { name: "施設使用許可願" })).toBeVisible();

    await page.getByLabel("目的", { exact: true }).fill("E2E の確認（すぐに取り消します）");
    await page.getByLabel("学生（名）", { exact: true }).fill("2");
    await expect(page.getByText("合計 2 名")).toBeVisible();

    await page.getByRole("button", { name: "日時を追加" }).click();
    const dates = page.getByLabel(/^日付/);
    const starts = page.getByRole("combobox", { name: "開始時刻" });
    const ends = page.getByRole("combobox", { name: "終了時刻" });
    for (const [i, day] of days.entries()) {
      await dates.nth(i).fill(day);
      await starts.nth(i).selectOption("05:00");
      await ends.nth(i).selectOption("05:30");
    }
    // 日付を選ぶと、見出しに曜日が添えられる
    await expect(page.getByText(/^日付（[日月火水木金土]）$/)).toHaveCount(2);

    await page.getByRole("button", { name: "使用許可を申請する" }).click();
    await expect(page.getByText("2日分の使用許可願を出しました")).toBeVisible();

    // 自分の予約に2日分が並び、利用人員が出る。取り消して元に戻す
    await page.goto("/reservations");
    for (const day of days) {
      const item = page
        .getByRole("listitem")
        .filter({ hasText: listed(day) })
        .filter({ hasText: "承認待ち" });
      await expect(item).toHaveCount(1);
      await expect(item).toContainText("学生2名");
      await cancelOn(page, day);
    }
  });
});
