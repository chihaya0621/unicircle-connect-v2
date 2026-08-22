import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { EventEditForm } from "@/components/EventEditForm";
import { requireUser } from "@/lib/dal";
import { getMyUniversityId } from "@/lib/dal";
import { listUniversities } from "@/lib/discovery";
import { canManageEvent, getEvent } from "@/lib/events";

export const metadata: Metadata = {
  title: "イベントの編集 | UniCircle Connect",
};

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  const event = await getEvent(id);
  if (!event) notFound();

  // 主催者かどうかは lib 側の判定に合わせる。DB 関数も同じ判定をする
  const universityId = await getMyUniversityId();
  const canManage = await canManageEvent(event, user.id, universityId, user.role);
  if (!canManage) redirect(`/events/${id}`);

  const universities = await listUniversities();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-1 text-2xl font-bold tracking-tight">
        イベントの編集
      </h1>
      <p className="mb-6 text-sm text-gray-600 dark:text-gray-400">
        日時を変えると、参加者に設定されたリマインドは新しい日時で送り直されます。
      </p>

      <div className="glass-panel">
        <EventEditForm
          event={{
            id: event.id,
            title: event.title,
            description: event.description,
            event_date: event.event_date,
            visibility: event.visibility,
            target_grades: event.target_grades,
            public_listed: event.public_listed,
            scopedUniversityIds: event.scoped_universities.map(
              (u) => u.university_id,
            ),
          }}
          universities={universities}
          hostUniversityId={event.host_university_id}
        />
      </div>

      <p className="mt-6 text-sm">
        <Link href={`/events/${id}`} className="font-medium underline">
          イベントに戻る
        </Link>
      </p>
    </div>
  );
}
