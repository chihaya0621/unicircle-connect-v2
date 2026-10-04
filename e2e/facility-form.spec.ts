import { expect, test } from "@playwright/test";

import { statePath } from "./helpers/users";

/**
 * 施設使用許可願の、大学ごとの項目（0038）。
 *
 * 公開デモの大学の様式を書き換えるので、最後に既定に戻す。
 */

const LABEL = "E2E の確認項目";

test.describe("職員", () => {
  test.use({ storageState: statePath("staff") });

  test("足した項目が見本と学生のフォームに出て、既定に戻せる", async ({
    page,
    browser,
  }) => {
    await page.goto("/facilities");
    await page.getByRole("link", { name: "項目を変える" }).click();
    await expect(page.getByRole("heading", { name: "使用許可願の項目" })).toBeVisible();

    await page.getByRole("button", { name: "項目を足す" }).click();
    await page.getByLabel("項目の名前").last().fill(LABEL);
    await page.getByLabel(/^選択肢/).last().fill("はい\nいいえ");
    await page.getByRole("button", { name: "保存する" }).click();
    await expect(page.getByText("使用許可願の項目を保存しました")).toBeVisible();

    // 見本に出る
    const preview = page.getByRole("region", { name: "学生に見える形（見本）" });
    await expect(preview.getByText(LABEL)).toBeVisible();

    // 学生のフォームにも出る
    const student = await browser.newContext({
      ...test.info().project.use,
      storageState: statePath("student"),
    });
    try {
      const studentPage = await student.newPage();
      await studentPage.goto("/facilities");
      await studentPage
        .getByRole("region", { name: /^施設（/ })
        .getByRole("link", { name: "空き状況・予約" })
        .first()
        .click();
      await expect(studentPage.getByRole("heading", { name: "施設使用許可願" })).toBeVisible();
      await expect(studentPage.getByText(LABEL)).toBeVisible();
      await expect(studentPage.getByRole("radio", { name: "はい" })).toBeVisible();
    } finally {
      await student.close();
    }

    // 既定に戻す
    await page.getByRole("button", { name: "既定に戻す…" }).click();
    await page.getByRole("button", { name: "既定に戻す", exact: true }).click();
    await expect(page.getByText("既定の項目に戻しました")).toBeVisible();
    await expect(preview.getByText(LABEL)).toHaveCount(0);
  });
});
