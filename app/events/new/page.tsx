import type { Metadata } from "next";
import Link from "next/link";

import { EventForm } from "@/components/EventForm";
import { getMyUniversityId, requireRole } from "@/lib/dal";
import { listHostableCircles } from "@/lib/events";
import { createClient } from "@/lib/supabase-server";

export const metadata: Metadata = { title: "イベント作成 | UniCircle Connect" };

export default async function NewEventPage() {
  // 一般ユーザーはイベントを作成できない（要件定義書3章）
  const user = await requireRole("student", "staff");

  const myUniversityId = await getMyUniversityId();
  const circles = await listHostableCircles(user.id);

  const supabase = await createClient();
  const { data: universities } = await supabase
    .from("universities")
    .select("id, name")
    .order("name");

  // 学生は大学公式イベントを作れないため、管理者を務めるサークルが
  // 1つも無いと主催者を選べない。作成させずに理由を説明する。
  if (user.role === "student" && circles.length === 0) {
    return (
      <div className="mx-auto max-w-xl px-4 py-10">
        <h1 className="text-2xl font-bold tracking-tight">イベント作成</h1>
        <p className="mt-4 rounded-xl border border-dashed border-black/15 px-4 py-10 text-center text-sm text-gray-500 dark:border-white/15 dark:text-gray-400">
          イベントを作成するには、承認済みサークルの管理者である必要があります。
          <br />
          <Link
            href="/circles"
            className="mt-2 inline-block font-medium text-indigo-600 hover:underline dark:text-indigo-400"
          >
            サークルを探す・設立する
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <h1 className="text-2xl font-bold tracking-tight">イベント作成</h1>
      <p className="mt-1 mb-6 text-sm text-gray-600 dark:text-gray-400">
        {user.role === "staff"
          ? "大学公式イベント、または管理しているサークルのイベントを作成します。"
          : "管理しているサークルのイベントを作成します。"}
      </p>
      <EventForm
        role={user.role}
        circles={circles}
        universities={universities ?? []}
        myUniversityId={myUniversityId}
      />
    </div>
  );
}
