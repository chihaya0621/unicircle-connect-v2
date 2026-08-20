import { cancelReservation, decideReservation } from "@/app/actions/facilities";
import type { Reservation } from "@/lib/facilities";
import { reservationBooker } from "@/lib/facilities";

const dateTimeFormatter = new Intl.DateTimeFormat("ja-JP", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Tokyo",
});

const timeFormatter = new Intl.DateTimeFormat("ja-JP", {
  timeStyle: "short",
  timeZone: "Asia/Tokyo",
});

const STATUS_STYLE = {
  pending: {
    label: "承認待ち",
    className: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  },
  approved: {
    label: "承認済み",
    className:
      "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  },
  rejected: {
    label: "取り消し",
    className: "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-400",
  },
} as const;

export function ReservationList({
  reservations,
  showFacility = false,
  canDecide = false,
  canCancel = false,
  emptyLabel = "予約はありません。",
}: {
  reservations: Reservation[];
  /** 施設詳細では施設名が自明なので出さない */
  showFacility?: boolean;
  canDecide?: boolean;
  canCancel?: boolean;
  emptyLabel?: string;
}) {
  if (reservations.length === 0) {
    return (
      <p className="glass-empty">
        {emptyLabel}
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {reservations.map((r) => {
        const booker = reservationBooker(r);
        const status = STATUS_STYLE[r.status];

        return (
          <li
            key={r.id}
            className="flex flex-wrap items-start justify-between gap-3 glass-panel p-4"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium">
                {dateTimeFormatter.format(new Date(r.start_time))}
                {" 〜 "}
                {timeFormatter.format(new Date(r.end_time))}
              </p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {showFacility && r.facility?.name && `${r.facility.name} ／ `}
                {booker.kind === "circle" ? "サークル" : "個人"}：{booker.name}
                {r.purpose && ` ／ ${r.purpose}`}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${status.className}`}
              >
                {status.label}
              </span>

              {canDecide && r.status === "pending" && (
                <>
                  <form action={decideReservation}>
                    <input type="hidden" name="reservation_id" value={r.id} />
                    <input type="hidden" name="approve" value="true" />
                    <button
                      type="submit"
                      className="btn-primary px-3 py-1.5 text-xs"
                    >
                      承認
                    </button>
                  </form>
                  <form action={decideReservation}>
                    <input type="hidden" name="reservation_id" value={r.id} />
                    <input type="hidden" name="approve" value="false" />
                    <button
                      type="submit"
                      className="btn-ghost-sm"
                    >
                      却下
                    </button>
                  </form>
                </>
              )}

              {canCancel && r.status !== "rejected" && (
                <form action={cancelReservation}>
                  <input type="hidden" name="reservation_id" value={r.id} />
                  <button
                    type="submit"
                    className="btn-ghost-sm"
                  >
                    取り消す
                  </button>
                </form>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
