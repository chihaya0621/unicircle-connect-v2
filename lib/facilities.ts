import "server-only";

import type { ApprovalStatus, FacilityCategory } from "@/lib/database.types";
import { createClient } from "@/lib/supabase-server";

export type Facility = {
  id: string;
  name: string;
  category: FacilityCategory | null;
  is_available: boolean;
  university_id: string | null;
};

export type Reservation = {
  id: string;
  facility_id: string | null;
  booked_by_user_id: string | null;
  group_circle_id: string | null;
  start_time: string;
  end_time: string;
  purpose: string | null;
  status: ApprovalStatus;
  facility: { name: string; university_id: string | null } | null;
  booker: { name: string } | null;
  circle: { name: string } | null;
};

const RESERVATION_SELECT = `
  id, facility_id, booked_by_user_id, group_circle_id,
  start_time, end_time, purpose, status,
  facility:facilities!facility_reservations_facility_id_fkey(name, university_id),
  booker:users!facility_reservations_booked_by_user_id_fkey(name),
  circle:circles!facility_reservations_group_circle_id_fkey(name)
` as const;

/**
 * 予約主体を解決する。
 *
 * reservations_booker_check により booked_by_user_id と group_circle_id は
 * ちょうど片方だけが NOT NULL。
 */
export function reservationBooker(reservation: Reservation) {
  if (reservation.group_circle_id) {
    return {
      kind: "circle" as const,
      name: reservation.circle?.name ?? "サークル",
    };
  }
  return {
    kind: "user" as const,
    name: reservation.booker?.name ?? "利用者",
  };
}

/** 施設は大学の資産なので、自大学のものだけを返す */
export async function listFacilities(universityId: string | null) {
  if (!universityId) return [] as Facility[];

  const supabase = await createClient();
  const { data } = await supabase
    .from("facilities")
    .select("id, name, category, is_available, university_id")
    .eq("university_id", universityId)
    .order("category")
    .order("name")
    .returns<Facility[]>();

  return data ?? [];
}

export async function getFacility(facilityId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("facilities")
    .select("id, name, category, is_available, university_id")
    .eq("id", facilityId)
    .maybeSingle()
    .returns<Facility>();
  return data ?? null;
}

/**
 * ある施設の、これから先の予約枠。
 * 却下・取り消し済みは枠を占有しないので除外する。
 */
export async function listFacilityReservations(facilityId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("facility_reservations")
    .select(RESERVATION_SELECT)
    .eq("facility_id", facilityId)
    .neq("status", "rejected")
    .gte("end_time", new Date().toISOString())
    .order("start_time")
    .returns<Reservation[]>();
  return data ?? [];
}

/**
 * 自分に関係する予約（個人予約 + 所属サークルの予約）。
 */
export async function listMyReservations(userId: string) {
  const supabase = await createClient();

  const { data: memberships } = await supabase
    .from("circle_members")
    .select("circle_id")
    .eq("user_id", userId)
    .eq("status", "active");

  const circleIds = (memberships ?? [])
    .map((m) => m.circle_id)
    .filter((id): id is string => Boolean(id));

  // PostgREST の or() は「自分の予約 または 所属サークルの予約」を1クエリで表現できる
  const filter = circleIds.length
    ? `booked_by_user_id.eq.${userId},group_circle_id.in.(${circleIds.join(",")})`
    : `booked_by_user_id.eq.${userId}`;

  const { data } = await supabase
    .from("facility_reservations")
    .select(RESERVATION_SELECT)
    .or(filter)
    .gte("end_time", new Date().toISOString())
    .order("start_time")
    .returns<Reservation[]>();

  return data ?? [];
}

/** 職員の承認待ちキュー（自大学の施設のみ） */
export async function listPendingReservations(universityId: string | null) {
  if (!universityId) return [] as Reservation[];

  const supabase = await createClient();
  const { data } = await supabase
    .from("facility_reservations")
    .select(RESERVATION_SELECT)
    .eq("status", "pending")
    .gte("end_time", new Date().toISOString())
    .order("start_time")
    .returns<Reservation[]>();

  // 施設の所属大学での絞り込みは埋め込み先の列なので、取得後に行う
  return (data ?? []).filter(
    (r) => r.facility?.university_id === universityId,
  );
}

/** 予約時にサークル名義を選べるよう、参加中の承認済みサークルを返す */
export async function listBookableCircles(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("circle_members")
    .select(
      `circle:circles!circle_members_circle_id_fkey(id, name, status)`,
    )
    .eq("user_id", userId)
    .eq("status", "active")
    .returns<{ circle: { id: string; name: string; status: string } | null }[]>();

  return (data ?? [])
    .map((m) => m.circle)
    .filter(
      (c): c is { id: string; name: string; status: string } =>
        c !== null && c.status === "approved",
    );
}
