import { expect, test as setup } from "@playwright/test";

import { HOME, PASSWORD, statePath, USERS, type Role } from "./helpers/users";

/**
 * 先にログインして、Cookie を保存しておく。
 *
 * クイックログインのパネルは使わず、普通のログイン画面から入る。
 * 本番でも使われる経路をここで一度通しておきたいのと、
 * クイックログインは環境変数ひとつで消える機能なので、
 * それに依存するとテスト全体がその設定に縛られる。
 */
for (const role of Object.keys(USERS) as Role[]) {
  setup(`${role} としてログインしておく`, async ({ page }) => {
    await page.goto("/login");

    await page.getByLabel("メールアドレス").fill(USERS[role].email);
    await page.getByLabel("パスワード").fill(PASSWORD);
    await page.getByRole("button", { name: "ログイン" }).click();

    // 役割ごとに着地点が違う。ここがずれていたら lib/home.ts の
    // 振り分けが壊れているので、ログイン成功の確認を兼ねる。
    await page.waitForURL(`**${HOME[role]}`, { timeout: 20_000 });

    // ヘッダーに氏名が出ていれば、セッションが載っている
    await expect(
      page.getByRole("banner").getByText(USERS[role].name),
    ).toBeVisible();

    await page.context().storageState({ path: statePath(role) });
  });
}
