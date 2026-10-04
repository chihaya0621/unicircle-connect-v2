import "server-only";

import { currentTermYear } from "@/lib/handover";
import { jstDate } from "@/lib/jst";
import { createClient } from "@/lib/supabase-server";

/**
 * 職員のレポート。自分の大学の、今年度の申請と、サークルの状況。
 *
 * 大学が導入を決めるときに知りたいのは「どれだけ楽になったか」。
 * 紙の回覧では数えられなかった、届いた件数・判断までにかかった日数・
 * 止まっている申請を、記録からそのまま数えて見せる。
 *
 * 数えるのは RLS 越しに読める行だけ。職員は自分の大学のサークル、
 * 施設の予約、協賛の募集と、その承認の記録を読める。
 */

/** 止まっているとみなす日数 */
export const STUCK_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

export type KindSummary = {
  /** 今年度に届いた件数 */
  received: number;
  /** そのうち、承認・却下・見送りが決まった件数 */
  decided: number;
  /** まだ決まっていない件数（年度をまたいだものも含む。予約は使う日時の前のものだけ） */
  pending: number;
  /** 届いてから決まるまでの日数の中央値。決まったものが無ければ null */
  medianDays: number | null;
};

export type StuckItem = {
  kind: "設立の申請" | "廃止の申請" | "施設の予約" | "協賛の募集";
  name: string;
  /** 届いた日時 */
  since: string;
  /** 届いてから今までの日数（切り捨て） */
  waitingDays: number;
  /** 対応する画面 */
  href: string;
};

export type StaffReport = {
  termYear: number;
  setups: KindSummary;
  reservations: KindSummary;
  sponsorships: KindSummary;
  stuck: StuckItem[];
  /** 承認済み（活動中）のサークル */
  activeCircles: number;
  /** そのうち、今年度に代替わりしたサークル */
  handedOver: number;
};

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function daysBetween(from: string, to: string): number {
  return Math.max(0, (new Date(to).getTime() - new Date(from).getTime()) / DAY_MS);
}

/**
 * 判断が決まった時刻。
 * 却下は1人で決まるので最初の却下、承認は人数がそろった最後の承認。
 */
function decidedAt(
  records: { decision: string; created_at: string }[],
): string | null {
  const rejected = records.find((r) => r.decision === "rejected");
  if (rejected) return rejected.created_at;
  const approved = records.filter((r) => r.decision === "approved");
  return approved.length > 0 ? approved[approved.length - 1].created_at : null;
}

