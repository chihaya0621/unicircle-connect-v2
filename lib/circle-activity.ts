import "server-only";

import type { EventListItem } from "@/lib/events";
import { listPastCircleEvents } from "@/lib/events";
import { createClient } from "@/lib/supabase-server";

export type PastActivity = EventListItem & {
  /** 出席として記録された人数 */
  present: number;
  /** 参加登録した人数 */
  registered: number;
};

export type ActivitySummary = {
  activities: PastActivity[];
  /** 期間中の活動回数 */
  total: number;
};

/**
 * 過去のイベントを活動記録として組み立てる。
 *
 * 専用のテーブルは作らない。イベントと出欠に「いつ何をして誰が来たか」が
 * すでに入っているので、それを振り返る形にする。別テーブルを持つと
 * 同じ活動を2回入力することになり、記録が食い違う。
 *
 * 出欠の内訳は主催者しか読めない（RLS）。メンバーには参加登録の人数だけが
 * 見える形になり、それでも「どのくらいの規模だったか」は分かる。
 */
export async function getCircleActivity(
  circleId: string,
  limit = 10,
): Promise<ActivitySummary> {
  const events = await listPastCircleEvents(circleId, limit);
  if (events.length === 0) return { activities: [], total: 0 };

  const supabase = await createClient();
  const { data: participants } = await supabase
    .from("event_participants")
    .select("event_id, status, attended")
    .in(
      "event_id",
      events.map((e) => e.id),
    );

  const byEvent = new Map<string, { present: number; registered: number }>();
  for (const p of participants ?? []) {
    if (p.status !== "going") continue;
    const acc = byEvent.get(p.event_id) ?? { present: 0, registered: 0 };
    acc.registered += 1;
    if (p.attended === true) acc.present += 1;
    byEvent.set(p.event_id, acc);
  }

  return {
    activities: events.map((e) => ({
      ...e,
      present: byEvent.get(e.id)?.present ?? 0,
      registered: byEvent.get(e.id)?.registered ?? 0,
    })),
    total: events.length,
  };
}
