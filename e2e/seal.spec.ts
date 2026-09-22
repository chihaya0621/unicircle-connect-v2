import { expect, test } from "@playwright/test";

import { statePath } from "./helpers/users";

/**
 * 印影。
 *
 * 【書き込みについて】公開デモと同じデータベースを見ているので、
 * 変えたものは最後に必ず戻す。戻し漏れると、展示で来た人が
 * テストの残骸を見ることになる。
 */

test.describe("職員", () => {
  test.use({ storageState: statePath("staff") });

  test("印影の欄があり、入力すると見本が変わる", async ({ page }) => {
    await page.goto("/mypage");

    const section = page
      .locator("section")
      .filter({ has: page.getByRole("heading", { name: "印影" }) });
    await expect(section).toBeVisible();

    const input = section.getByLabel("彫る文字");
    const before = await input.inputValue();

    await input.fill("検証");
    // 見本は SVG で描かれる。aria-label に彫った文字が入る
    await expect(section.getByRole("img", { name: "検証 の印" })).toBeVisible();

    // 形を角に変えても見本が残る
    await section.getByText("角（角印）").click();
    await expect(section.getByRole("img", { name: "検証 の印" })).toBeVisible();

    // 入力しただけでは保存されない
    await page.reload();
    await expect(page.getByLabel("彫る文字")).toHaveValue(before);
  });

  test("保存して、元に戻せる", async ({ page }) => {
    await page.goto("/mypage");
    const input = page.getByLabel("彫る文字");
    const original = await input.inputValue();

    try {
      await input.fill("検証");
      await page.getByText("丸（認印）").click();
      await page.getByRole("button", { name: "印影を保存" }).click();

      await expect(page.getByRole("status")).toHaveText("印影を「検証」にしました。");
      await page.reload();
      await expect(page.getByLabel("彫る文字")).toHaveValue("検証");
    } finally {
      // 失敗しても必ず戻す
      await page.goto("/mypage");
      await page.getByLabel("彫る文字").fill(original);
      await page.getByRole("button", { name: "印影を保存" }).click();
      // 「印影を保存」ボタンにも当たるので、知らせの領域に絞る
      await expect(page.getByRole("status")).toContainText("印影を");
    }

    await page.reload();
    await expect(page.getByLabel("彫る文字")).toHaveValue(original);
  });

  test("5字以上は入らない", async ({ page }) => {
    await page.goto("/mypage");
    const input = page.getByLabel("彫る文字");
    const original = await input.inputValue();

    await input.fill("あいうえお");
    // 画面側で4字に切り詰める。サーバー側でも弾くが、
    // そこまで行かせないほうが分かりやすい
    await expect(input).toHaveValue("あいうえ");

    await input.fill(original);
  });
});

test.describe("学生", () => {
  test.use({ storageState: statePath("student") });

  test("印影の欄は出ない", async ({ page }) => {
    await page.goto("/mypage");
    await expect(page.getByRole("heading", { name: "印影" })).toHaveCount(0);
    await expect(page.getByLabel("彫る文字")).toHaveCount(0);
  });
});
