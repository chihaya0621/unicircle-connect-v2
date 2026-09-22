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

test.describe("サークルの管理者", () => {
  test.use({ storageState: statePath("student") });

  test("引き継ぎの欄が出て、相手を選べる", async ({ page }) => {
    await page.goto(`/circles/${CIRCLE.id}`);

    const panel = page
      .locator("section")
      .filter({ has: page.getByRole("heading", { name: "代表を引き継ぐ" }) });
    await expect(panel).toBeVisible();

    // 在籍しているメンバーから選ぶ。自分は入らない
    const select = panel.getByLabel("次の代表");
    await expect(select).toBeVisible();
    const options = select.locator("option");
    expect(await options.count()).toBeGreaterThan(1); // 「選んでください」＋人数
  });

  test("申し出を出して、取り下げられる", async ({ page }) => {
    await page.goto(`/circles/${CIRCLE.id}`);

    const panel = page
      .locator("section")
      .filter({ has: page.getByRole("heading", { name: "代表を引き継ぐ" }) });

    // 前回の残骸があれば先に片付ける
    if ((await panel.count()) === 0) {
      const pendingPanel = page.locator("section").filter({
        has: page.getByRole("heading", { name: "引き継ぎを申し出ています" }),
      });
      if ((await pendingPanel.count()) > 0) {
        await pendingPanel.getByRole("button", { name: "申し出を取り下げる" }).click();
        await page.waitForURL(`**/circles/${CIRCLE.id}`);
      }
      await page.goto(`/circles/${CIRCLE.id}`);
    }

    const select = page.getByLabel("次の代表");
    const value = await select.locator("option").nth(1).getAttribute("value");
    expect(value).toBeTruthy();

    try {
      await select.selectOption(value!);
      await page
        .getByLabel("申し送り（任意）")
        .fill("E2E の確認で出した申し出です。すぐ取り下げます。");
      await page.getByRole("button", { name: "引き継ぎを申し出る" }).click();

      // 申し出た側の画面に変わる
      await expect(
        page.getByRole("heading", { name: "引き継ぎを申し出ています" }),
      ).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText(/さんの返事を待っています/)).toBeVisible();

      // 出ているあいだは、もう一度は出せない
      await expect(
        page.getByRole("heading", { name: "代表を引き継ぐ" }),
      ).toHaveCount(0);
    } finally {
      // 失敗しても必ず取り下げる
      await page.goto(`/circles/${CIRCLE.id}`);
      const cancel = page.getByRole("button", { name: "申し出を取り下げる" });
      if ((await cancel.count()) > 0) {
        await cancel.click();
        await expect(
          page.getByRole("heading", { name: "代表を引き継ぐ" }),
        ).toBeVisible({ timeout: 15_000 });
      }
    }

    // 元に戻っている
    await page.goto(`/circles/${CIRCLE.id}`);
    await expect(page.getByRole("heading", { name: "代表を引き継ぐ" })).toBeVisible();
  });
});

test.describe("職員", () => {
  test.use({ storageState: statePath("staff") });

  test("引き継ぎの欄は出ない（メンバーではないため）", async ({ page }) => {
    await page.goto(`/circles/${CIRCLE.id}`);
    await expect(page.getByRole("heading", { name: "代表を引き継ぐ" })).toHaveCount(0);
  });
});
