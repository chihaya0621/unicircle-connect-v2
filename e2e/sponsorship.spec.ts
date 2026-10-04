import { expect, test } from "@playwright/test";

import { SPONSORSHIP_FOR_OFFER, statePath } from "./helpers/users";

/**
 * 協賛の申し込み（0036）。
 *
 * 公開デモのデータに書き込むので、申し込んだらすぐに取り下げて、
 * 返事待ちの申し込みを残さない。取り下げた行は残るが、当事者にしか
 * 見えず、毎晩のデモの戻しで消える。
 */

test.describe("企業（一般アカウント）", () => {
  test.use({ storageState: statePath("general") });

  test("協賛を申し込んで、取り下げられる", async ({ page }) => {
    await page.goto(`/sponsorships/${SPONSORSHIP_FOR_OFFER.id}`);

    // 前の実行が途中で落ちて、返事待ちが残っていれば先に取り下げる
    const withdraw = page.getByRole("button", { name: "申し込みを取り下げる" });
    if (await withdraw.isVisible()) {
      await withdraw.click();
      await expect(page.getByText("申し込みを取り下げました。")).toBeVisible();
    }

    await page.getByLabel("会社名・団体名").fill("株式会社E2E（架空）");
    await page.getByLabel("金額（円）").fill("10000");
    await page.getByRole("button", { name: "協賛を申し込む" }).click();
    await expect(
      page.getByText("サークルが受けると成立し、通知でお知らせします"),
    ).toBeVisible();
    await expect(page.getByText("サークルの返事を待っています。")).toBeVisible();

    await page.getByRole("button", { name: "申し込みを取り下げる" }).click();
    await expect(page.getByText("申し込みを取り下げました。")).toBeVisible();
  });
});
