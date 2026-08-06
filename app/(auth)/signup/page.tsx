import type { Metadata } from "next";

import { SignupForm } from "@/components/SignupForm";
import { createClient } from "@/lib/supabase-server";

export const metadata: Metadata = { title: "新規登録 | UniCircle Connect" };

export default async function SignupPage() {
  // 大学一覧は Server Component でフェッチしてフォームに渡す
  const supabase = await createClient();
  const { data: universities } = await supabase
    .from("universities")
    .select("id, name")
    .order("name");

  return (
    <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/5">
      <h1 className="text-xl font-semibold">アカウント作成</h1>
      <p className="mt-1 mb-6 text-sm text-gray-600 dark:text-gray-400">
        学生として参加するか、一般ユーザーとして公開イベントを閲覧できます。
      </p>
      <SignupForm universities={universities ?? []} />
    </div>
  );
}
