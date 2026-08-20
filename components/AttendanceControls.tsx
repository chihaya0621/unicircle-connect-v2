import { setAttendance } from "@/app/actions/activities";
import type { AttendanceStatus } from "@/lib/activities";

/**
 * 出欠の切り替えボタン。
 *
 * 自分ぶんにも他人ぶん（管理者のみ）にも使う。
 * 権限判定は DB 側が行うので、ここは表示の出し分けだけ。
 */
export function AttendanceControls({
  activityId,
  circleId,
  current,
  userId,
  size = "md",
}: {
  activityId: string;
  circleId: string;
  current: AttendanceStatus | null;
  /** 省略時は自分自身の出欠 */
  userId?: string;
  size?: "sm" | "md";
}) {
  const base =
    size === "sm"
      ? "rounded border px-2 py-0.5 text-xs transition"
      : "rounded-lg border px-3 py-1.5 text-sm font-medium transition";

  const style = (active: boolean, tone: "present" | "absent") => {
    if (!active) {
      return `${base} border-black/15 text-gray-600 hover:bg-black/5 dark:border-white/15 dark:text-gray-400 dark:hover:bg-white/10`;
    }
    return tone === "present"
      ? `${base} border-emerald-500 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-200`
      : `${base} border-gray-400 bg-gray-100 text-gray-700 dark:border-gray-600 dark:bg-white/10 dark:text-gray-300`;
  };

  return (
    <div className="flex shrink-0 gap-1.5">
      {(["present", "absent"] as const).map((status) => (
        <form key={status} action={setAttendance}>
          <input type="hidden" name="activity_id" value={activityId} />
          <input type="hidden" name="circle_id" value={circleId} />
          <input type="hidden" name="status" value={status} />
          {userId && <input type="hidden" name="user_id" value={userId} />}
          <button
            type="submit"
            className={style(current === status, status)}
          >
            {status === "present" ? "出席" : "欠席"}
          </button>
        </form>
      ))}
    </div>
  );
}
