import { recordAttendance } from "@/app/actions/attendance";

export type RosterEntry = {
  roster_user_id: string;
  roster_name: string;
  roster_attended: boolean | null;
};

/**
 * 参加名簿。主催者が当日に出欠を記録する。
 *
 * 3状態（未記録 / 出席 / 欠席）を持つので、選択中のボタンをもう一度押すと
 * 未記録に戻る。押し間違いを取り消せるようにするため。
 */
export function EventRoster({
  eventId,
  roster,
}: {
  eventId: string;
  roster: RosterEntry[];
}) {
  const present = roster.filter((r) => r.roster_attended === true).length;
  const absent = roster.filter((r) => r.roster_attended === false).length;
  const unrecorded = roster.length - present - absent;

  if (roster.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-black/15 px-4 py-8 text-center text-sm text-gray-500 dark:border-white/15 dark:text-gray-400">
        まだ参加登録している人がいません。
      </p>
    );
  }

  return (
    <div>
      <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">
        参加登録 {roster.length}人 ／ 出席 {present}・欠席 {absent}
        {unrecorded > 0 && `・未記録 ${unrecorded}`}
      </p>

      <ul className="divide-y divide-black/5 rounded-xl border border-black/10 bg-white dark:divide-white/5 dark:border-white/10 dark:bg-white/5">
        {roster.map((r) => (
          <li
            key={r.roster_user_id}
            className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5"
          >
            <span className="min-w-0 truncate text-sm font-medium">
              {r.roster_name}
            </span>

            <div className="flex shrink-0 gap-1.5">
              {(
                [
                  { value: true, label: "出席" },
                  { value: false, label: "欠席" },
                ] as const
              ).map(({ value, label }) => {
                const active = r.roster_attended === value;
                return (
                  <form key={label} action={recordAttendance}>
                    <input type="hidden" name="event_id" value={eventId} />
                    <input type="hidden" name="user_id" value={r.roster_user_id} />
                    {/* 選択中をもう一度押したら未記録に戻す */}
                    <input
                      type="hidden"
                      name="attended"
                      value={active ? "" : String(value)}
                    />
                    <button
                      type="submit"
                      className={`rounded-lg border px-3 py-1 text-xs font-medium transition ${
                        active
                          ? value
                            ? "border-emerald-500 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-200"
                            : "border-gray-400 bg-gray-100 text-gray-700 dark:border-gray-600 dark:bg-white/10 dark:text-gray-300"
                          : "border-black/15 text-gray-600 hover:bg-black/5 dark:border-white/15 dark:text-gray-400 dark:hover:bg-white/10"
                      }`}
                    >
                      {label}
                    </button>
                  </form>
                );
              })}
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
        選択中のボタンをもう一度押すと未記録に戻せます。
      </p>
    </div>
  );
}
