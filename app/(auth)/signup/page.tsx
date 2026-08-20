import type { Metadata } from "next";

import { SignupForm } from "@/components/SignupForm";

export const metadata: Metadata = { title: "新規登録 | UniCircle Connect" };

export default function SignupPage() {
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/5">
      <h1 className="text-xl font-semibold">アカウント作成</h1>
      <p className="mt-1 mb-6 text-sm text-gray-600 dark:text-gray-400">
        メールアドレスで登録できます。学生・職員としての登録は大学が行います。
      </p>
      <SignupForm />
    </div>
  );
}
