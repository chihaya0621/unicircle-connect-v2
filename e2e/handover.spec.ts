import { expect, test } from "@playwright/test";

import { CIRCLE, statePath } from "./helpers/users";

/**
 * 代替わり。
 *
 * 【書き込みについて】公開デモと同じデータベースを見ているので、
 * 申し出を出したら必ず取り下げるところまでを1本にする。
 * 実際に「受ける」ところまでやると管理者が入れ替わり、元に戻すには
 * 相手としてログインし直す必要がある。そこまではやらない。
 * 受けたときに何が起きるかは supabase/tests/03_handover.sql が見ている。
 */

/** 申し出の入力欄は、ページ末尾の「このサークルとの関係」に畳んである */
const TOGGLE = "代表を引き継ぐ（代替わり）";

test.describe("サークルの管理者", () => {
  test.use({ storageState: statePath("student") });

  test("引き継ぎの欄は畳まれていて、開くと相手を選べる", async ({ page }) => {
    await page.goto(`/circles/${CIRCLE.id}`);

    // 年に1度の操作なので、先頭には出さない
    await expect(page.getByLabel("次の代表")).toBeHidden();

    await page.getByText(TOGGLE).click();

    // 在籍しているメンバーから選ぶ。自分は入らない
    const select = page.getByLabel("次の代表");
    await expect(select).toBeVisible();
    const options = select.locator("option");
    expect(await options.count()).toBeGreaterThan(1); // 「選んでください」＋人数
  });

  test("申し出を出して、取り下げられる", async ({ page }) => {
    await page.goto(`/circles/${CIRCLE.id}`);

    // 前回の残骸があれば先に片付ける
    const leftover = page.getByRole("button", { name: "申し出を取り下げる" });
    if ((await leftover.count()) > 0) {
      await leftover.click();
      await expect(page.getByText(TOGGLE)).toBeVisible({ timeout: 15_000 });
      await page.goto(`/circles/${CIRCLE.id}`);
    }

    await page.getByText(TOGGLE).click();
    const select = page.getByLabel("次の代表");
    const value = await select.locator("option").nth(1).getAttribute("value");
    expect(value).toBeTruthy();

    try {
      await select.selectOption(value!);
      await page
        .getByLabel("申し送り（任意）")
        .fill("E2E の確認で出した申し出です。すぐ取り下げます。");
      await page.getByRole("button", { name: "引き継ぎを申し出る" }).click();

      // 返事待ちの申し出は、ページの先頭に出る
      await expect(
        page.getByRole("heading", { name: "引き継ぎを申し出ています" }),
      ).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText(/さんの返事を待っています/)).toBeVisible();

      // 出ているあいだは、もう一度は出せない
      await expect(page.getByText(TOGGLE)).toHaveCount(0);
    } finally {
      // 失敗しても必ず取り下げる
      await page.goto(`/circles/${CIRCLE.id}`);
      const cancel = page.getByRole("button", { name: "申し出を取り下げる" });
      if ((await cancel.count()) > 0) {
        await cancel.click();
        await expect(page.getByText(TOGGLE)).toBeVisible({ timeout: 15_000 });
      }
    }

    // 元に戻っている
    await page.goto(`/circles/${CIRCLE.id}`);
    await expect(page.getByText(TOGGLE)).toBeVisible();
  });
});

test.describe("職員", () => {
  test.use({ storageState: statePath("staff") });

  test("引き継ぎの欄は出ない（メンバーではないため）", async ({ page }) => {
    await page.goto(`/circles/${CIRCLE.id}`);
    await expect(page.getByText(TOGGLE)).toHaveCount(0);
  });
});
