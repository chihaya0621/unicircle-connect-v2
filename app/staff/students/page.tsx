import type { Metadata } from "next";

import { PageHero } from "@/components/PageHero";
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
      <PageHero
        variant="circles"
        eyebrow="STUDENTS"
        title="学生の登録"
        description="本人が新規登録したあと、ここで氏名を登録すると学生として利用できるようになります。"
      />

      <section className="mb-10 glass-panel">
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
          <p className="glass-empty">
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
