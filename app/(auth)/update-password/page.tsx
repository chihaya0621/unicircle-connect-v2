import type { Metadata } from "next";

import { UpdatePasswordForm } from "@/components/PasswordResetForm";

export const metadata: Metadata = {
  title: "新しいパスワード | UniCircle Connect",
};

export default function UpdatePasswordPage() {
  return (
    <div className="glass-panel p-6">
      <h1 className="text-xl font-semibold">新しいパスワード</h1>
      <p className="mb-6 mt-1 text-sm text-gray-600 dark:text-gray-400">
        8文字以上で設定してください。設定するとそのままログインします。
      </p>
      <UpdatePasswordForm />
    </div>
  );
}
