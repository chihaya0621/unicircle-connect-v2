import { expect, test } from "@playwright/test";

import { describeOverflow, findHorizontalOverflow } from "./helpers/layout";
import { CIRCLE, PUBLIC_EVENT, statePath } from "./helpers/users";

/**
 * 狭い画面でしか起きないこと。
 *
 * 処理そのものは幅で変わらないので、ここで見るのは配置と操作だけ。
 * 書き込みを伴うテストは走らせない（desktop 側と同じデータを
 * 取り合ううえ、幅を変えても結果は変わらない）。
 *
 * いちばん効くのは「横にはみ出していないか」。狭い画面の崩れは
 * だいたいこれで、一度実際にやっている。
 */

test.describe("横にはみ出さない", () => {
  const PAGES = [
    { path: "/", label: "トップ", auth: null },
    { path: "/circles", label: "サークル一覧", auth: null },
    { path: "/events", label: "イベント一覧", auth: null },
    { path: "/login", label: "ログイン", auth: null },
    { path: "/calendar", label: "カレンダー", auth: "student" },
    { path: "/board", label: "掲示板", auth: "student" },
    { path: "/mypage", label: "マイページ", auth: "student" },
    { path: `/circles/${CIRCLE.id}`, label: "サークル詳細", auth: "student" },
    { path: `/events/${PUBLIC_EVENT.id}`, label: "イベント詳細", auth: null },
    { path: "/facilities", label: "施設・備品", auth: "staff" },
    { path: "/reservations", label: "予約", auth: "staff" },
    { path: "/staff", label: "対応待ち", auth: "staff" },
  ] as const;

  for (const { path, label, auth } of PAGES) {
    test(`${label}`, async ({ browser }) => {
      const context = await browser.newContext({
        ...test.info().project.use,
        storageState: auth ? statePath(auth) : { cookies: [], origins: [] },
      });
      const page = await context.newPage();
      try {
        await page.goto(path);
        // 書体が載ると字幅が変わる。載る前に測ると、はみ出しを見落とす
        await page.evaluate(() => document.fonts.ready);
        const overflow = await findHorizontalOverflow(page);
        expect(overflow === null, overflow ? describeOverflow(overflow) : "").toBe(
          true,
        );
      } finally {
        await context.close();
      }
    });
  }
});

test.describe("メニュー", () => {
  test.use({ storageState: statePath("student") });

  test("畳まれていて、開くと行き先が出る", async ({ page }) => {
    await page.goto("/calendar");

    // 広い画面用の横並びは出ていない
    const wide = page.getByRole("banner").getByRole("navigation");
    await expect(wide).toBeHidden();

    const toggle = page.getByRole("button", { name: "メニューを開く" });
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");

    await toggle.click();
    await expect(
      page.getByRole("button", { name: "メニューを閉じる" }),
    ).toHaveAttribute("aria-expanded", "true");

    // 学生に見せる行き先が並ぶ。
    // 名前で探さないのは、承認待ちの件数がバッジで付くと
    // 読み上げ名が「サークル 3」になり、件数が変わるたびに落ちるため。
    const banner = page.getByRole("banner");
    for (const href of ["/calendar", "/circles", "/events", "/board", "/mypage"]) {
      await expect(
        // 広い画面用の並びも DOM には居る（隠れている）ので、見えているほうに絞る
        banner.locator(`a[href="${href}"]`).filter({ visible: true }),
      ).toBeVisible();
    }
  });

  test("Escape で閉じる", async ({ page }) => {
    await page.goto("/calendar");
    await page.getByRole("button", { name: "メニューを開く" }).click();
    await expect(
      page.getByRole("button", { name: "メニューを閉じる" }),
    ).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "メニューを開く" })).toBeVisible();
  });

  test("ページを移ると閉じる", async ({ page }) => {
    await page.goto("/calendar");
    await page.getByRole("button", { name: "メニューを開く" }).click();
    await page
      .getByRole("banner")
      .locator('a[href="/events"]')
      .filter({ visible: true })
      .click();

    await page.waitForURL("**/events");
    // 開いたままだと、移った先の画面がメニューに隠れる
    await expect(page.getByRole("button", { name: "メニューを開く" })).toBeVisible();
  });
});

test.describe("カレンダーの参加予定", () => {
  test.use({ storageState: statePath("student") });

  test("器の中だけで横に送れる", async ({ page }) => {
    await page.goto("/calendar");

    const track = page.locator(".deck-track");
    if ((await track.count()) === 0) {
      test.skip(true, "参加予定が無い状態ではカードが出ない");
    }

    // 中身は器より広い（送れる）
    const sizes = await track.first().evaluate((el) => ({
      scroll: el.scrollWidth,
      client: el.clientWidth,
    }));
    expect(sizes.scroll).toBeGreaterThan(sizes.client);

    // それでも本文は横に動かない
    const overflow = await findHorizontalOverflow(page);
    expect(overflow === null, overflow ? describeOverflow(overflow) : "").toBe(true);
  });
});

test.describe("申請書", () => {
  test.use({ storageState: statePath("student") });

  test("狭い画面でも読める形で出る", async ({ page }) => {
    await page.goto(`/circles/${CIRCLE.id}/print`);
    await expect(
      page.getByRole("heading", { name: /サークル(設立|廃止)申請書/ }),
    ).toBeVisible();

    // 用紙は A4 幅で組んであるが、画面では縮めて収める
    const overflow = await findHorizontalOverflow(page);
    expect(overflow === null, overflow ? describeOverflow(overflow) : "").toBe(true);
  });
});
