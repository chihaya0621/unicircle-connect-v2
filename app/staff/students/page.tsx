import type { Metadata } from "next";

import { StudentRegisterForm } from "@/components/StudentRegisterForm";
import { StudentRow, type Student } from "@/components/StudentRow";
import { requireRole } from "@/lib/dal";
import { createClient } from "@/lib/supabase-server";

export const metadata: Metadata = { title: "学生の登録 | UniCircle Connect" };

export default async function StaffStudentsPage() {
  await requireRole("staff");

  // 学生のメールアドレスは auth.users にあり、テーブル経由では読めない。
  // 職員だけが実行できる RPC が唯一の照会経路になっている。
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_university_students");
  const students = (data ?? []) as Student[];

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">学生の登録</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          本人が新規登録したあと、ここで氏名を登録すると学生として利用できるようになります。
        </p>
      </header>

      <section className="mb-10 rounded-xl border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-white/5">
        <h2 className="mb-4 text-sm font-semibold">学生を登録する</h2>
        <StudentRegisterForm />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">
          登録済みの学生
          <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
            {students.length}名
          </span>
        </h2>

        {error && (
          <p
            role="alert"
            className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
          >
            学生一覧の取得に失敗しました: {error.message}
          </p>
        )}

        {students.length === 0 ? (
          <p className="rounded-xl border border-dashed border-black/15 px-4 py-10 text-center text-sm text-gray-500 dark:border-white/15 dark:text-gray-400">
            まだ学生が登録されていません。
          </p>
        ) : (
          <ul className="space-y-2">
            {students.map((s) => (
              <StudentRow key={s.student_id} student={s} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
