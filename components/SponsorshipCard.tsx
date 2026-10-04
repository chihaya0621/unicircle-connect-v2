import Link from "next/link";

import { Seal } from "@/components/Seal";
import {
  formatDeadline,
  formatYen,
  isAccepting,
  type Sponsorship,
} from "@/lib/sponsorship-shared";

const STATUS: Record<
  "pending" | "open" | "ended" | "rejected" | "closed",
  { label: string; className: string }
> = {
  pending: {
    label: "大学の確認待ち",
    className: "bg-amber-500/15 text-amber-800 dark:text-amber-300",
  },
  open: {
    label: "募集中",
    className: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300",
  },
  ended: {
    label: "受付終了",
    className: "bg-gray-500/15 text-gray-700 dark:text-gray-300",
  },
  rejected: {
    label: "大学が見送り",
    className: "bg-rose-500/15 text-rose-800 dark:text-rose-300",
  },
  closed: {
    label: "締め切り",
    className: "bg-gray-500/15 text-gray-700 dark:text-gray-300",
  },
};

/** 状態の札。募集中でも締め切り日を過ぎていれば「受付終了」 */
export function SponsorshipStatusBadge({
  sponsorship,
}: {
  sponsorship: Pick<Sponsorship, "status" | "deadline">;
}) {
  const key =
    sponsorship.status === "open" && !isAccepting(sponsorship)
      ? "ended"
      : sponsorship.status;
  const s = STATUS[key];
  return (
    <span className={`badge shrink-0 px-2.5 py-0.5 text-xs ${s.className}`}>
      {s.label}
    </span>
  );
}

/**
 * 協賛の募集の札。
 *
 * 企業が判断に使う4つ（何に使うか・いくら・お返し・いつまで）を必ず出す。
 * 大学の職員が確かめた募集には、押した判子を添える。大学の名前で
 * 外に出る募集であることが、企業にとっての安心材料になる。
 *
 * href を渡すと、札全体が詳細へのリンクになる（CircleCard と同じく、
 * 見出しのリンクを疑似要素で広げる）。
 */
export function SponsorshipCard({
  sponsorship: s,
  href,
  showCircle = false,
  compact = false,
  children,
}: {
  sponsorship: Sponsorship;
  href?: string;
  /** どのサークルの募集かを出す（サークルの外の一覧で使う） */
  showCircle?: boolean;
  /** 使い道を3行で切る */
  compact?: boolean;
  /** 札の下に置く操作 */
  children?: React.ReactNode;
}) {
  const university = s.circle?.university?.name;

  return (
    <article className="glass-card relative p-5 has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-indigo-500 dark:has-[a:focus-visible]:outline-indigo-400">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {showCircle && s.circle && (
            <p className="mb-1 text-sm text-gray-600 dark:text-gray-400">
              {s.circle.name}
              {university && ` ／ ${university}`}
            </p>
          )}
          <h3 className="font-semibold leading-snug">
            {href ? (
              <Link
                href={href}
                className="after:absolute after:inset-0 after:content-[''] hover:underline focus-visible:outline-none focus-visible:underline"
              >
                {s.title}
              </Link>
            ) : (
              s.title
            )}
          </h3>
        </div>
        <SponsorshipStatusBadge sponsorship={s} />
      </div>

      <p
        className={`mt-2 whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300 ${
          compact ? "line-clamp-3" : ""
        }`}
      >
        {s.purpose}
      </p>

      <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-[auto_1fr]">
        <dt className="text-gray-600 dark:text-gray-400">目標</dt>
        <dd className="font-medium">
          {s.amount_goal ? formatYen(s.amount_goal) : "決めていません"}
        </dd>
        <dt className="text-gray-600 dark:text-gray-400">締め切り</dt>
        <dd className="font-medium">{formatDeadline(s.deadline)}</dd>
        {s.returns && (
          <>
            <dt className="text-gray-600 dark:text-gray-400">お返し</dt>
            <dd className={compact ? "line-clamp-2" : "whitespace-pre-wrap"}>
              {s.returns}
            </dd>
          </>
        )}
      </dl>

      {s.checked_seal_text && s.status !== "rejected" && (
        <p className="mt-3 flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
          <Seal text={s.checked_seal_text} shape={s.checked_seal_shape} size={28} />
          <span>
            {university ? `${university}の職員` : "大学の職員"}
            が中身を確かめて、判子を押した募集です。
          </span>
        </p>
      )}

      {children && <div className="relative mt-4">{children}</div>}
    </article>
  );
}
