import "server-only";

import {
  todayJst,
  type CircleSponsor,
  type MyOffer,
  type Sponsorship,
  type SponsorshipOffer,
} from "@/lib/sponsorship-shared";
import { createClient } from "@/lib/supabase-server";

export {
  formatDeadline,
  formatYen,
  isAccepting,
  todayJst,
} from "@/lib/sponsorship-shared";
export type {
  CircleSponsor,
  MyOffer,
  Sponsorship,
  SponsorshipOffer,
} from "@/lib/sponsorship-shared";

/**
 * サークル協賛（0036）。
 *
 * 読める範囲は RLS が決める。確認待ちと見送りの募集は、そのサークルの
 * メンバーと大学の職員にしか返らない。申し込みは、申し込んだ本人と、
 * サークルの管理者と、大学の職員にしか返らない。外に出す協賛企業の
 * 名前は、list_circle_sponsors で別に引く。
 */
const COLUMNS =
  "id, circle_id, title, purpose, amount_goal, returns, deadline, status, created_at, decided_at, closed_at, checked_by_name, checked_seal_text, checked_seal_shape";

const WITH_CIRCLE = `${COLUMNS}, circle:circles(id, name, image_path, university:universities!circles_university_id_fkey(name))`;

const OFFER_COLUMNS =
  "id, request_id, sponsor_id, sponsor_name, sponsor_url, amount, message, status, created_at, decided_at";

/**
 * 公開中で、締め切り日を過ぎていない募集。締め切りの近い順。
 *
 * 企業が探す一覧に使う。見えるのは、閲覧者がサークルを見られる募集だけ
 * （一般と未ログインには、公開設定のサークルの募集だけ）。
 */
export async function listOpenSponsorships(limit = 60): Promise<Sponsorship[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sponsorship_requests")
    .select(WITH_CIRCLE)
    .eq("status", "open")
    .gte("deadline", todayJst())
    .order("deadline", { ascending: true })
    .limit(limit)
    .returns<Sponsorship[]>();

  if (error) {
    console.error("協賛の募集の取得に失敗しました:", error.message);
    return [];
  }
  return data ?? [];
}

/** 募集を1件。見えなければ null */
export async function getSponsorship(id: string): Promise<Sponsorship | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sponsorship_requests")
    .select(WITH_CIRCLE)
    .eq("id", id)
    .maybeSingle<Sponsorship>();

  if (error) {
    console.error("協賛の募集の取得に失敗しました:", error.message);
    return null;
  }
  return data;
}

/** そのサークルの募集。見える範囲で、新しい順 */
export async function listCircleSponsorships(
  circleId: string,
): Promise<Sponsorship[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sponsorship_requests")
    .select(WITH_CIRCLE)
    .eq("circle_id", circleId)
    .order("created_at", { ascending: false })
    .returns<Sponsorship[]>();

  if (error) {
    console.error("協賛の募集の取得に失敗しました:", error.message);
    return [];
  }
  return data ?? [];
}

/** 募集への申し込み。当事者にしか返らない。古い順 */
export async function listOffers(
  requestIds: string[],
): Promise<SponsorshipOffer[]> {
  if (requestIds.length === 0) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sponsorship_offers")
    .select(OFFER_COLUMNS)
    .in("request_id", requestIds)
    .order("created_at", { ascending: true })
    .returns<SponsorshipOffer[]>();

  if (error) {
    console.error("協賛の申し込みの取得に失敗しました:", error.message);
    return [];
  }
  return data ?? [];
}

/** 自分（企業）の申し込み。新しい順 */
export async function listMyOffers(userId: string): Promise<MyOffer[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sponsorship_offers")
    .select(
      `${OFFER_COLUMNS}, request:sponsorship_requests(id, title, deadline, status, circle:circles(id, name))`,
    )
    .eq("sponsor_id", userId)
    .order("created_at", { ascending: false })
    .returns<MyOffer[]>();

  if (error) {
    console.error("協賛の申し込みの取得に失敗しました:", error.message);
    return [];
  }
  return data ?? [];
}

/** 成立した協賛企業の名前。サークルが見える人なら誰でも */
export async function listCircleSponsors(
  circleId: string,
): Promise<CircleSponsor[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_circle_sponsors", {
    p_circle_id: circleId,
  });

  if (error) {
    console.error("協賛企業の取得に失敗しました:", error.message);
    return [];
  }
  return data ?? [];
}

/** 職員: 自分の大学の、確認待ちの募集。古い順（待たせている順） */
export async function listPendingSponsorships(
  universityId: string | null,
): Promise<Sponsorship[]> {
  if (!universityId) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sponsorship_requests")
    .select(
      `${COLUMNS}, circle:circles!inner(id, name, image_path, university_id, university:universities!circles_university_id_fkey(name))`,
    )
    .eq("status", "pending")
    .eq("circle.university_id", universityId)
    .order("created_at", { ascending: true })
    .returns<Sponsorship[]>();

  if (error) {
    console.error("確認待ちの協賛の取得に失敗しました:", error.message);
    return [];
  }
  return data ?? [];
}