export async function getStaffReport(
  universityId: string,
  now: Date = new Date(),
): Promise<StaffReport> {
  const supabase = await createClient();
  const termYear = currentTermYear(now);
  // 年度は4月1日（日本時間）から
  const termStart = jstDate(termYear, 3, 1).toISOString();
  const stuckBefore = new Date(now.getTime() - STUCK_DAYS * DAY_MS).toISOString();

  const [circlesRes, reservationsRes, sponsorshipsRes] = await Promise.all([
    supabase
      .from("circles")
      .select("id, name, status, created_at, closure_requested_at, term_year")
      .eq("university_id", universityId)
      .returns<
        {
          id: string;
          name: string;
          status: string;
          created_at: string;
          closure_requested_at: string | null;
          term_year: number | null;
        }[]
      >(),
    supabase
      .from("facility_reservations")
      .select("id, status, created_at, end_time, facility:facilities!inner(name, university_id)")
      .eq("facility.university_id", universityId)
      .gte("created_at", termStart)
      .returns<
        {
          id: string;
          status: string;
          created_at: string;
          end_time: string;
          facility: { name: string } | null;
        }[]
      >(),
    supabase
      .from("sponsorship_requests")
      .select("id, title, status, created_at, decided_at, circle:circles!inner(name, university_id)")
      .eq("circle.university_id", universityId)
      .returns<
        {
          id: string;
          title: string;
          status: string;
          created_at: string;
          decided_at: string | null;
          circle: { name: string } | null;
        }[]
      >(),
  ]);

  for (const res of [circlesRes, reservationsRes, sponsorshipsRes]) {
    if (res.error) console.error("レポートの集計に失敗しました:", res.error.message);
  }
  const circles = circlesRes.data ?? [];
  const reservations = reservationsRes.data ?? [];
  const sponsorships = sponsorshipsRes.data ?? [];

  // 判断までの日数は、承認の記録から求める（申請の行には決まった時刻が無い）
  const setupIds = circles
    .filter((c) => c.created_at >= termStart)
    .map((c) => c.id);
  const reservationIds = reservations.map((r) => r.id);
  const [setupApprovals, reservationApprovals] = await Promise.all([
    setupIds.length > 0
      ? supabase
          .from("approvals")
          .select("target_id, decision, created_at")
          .eq("target_type", "circle")
          .in("target_id", setupIds)
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [] as { target_id: string; decision: string; created_at: string }[] }),
    reservationIds.length > 0
      ? supabase
          .from("approvals")
          .select("target_id, decision, created_at")
          .eq("target_type", "reservation")
          .in("target_id", reservationIds)
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [] as { target_id: string; decision: string; created_at: string }[] }),
  ]);

  const byTarget = (rows: { target_id: string; decision: string; created_at: string }[] | null) => {
    const map = new Map<string, { decision: string; created_at: string }[]>();
    for (const r of rows ?? []) {
      const list = map.get(r.target_id) ?? [];
      list.push(r);
      map.set(r.target_id, list);
    }
    return map;
  };
  const setupRecords = byTarget(setupApprovals.data);
  const reservationRecords = byTarget(reservationApprovals.data);

  // ── 設立の申請 ───────────────────────────────────────────
  const setupsThisTerm = circles.filter((c) => c.created_at >= termStart);
  const setupDays = setupsThisTerm
    .filter((c) => c.status === "approved" || c.status === "rejected" || c.status === "closed")
    .flatMap((c) => {
      const at = decidedAt(setupRecords.get(c.id) ?? []);
      return at ? [daysBetween(c.created_at, at)] : [];
    });
  const setups: KindSummary = {
    received: setupsThisTerm.length,
    decided: setupsThisTerm.filter((c) => c.status !== "pending").length,
    pending: circles.filter((c) => c.status === "pending").length,
    medianDays: median(setupDays),
  };

  // ── 施設の予約 ───────────────────────────────────────────
  const reservationDays = reservations
    .filter((r) => r.status !== "pending")
    .flatMap((r) => {
      const at = decidedAt(reservationRecords.get(r.id) ?? []);
      return at ? [daysBetween(r.created_at, at)] : [];
    });
  // 返事が無いまま使う日時を過ぎた予約は、もう対応のしようがないので
  // 対応中にも、止まっている申請にも数えない（対応待ちの件数と同じ数え方）
  const nowIso = now.toISOString();
  const openReservations = reservations.filter(
    (r) => r.status === "pending" && r.end_time >= nowIso,
  );
  const reservationSummary: KindSummary = {
    received: reservations.length,
    decided: reservations.filter((r) => r.status !== "pending").length,
    pending: openReservations.length,
    medianDays: median(reservationDays),
  };

  // ── 協賛の募集 ───────────────────────────────────────────
  const sponsorshipsThisTerm = sponsorships.filter((s) => s.created_at >= termStart);
  const sponsorshipSummary: KindSummary = {
    received: sponsorshipsThisTerm.length,
    decided: sponsorshipsThisTerm.filter((s) => s.status !== "pending").length,
    pending: sponsorships.filter((s) => s.status === "pending").length,
    medianDays: median(
      sponsorshipsThisTerm.flatMap((s) =>
        s.decided_at ? [daysBetween(s.created_at, s.decided_at)] : [],
      ),
    ),
  };

  // ── 止まっている申請 ─────────────────────────────────────
  const stuck: StuckItem[] = [
    ...circles
      .filter((c) => c.status === "pending" && c.created_at < stuckBefore)
      .map((c) => ({
        kind: "設立の申請" as const,
        name: c.name,
        since: c.created_at,
        href: `/circles/${c.id}/print`,
      })),
    ...circles
      .filter((c) => c.closure_requested_at && c.closure_requested_at < stuckBefore)
      .map((c) => ({
        kind: "廃止の申請" as const,
        name: c.name,
        since: c.closure_requested_at as string,
        href: `/circles/${c.id}/print`,
      })),
    ...openReservations
      .filter((r) => r.created_at < stuckBefore)
      .map((r) => ({
        kind: "施設の予約" as const,
        name: r.facility?.name ?? "施設",
        since: r.created_at,
        href: "/reservations",
      })),
    ...sponsorships
      .filter((s) => s.status === "pending" && s.created_at < stuckBefore)
      .map((s) => ({
        kind: "協賛の募集" as const,
        name: `${s.circle?.name ?? "サークル"}「${s.title}」`,
        since: s.created_at,
        href: "/staff",
      })),
  ]
    .map((item) => ({
      ...item,
      waitingDays: Math.floor(daysBetween(item.since, now.toISOString())),
    }))
    .sort((a, b) => a.since.localeCompare(b.since));

  // ── 代替わり ─────────────────────────────────────────────
  const active = circles.filter((c) => c.status === "approved");

  return {
    termYear,
    setups,
    reservations: reservationSummary,
    sponsorships: sponsorshipSummary,
    stuck,
    activeCircles: active.length,
    handedOver: active.filter((c) => (c.term_year ?? 0) >= termYear).length,
  };
}

/** 日数の表示。1日に満たなければ時間で。「2.5日」「6時間」 */
export function formatDays(days: number | null): string {
  if (days === null) return "—";
  if (days < 1) return `${Math.max(1, Math.round(days * 24))}時間`;
  return `${(Math.round(days * 10) / 10).toFixed(1)}日`;
}
