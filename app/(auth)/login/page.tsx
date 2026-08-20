import type { Metadata } from "next";

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
    <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/5">
      <h1 className="text-xl font-semibold">ログイン</h1>
      <p className="mt-1 mb-6 text-sm text-gray-600 dark:text-gray-400">
        登録済みのアカウントでサインインしてください。
      </p>
      <LoginForm next={next} />
      {IS_DEV && <DevQuickLogin next={next} />}
    </div>
  );
}
