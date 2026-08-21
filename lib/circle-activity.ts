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
 * 人数は circle_event_stats（RPC）から取る。event_participants を直接
 * 数えると、RLS により一般メンバーには自分の1件しか返らず、
 * 常に「1人」と表示されてしまうため。
 * この RPC は人数だけを返し、誰が参加したかは返さない。
 */
export async function getCircleActivity(
  circleId: string,
  limit = 10,
): Promise<ActivitySummary> {
  const events = await listPastCircleEvents(circleId, limit);
  if (events.length === 0) return { activities: [], total: 0 };

  const supabase = await createClient();
  const { data: stats, error } = await supabase.rpc("circle_event_stats", {
    p_circle_id: circleId,
  });

  if (error) {
    // 集計が取れなくても活動の一覧自体は出す
    console.error("活動記録の集計に失敗しました:", error.message);
  }

  const byEvent = new Map<string, { present: number; registered: number }>();
  for (const s of stats ?? []) {
    byEvent.set(s.stat_event_id, {
      registered: s.stat_registered,
      present: s.stat_present,
    });
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
