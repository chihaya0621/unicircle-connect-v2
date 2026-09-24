import { expect, test } from "@playwright/test";

import { PUBLIC_EVENT, statePath } from "./helpers/users";

/**
 * 誰がどこまで辿り着けるか。
 *
 * データベース側は supabase/tests/01_rls.sql が見ている。こちらは
 * 画面として成立しているかのほう。RLS が正しくても、ページが
 * 落ちていたり、押せないボタンが出ていたりすれば利用者は困る。
 */

test.describe("未ログイン", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("公開されているサークルは見られる", async ({ page }) => {
    await page.goto("/circles");
    await expect(page.getByRole("heading", { name: "サークル" }).first()).toBeVisible();
    // 都道府県から辿る導線が出ている
    await expect(page.getByText("東京都", { exact: false }).first()).toBeVisible();
  });

  test("学外向けのイベントだけが並ぶ", async ({ page }) => {
    await page.goto("/events");
    await expect(page.getByRole("heading", { name: "イベント" }).first()).toBeVisible();
    await expect(page.getByText("オープンキャンパス").first()).toBeVisible();
  });

  test("カレンダーはログインへ送られる", async ({ page }) => {
    await page.goto("/calendar");
    await expect(page).toHaveURL(/\/login/);
  });

  test("掲示板はログインへ送られる", async ({ page }) => {
    await page.goto("/board");
    await expect(page).toHaveURL(/\/login/);
  });

  test("大学を選ぶと、札の件数どおりにサークルが並ぶ", async ({ page }) => {
    // 以前は全国から名前順に120件だけ取ってから大学で絞っていたので、
    // 9件ある大学を開いても1件しか出ないことがあった
    await page.goto(`/circles?pref=${encodeURIComponent("東京都")}`);
    const tiles = await page
      .locator("main a[href*='university=']")
      .evaluateAll((links) =>
        links.map((a) => ({
          href: a.getAttribute("href") ?? "",
          count: Number(/(\d+)件/.exec(a.textContent ?? "")?.[1] ?? NaN),
        })),
      );
    expect(tiles.length).toBeGreaterThan(0);

    for (const tile of tiles) {
      await page.goto(tile.href);
      const shown = await page
        .locator("main a[href^='/circles/']")
        .evaluateAll(
          (links) => new Set(links.map((a) => a.getAttribute("href"))).size,
        );
      expect(shown, tile.href).toBe(tile.count);
    }
  });

  test("県を選んでから分野で絞っても、県の外の大学は混ざらない", async ({
    page,
  }) => {
    const pref = encodeURIComponent("東京都");
    await page.goto(`/circles?pref=${pref}`);
    // 札の名前は、拠点が複数ある大学だけ「大学名（拠点）」になっている
    const universities = new Set(
      (
        await page
          .locator("main a[href*='university='] span.font-medium")
          .allTextContents()
      ).map((label) => label.replace(/（.*）$/, "")),
    );

    await page.goto(`/circles?pref=${pref}&cat=music`);
    const groups = await page.locator("main section h2").allTextContents();
    expect(groups.length).toBeGreaterThan(0);
    for (const name of groups) expect(universities, name).toContain(name);
  });

  test("見つからないサークルは、日本語の画面で戻り道を出す", async ({
    page,
  }) => {
    await page.goto("/circles/00000000-0000-4000-8000-000000000000");
    await expect(
      page.getByRole("heading", { name: "ページが見つかりません" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "トップへ戻る" })).toBeVisible();
  });

  test("ログイン画面にデモの案内が出ている", async ({ page }) => {
    await page.goto("/login");
    // 展示で来た人が、登録せずに触れることが分かる状態か
    await expect(
      page.getByText("デモ用アカウントで試す", { exact: false }),
    ).toBeVisible();
  });
});

test.describe("一般アカウント（高校生・企業）", () => {
  test.use({ storageState: statePath("general") });

  test("施設予約には入れない", async ({ page }) => {
    const res = await page.goto("/facilities");
    // requireRole が弾く。ログインへ送られるか、404 になる
    expect(page.url()).not.toContain("/facilities");
    expect(res?.status()).toBeLessThan(500);
  });

  test("掲示板には入れない", async ({ page }) => {
    await page.goto("/board");
    expect(page.url()).not.toMatch(/\/board$/);
  });

  test("イベントは見られるが、参加登録のボタンは出ない", async ({ page }) => {
    await page.goto(`/events/${PUBLIC_EVENT.id}`);
    await expect(
      page.getByRole("heading", { name: PUBLIC_EVENT.title }),
    ).toBeVisible();

    // 一般アカウントは見に来る立場で、参加者名簿に載る立場ではない（0020）
    await expect(page.getByRole("button", { name: "参加する" })).toHaveCount(0);
  });
});

test.describe("学生", () => {
  test.use({ storageState: statePath("student") });

  test("カレンダーに着地して、自分の予定が出る", async ({ page }) => {
    await page.goto("/calendar");
    await expect(page.getByRole("heading", { name: /月/ }).first()).toBeVisible();
  });

  test("掲示板に入れる", async ({ page }) => {
    await page.goto("/board");
    await expect(page).toHaveURL(/\/board$/);
    await expect(page.getByRole("heading", { name: "掲示板" }).first()).toBeVisible();
  });
});

test.describe("職員", () => {
  test.use({ storageState: statePath("staff") });

  test("サークル一覧に承認のきまりが出る", async ({ page }) => {
    await page.goto("/circles");
    await expect(page.getByText("承認のきまり")).toBeVisible();
    await expect(page.getByText("必要な承認者数")).toBeVisible();
  });

  test("代替わりしていないサークルの一覧が出る", async ({ page }) => {
    await page.goto("/circles");
    // 0030 を入れた直後は、承認済みのサークルが全部ここに並ぶ
    await expect(
      page.getByText("今年度まだ代替わりしていないサークル", { exact: false }),
    ).toBeVisible();
  });

  test("施設予約のマスタ管理に入れる", async ({ page }) => {
    await page.goto("/facilities");
    await expect(page).toHaveURL(/\/facilities$/);
    // 「キャンパス」は文中にも出るので、見出しで特定する
    await expect(page.getByRole("heading", { name: "キャンパス" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "施設・備品を登録" })).toBeVisible();
  });
});
