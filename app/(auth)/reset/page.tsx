import type { Metadata } from "next";
import Link from "next/link";

import { PasswordResetForm } from "@/components/PasswordResetForm";

export const metadata: Metadata = {
  title: "パスワードの再設定 | UniCircle Connect",
};

export default function ResetPage() {
  return (
    <div className="glass-panel p-6">
      <h1 className="text-xl font-semibold">パスワードの再設定</h1>
      <p className="mb-6 mt-1 text-sm text-gray-600 dark:text-gray-400">
        登録しているメールアドレスに、再設定用のリンクをお送りします。
      </p>
      <PasswordResetForm />
      <p className="mt-6 text-sm">
        <Link href="/login" className="font-medium underline">
          ログインに戻る
        </Link>
      </p>
    </div>
  );
}
