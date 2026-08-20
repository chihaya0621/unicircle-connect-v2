import type { Metadata } from "next";

import { CircleForm } from "@/components/CircleForm";
import { getMyUniversityId, requireRole } from "@/lib/dal";
import { createClient } from "@/lib/supabase-server";

export const metadata: Metadata = { title: "サークル設立申請 | UniCircle Connect" };

export default async function NewCirclePage() {
  // 学生以外はダッシュボードへ戻される
  await requireRole("student");

  const myUniversityId = await getMyUniversityId();
  const supabase = await createClient();
  const { data: universities } = await supabase
    .from("universities")
    .select("id, name")
    .order("name");

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <h1 className="text-2xl font-bold tracking-tight">サークル設立申請</h1>
      <p className="mt-1 mb-6 text-sm text-gray-600 dark:text-gray-400">
        所属大学のサークルとして申請します。
      </p>
      <CircleForm
        universities={universities ?? []}
        myUniversityId={myUniversityId}
      />
    </div>
  );
}
