import "server-only";

import { BOARD_VISIBLE_DAYS } from "@/lib/board";
import { createClient } from "@/lib/supabase-server";

/**
 * 学生のホーム「わたしのサークル」に並べるもの。
 *
 * 所属しているサークルごとに、次の予定・最新の連絡・対応が要るもの
 * （管理者なら参加申請と協賛の申し込み）を1行ずつまとめる。
 * サークルの数だけ問い合わせを繰り返さないよう、種類ごとに1回で引いて
 * から、サークルごとに振り分ける。
 */
export type MyCircleOverview = {
  id: string;
  name: string;
  isAdmin: boolean;
  nextEvent: { id: string; title: string; event_date: string } | null;
  latestPost: { body: string; created_at: string } | null;
  /** 管理者のみ: 返事を待っている参加申請 */
  pendingMembers: number;
  /** 管理者のみ: 返事を待っている協賛の申し込み */
  pendingOffers: number;
};

export type MyHomeOverview = {
  circles: MyCircleOverview[];
  /** 自分宛ての、代表の引き継ぎの申し出 */
  handovers: { circle_id: string; from_name: string }[];
};

export async function getMyHomeOverview(userId: string): Promise<MyHomeOverview> {
  const supabase = await createClient();

  const { data: memberships } = await supabase
    .from("circle_members")
    .select(
      "role, circle:circles!circle_members_circle_id_fkey(id, name, status)",
    )
    .eq("user_id", userId)
    .eq("status", "active")
    .returns<
      { role: "admin" | "member"; circle: { id: string; name: string; status: string } | null }[]
    >();

  const mine = (memberships ?? []).flatMap((m) =>
    m.circle && m.circle.status === "approved"
      ? [{ ...m.circle, isAdmin: m.role === "admin" }]
      : [],
  );
  const ids = mine.map((c) => c.id);
  const adminIds = mine.filter((c) => c.isAdmin).map((c) => c.id);

  if (ids.length === 0) {
    const { data: handovers } = await supabase
      .from("circle_handovers")
      .select("circle_id, from_name")
      .eq("to_user_id", userId)
      .eq("status", "pending");
    return { circles: [], handovers: handovers ?? [] };
  }

  const since = new Date(Date.now() - BOARD_VISIBLE_DAYS * 24 * 60 * 60 * 1000);
  const [events, posts, joins, requests, handovers] = await Promise.all([
    supabase
      .from("events")
      .select("id, title, event_date, host_circle_id")
      .in("host_circle_id", ids)
      .gte("event_date", new Date().toISOString())
      .order("event_date", { ascending: true })
      .limit(200),
    // 掲示板と同じく、期間内のものと、固定したお知らせ
    supabase
      .from("circle_posts")
      .select("circle_id, body, created_at")
      .in("circle_id", ids)
      .or(`is_pinned.eq.true,created_at.gte.${since.toISOString()}`)
      .order("created_at", { ascending: false })
      .limit(300),
    adminIds.length > 0
      ? supabase
          .from("circle_members")
          .select("circle_id")
          .in("circle_id", adminIds)
          .eq("status", "pending")
      : Promise.resolve({ data: [] as { circle_id: string | null }[] }),
    adminIds.length > 0
      ? supabase
          .from("sponsorship_requests")
          .select("id, circle_id")
          .in("circle_id", adminIds)
      : Promise.resolve({ data: [] as { id: string; circle_id: string }[] }),
    supabase
      .from("circle_handovers")
      .select("circle_id, from_name")
      .eq("to_user_id", userId)
      .eq("status", "pending"),
  ]);

  const requestCircle = new Map((requests.data ?? []).map((r) => [r.id, r.circle_id]));
  const { data: offers } =
    requestCircle.size > 0
      ? await supabase
          .from("sponsorship_offers")
          .select("request_id")
          .in("request_id", [...requestCircle.keys()])
          .eq("status", "pending")
      : { data: [] as { request_id: string }[] };

  const count = (keys: (string | null | undefined)[]) => {
    const m = new Map<string, number>();
    for (const k of keys) if (k) m.set(k, (m.get(k) ?? 0) + 1);
    return m;
  };
  const joinCounts = count((joins.data ?? []).map((j) => j.circle_id));
  const offerCounts = count((offers ?? []).map((o) => requestCircle.get(o.request_id)));

  const nextEvent = new Map<string, { id: string; title: string; event_date: string }>();
  for (const e of events.data ?? []) {
    if (e.host_circle_id && !nextEvent.has(e.host_circle_id)) {
      nextEvent.set(e.host_circle_id, { id: e.id, title: e.title, event_date: e.event_date });
    }
  }
  const latestPost = new Map<string, { body: string; created_at: string }>();
  for (const p of posts.data ?? []) {
    if (!latestPost.has(p.circle_id)) {
      latestPost.set(p.circle_id, { body: p.body, created_at: p.created_at });
    }
  }

  const circles: MyCircleOverview[] = mine.map((c) => ({
    id: c.id,
    name: c.name,
    isAdmin: c.isAdmin,
    nextEvent: nextEvent.get(c.id) ?? null,
    latestPost: latestPost.get(c.id) ?? null,
    pendingMembers: c.isAdmin ? (joinCounts.get(c.id) ?? 0) : 0,
    pendingOffers: c.isAdmin ? (offerCounts.get(c.id) ?? 0) : 0,
  }));

  // 動いているサークルを上に。対応が要るもの → 予定が近いもの →
  // 連絡が新しいもの → 名前の順。何も無いサークルは下にまとまる
  const score = (c: MyCircleOverview) => [
    c.pendingMembers + c.pendingOffers > 0 ? 0 : 1,
    c.nextEvent ? new Date(c.nextEvent.event_date).getTime() : Number.MAX_SAFE_INTEGER,
    c.latestPost ? -new Date(c.latestPost.created_at).getTime() : 0,
  ];
  circles.sort((a, b) => {
    const sa = score(a);
    const sb = score(b);
    for (let i = 0; i < sa.length; i++) {
      if (sa[i] !== sb[i]) return sa[i] - sb[i];
    }
    return a.name.localeCompare(b.name, "ja");
  });

  return { circles, handovers: handovers.data ?? [] };
}
