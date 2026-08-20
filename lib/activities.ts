import "server-only";

import { createClient } from "@/lib/supabase-server";

export type AttendanceStatus = "present" | "absent";

export type Attendance = {
  user_id: string;
  status: AttendanceStatus;
  user: { name: string } | null;
};

export type Activity = {
  id: string;
  circle_id: string;
  title: string;
  activity_date: string;
  location: string | null;
  note: string | null;
  attendances: Attendance[];
};

/** メンバーごとの出席率（活動記録の集計） */
export type MemberStats = {
  user_id: string;
  name: string;
  present: number;
  absent: number;
  /** 記録が無い活動。出席とも欠席とも判断できない */
  unrecorded: number;
};

const ACTIVITY_SELECT = `
  id, circle_id, title, activity_date, location, note,
  attendances:activity_attendances(
    user_id, status,
    user:users!activity_attendances_user_id_fkey(name)
  )
` as const;

/**
 * サークルの活動記録。新しい順。
 * RLS により非メンバーは0件になる。
 */
export async function listActivities(circleId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("circle_activities")
    .select(ACTIVITY_SELECT)
    .eq("circle_id", circleId)
    .order("activity_date", { ascending: false })
    .limit(100)
    .returns<Activity[]>();
  return data ?? [];
}

/**
 * メンバーごとの出欠集計。
 *
 * 出欠が記録されていない活動は present/absent のどちらにも数えず
 * unrecorded として分けている。未記録を欠席とみなすと、
 * 記録を取り忘れた回で出席率が不当に下がるため。
 */
export function summarizeAttendance(
  activities: Activity[],
  members: { user_id: string; name: string }[],
): MemberStats[] {
  return members
    .map((m) => {
      let present = 0;
      let absent = 0;
      for (const a of activities) {
        const record = a.attendances.find((x) => x.user_id === m.user_id);
        if (record?.status === "present") present++;
        else if (record?.status === "absent") absent++;
      }
      return {
        user_id: m.user_id,
        name: m.name,
        present,
        absent,
        unrecorded: activities.length - present - absent,
      };
    })
    .sort((a, b) => b.present - a.present || a.name.localeCompare(b.name));
}
