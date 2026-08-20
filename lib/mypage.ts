import "server-only";

import type {
  ApprovalStatus,
  CircleRole,
  MembershipStatus,
  UserRole,
} from "@/lib/database.types";
import { createClient } from "@/lib/supabase-server";

export type MyProfile = {
  name: string;
  role: UserRole;
  email: string | null;
  university: string | null;
  bio: string | null;
  skills: string[] | null;
  enrollment_year: number | null;
};

export type MyEvent = {
  id: string;
  title: string;
  event_date: string;
  host_university: { name: string } | null;
  host_circle: { name: string } | null;
};

export type MyCircle = {
  role: CircleRole;
  status: MembershipStatus;
  circle: {
    id: string;
    name: string;
    status: ApprovalStatus;
    university: { name: string } | null;
  } | null;
};

export type MyReservation = {
  id: string;
  start_time: string;
  end_time: string;
  purpose: string | null;
  status: ApprovalStatus;
  facility: { name: string } | null;
  circle: { name: string } | null;
};

/**
 * 自分のプロフィール。
 *
 * 学生のみ student_profiles を持つため、無い場合は bio 等が null になる。
 * RLS により、そもそも自分の行しか取得できない。
 */
export async function getMyProfile(
  userId: string,
  role: UserRole,
  email: string | null,
): Promise<MyProfile | null> {
  const supabase = await createClient();

  const { data: user } = await supabase
    .from("users")
    .select("name, role")
    .eq("id", userId)
    .maybeSingle();

  if (!user) return null;

  const base = { name: user.name, role, email };

  if (role === "student") {
    const { data } = await supabase
      .from("student_profiles")
      .select(
        `bio, skills, enrollment_year,
         university:universities!student_profiles_university_id_fkey(name)`,
      )
      .eq("user_id", userId)
      .maybeSingle()
      .returns<{
        bio: string | null;
        skills: string[] | null;
        enrollment_year: number | null;
        university: { name: string } | null;
      }>();

    return {
      ...base,
      university: data?.university?.name ?? null,
      bio: data?.bio ?? null,
      skills: data?.skills ?? null,
      enrollment_year: data?.enrollment_year ?? null,
    };
  }

  if (role === "staff") {
    const { data } = await supabase
      .from("staff_profiles")
      .select(
        `university:universities!staff_profiles_university_id_fkey(name)`,
      )
      .eq("user_id", userId)
      .maybeSingle()
      .returns<{ university: { name: string } | null }>();

    return {
      ...base,
      university: data?.university?.name ?? null,
      bio: null,
      skills: null,
      enrollment_year: null,
    };
  }

  return { ...base, university: null, bio: null, skills: null, enrollment_year: null };
}

/**
 * 参加登録したイベントを、これからと過去に分けて返す。
 *
 * 取り消した（cancelled）ものは履歴に出さない。
 * RLS により自分の登録しか取得できない。
 */
export async function listMyEvents(userId: string) {
  const supabase = await createClient();

  const { data } = await supabase
    .from("event_participants")
    .select(
      `event:events!event_participants_event_id_fkey(
         id, title, event_date,
         host_university:universities!events_host_university_id_fkey(name),
         host_circle:circles!events_host_circle_id_fkey(name)
       )`,
    )
    .eq("user_id", userId)
    .eq("status", "going")
    .returns<{ event: MyEvent | null }[]>();

  const events = (data ?? [])
    .map((r) => r.event)
    .filter((e): e is MyEvent => e !== null);

  const now = Date.now();
  const upcoming = events
    .filter((e) => new Date(e.event_date).getTime() >= now)
    .sort((a, b) => a.event_date.localeCompare(b.event_date));
  const past = events
    .filter((e) => new Date(e.event_date).getTime() < now)
    .sort((a, b) => b.event_date.localeCompare(a.event_date));

  return { upcoming, past };
}

/** 所属しているサークルと、そこでの役割 */
export async function listMyCircleMemberships(userId: string) {
  const supabase = await createClient();

  const { data } = await supabase
    .from("circle_members")
    .select(
      `role, status,
       circle:circles!circle_members_circle_id_fkey(
         id, name, status,
         university:universities!circles_university_id_fkey(name)
       )`,
    )
    .eq("user_id", userId)
    .order("created_at")
    .returns<MyCircle[]>();

  return data ?? [];
}

/** 施設予約の履歴（今後と過去の両方） */
export async function listMyReservationHistory(userId: string) {
  const supabase = await createClient();

  const { data: memberships } = await supabase
    .from("circle_members")
    .select("circle_id")
    .eq("user_id", userId)
    .eq("status", "active");

  const circleIds = (memberships ?? [])
    .map((m) => m.circle_id)
    .filter((id): id is string => Boolean(id));

  const filter = circleIds.length
    ? `booked_by_user_id.eq.${userId},group_circle_id.in.(${circleIds.join(",")})`
    : `booked_by_user_id.eq.${userId}`;

  const { data } = await supabase
    .from("facility_reservations")
    .select(
      `id, start_time, end_time, purpose, status,
       facility:facilities!facility_reservations_facility_id_fkey(name),
       circle:circles!facility_reservations_group_circle_id_fkey(name)`,
    )
    .or(filter)
    .order("start_time", { ascending: false })
    .limit(50)
    .returns<MyReservation[]>();

  const rows = data ?? [];
  const now = Date.now();

  return {
    upcoming: rows
      .filter((r) => new Date(r.end_time).getTime() >= now)
      .sort((a, b) => a.start_time.localeCompare(b.start_time)),
    past: rows.filter((r) => new Date(r.end_time).getTime() < now),
  };
}
