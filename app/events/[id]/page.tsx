import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";

import { deleteEvent, joinEvent, leaveEvent } from "@/app/actions/events";
import {
  removeEventImage,
  uploadEventImage,
} from "@/app/actions/images";
import { EventRoster, type RosterEntry } from "@/components/EventRoster";
import { ImageUploader } from "@/components/ImageUploader";
import { getCurrentUser, getMyUniversityId } from "@/lib/dal";
import { canManageEvent, eventHost, eventVisibleTo, getEvent } from "@/lib/events";
import { imageUrl } from "@/lib/images";
import { createClient } from "@/lib/supabase-server";

const dateFormatter = new Intl.DateTimeFormat("ja-JP", {
  dateStyle: "full",
  timeStyle: "short",
  timeZone: "Asia/Tokyo",
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const event = await getEvent(id);
  return { title: `${event?.title ?? "イベント"} | UniCircle Connect` };
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const event = await getEvent(id);
  if (!event) notFound();

  const user = await getCurrentUser();
  const universityId = await getMyUniversityId();

  // 一覧と同じ可視判定を詳細ページでも行う。
  // URL を直接開かれても、範囲外の人には見せない。
  const visible =
    user && user.role !== "general"
      ? eventVisibleTo(event, universityId)
      : event.visibility === "public";
  if (!visible) notFound();

  const host = eventHost(event);
  const canManage = user
    ? await canManageEvent(event, user.id, universityId, user.role)
    : false;

  // 参加状態。職員は運営側なので参加登録の対象外。
  const canParticipate = user !== null && user.role !== "staff";
  let isGoing = false;
  if (canParticipate && user) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("event_participants")
      .select("status")
      .eq("event_id", event.id)
      .eq("user_id", user.id)
      .maybeSingle();
    isGoing = data?.status === "going";
  }
  const isPast = new Date(event.event_date) < new Date();
  const image = imageUrl(event.image_path);

  // 参加名簿は主催者のみ。RPC 側でも主催者判定を行う。
  let roster: RosterEntry[] = [];
  if (canManage) {
    const supabase = await createClient();
    const { data } = await supabase.rpc("list_event_roster", {
      p_event_id: event.id,
    });
    roster = (data ?? []) as RosterEntry[];
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      {/* フライヤーは縦長・正方形など比率がまちまちなので、切らずに全体を見せる */}
      {image && (
        <div className="relative mb-6 aspect-video w-full overflow-hidden rounded-xl border border-black/10 bg-black/[0.03] dark:border-white/10 dark:bg-white/5">
          <Image
            src={image}
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, 768px"
            priority
            className="object-contain"
          />
        </div>
      )}

      <header className="mb-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight">{event.title}</h1>
          <span
            className={`shrink-0 rounded-full px-3 py-1 text-xs ${
              event.visibility === "public"
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                : event.visibility === "scoped"
                  ? "bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300"
                  : "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
            }`}
          >
            {event.visibility === "public"
              ? "公開"
              : event.visibility === "scoped"
                ? "指定大学のみ"
                : "学内限定"}
          </span>
        </div>

        <p className="mt-3 text-sm text-gray-700 dark:text-gray-300">
          <time dateTime={event.event_date}>
            {dateFormatter.format(new Date(event.event_date))}
          </time>
        </p>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {host.kind === "university" ? "大学主催" : "サークル主催"} ／ {host.name}
        </p>

        {event.visibility === "scoped" &&
          event.scoped_university_names.length > 0 && (
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              公開先:{" "}
              {event.scoped_university_names
                .map((u) => u.university?.name)
                .filter(Boolean)
                .join("・")}
            </p>
          )}
      </header>

      {canParticipate && !isPast && (
        <div className="mb-8">
          {isGoing ? (
            <form action={leaveEvent} className="flex items-center gap-3">
              <input type="hidden" name="event_id" value={event.id} />
              <span className="text-sm font-medium text-rose-700 dark:text-rose-300">
                参加予定です
              </span>
              <button
                type="submit"
                className="rounded-lg border border-black/15 px-3 py-1.5 text-sm font-medium transition hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
              >
                参加を取り消す
              </button>
            </form>
          ) : (
            <form action={joinEvent}>
              <input type="hidden" name="event_id" value={event.id} />
              <button
                type="submit"
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500"
              >
                参加する
              </button>
            </form>
          )}
        </div>
      )}

      {event.description && (
        <p className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
          {event.description}
        </p>
      )}

      {event.target_grades && event.target_grades.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-2 text-sm font-semibold">対象</h2>
          <ul className="flex flex-wrap gap-1.5">
            {event.target_grades.map((g) => (
              <li
                key={g}
                className="rounded-md bg-black/5 px-2 py-0.5 text-xs text-gray-700 dark:bg-white/10 dark:text-gray-300"
              >
                {g}
              </li>
            ))}
          </ul>
        </div>
      )}

      {canManage && (
        <section className="mt-10 border-t border-black/10 pt-6 dark:border-white/10">
          <h2 className="mb-4 text-lg font-semibold">イベントの画像</h2>
          <ImageUploader
            action={uploadEventImage}
            removeAction={removeEventImage}
            idField="event_id"
            idValue={event.id}
            currentUrl={image}
            label="イベントの画像"
            shape="contain"
            hint="縦長・正方形など、比率はそのままに全体を表示します。一覧では正方形に切り出されます。JPEG / PNG / WebP / GIF、5MBまで。"
          />
        </section>
      )}

      {canManage && (
        <section className="mt-10 border-t border-black/10 pt-6 dark:border-white/10">
          <h2 className="mb-3 text-lg font-semibold">参加名簿</h2>
          <EventRoster eventId={event.id} roster={roster} />
        </section>
      )}

      {canManage && (
        <div className="mt-10 border-t border-black/10 pt-6 dark:border-white/10">
          <form action={deleteEvent}>
            <input type="hidden" name="event_id" value={event.id} />
            <button
              type="submit"
              className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 dark:border-red-900/50 dark:text-red-300 dark:hover:bg-red-950/40"
            >
              このイベントを削除する
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
