import type { Metadata } from "next";
import Link from "next/link";

import { DevQuickLogin } from "@/components/DevQuickLogin";
import { LoginForm } from "@/components/LoginForm";
import { IS_DEV } from "@/lib/dev-users";

export const metadata: Metadata = { title: "ログイン | UniCircle Connect" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  // Next.js 15 以降、searchParams は Promise なので await が必要
  const { next } = await searchParams;

  return (
    <div className="glass-panel p-6">
      <h1 className="text-xl font-semibold">ログイン</h1>
      <p className="mt-1 mb-6 text-sm text-gray-600 dark:text-gray-400">
        登録済みのアカウントでサインインしてください。
      </p>
      <LoginForm next={next} />
      <p className="mt-4 text-sm">
        <Link href="/reset" className="font-medium underline">
          パスワードを忘れた場合
        </Link>
      </p>
      {IS_DEV && <DevQuickLogin next={next} />}
    </div>
  );
}
