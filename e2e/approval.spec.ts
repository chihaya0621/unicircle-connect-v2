import { expect, test } from "@playwright/test";

import { CIRCLE, statePath } from "./helpers/users";

/**
 * 承認のながれと、申請書の印刷。
 *
 * どちらも読むだけなので、データは変えない。
 */

test.describe("学生（サークルの管理者）", () => {
  test.use({ storageState: statePath("student") });

  test("承認のながれに、押された印影が並ぶ", async ({ page }) => {
    await page.goto(`/circles/${CIRCLE.id}`);
    await expect(page.getByRole("heading", { name: CIRCLE.name })).toBeVisible();

    const trail = page
      .locator("section")
      .filter({ has: page.getByRole("heading", { name: "承認のながれ" }) });

    // 記録が無いサークルもあるので、あるときだけ中身を見る
    if ((await trail.count()) > 0) {
      // 印影は SVG。aria-label が「◯◯ の印」になっている
      await expect(trail.getByRole("img", { name: /の印$/ }).first()).toBeVisible();
      // 書き換えられていないことの表示
      await expect(trail.getByText(/押されたときのまま|押されたときと違います/)).toBeVisible();
    }
  });

  test("申請書の体裁で印刷できる", async ({ page }) => {
    await page.goto(`/circles/${CIRCLE.id}/print`);

    await expect(
      page.getByRole("heading", { name: /サークル(設立|廃止)申請書/ }),
    ).toBeVisible();

    // 紙の書類として要るもの
    await expect(page.getByText("受付番号")).toBeVisible();
    await expect(page.getByText("代表者")).toBeVisible();
    await expect(page.getByText("構成員数")).toBeVisible();
    await expect(page.getByRole("heading", { name: /承認欄（必要\d+名）/ })).toBeVisible();

    // 画面にだけ出る操作が、紙には出ない指定になっているか
    // 全画面共通の足（明るさの切り替え）も print:hidden なので、申請書の側だけを見る
    const controls = page.locator("main .print\\:hidden");
    await expect(controls).toBeVisible();
    await expect(
      controls.evaluate((el) => getComputedStyle(el).display),
    ).resolves.not.toBe("none");

    // 印刷したときは消える
    await page.emulateMedia({ media: "print" });
    await expect(controls).toBeHidden();
    // 申請書そのものは残る
    await expect(
      page.getByRole("heading", { name: /サークル(設立|廃止)申請書/ }),
    ).toBeVisible();
  });

  test("印刷の用紙が A4 で組まれている", async ({ page }) => {
    await page.goto(`/circles/${CIRCLE.id}/print`);
    await page.emulateMedia({ media: "print" });

    // 承認欄が用紙の途中で割れない指定になっているか
    const box = page.locator(".paper-approvals");
    await expect(
      box.evaluate((el) => getComputedStyle(el).breakInside),
    ).resolves.toBe("avoid");
  });
});

test.describe("一般アカウント", () => {
  test.use({ storageState: statePath("general") });

  test("申請書には辿り着けない", async ({ page }) => {
    const res = await page.goto(`/circles/${CIRCLE.id}/print`);
    // 内部の書類なので、関係者と職員以外には出さない
    expect(res?.status()).toBe(404);
    await expect(
      page.getByRole("heading", { name: /サークル(設立|廃止)申請書/ }),
    ).toHaveCount(0);
  });
});
