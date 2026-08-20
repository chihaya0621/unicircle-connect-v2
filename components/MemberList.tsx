import { decideMember } from "@/app/actions/circles";
import type { CircleMember } from "@/lib/circles";

const dateFormatter = new Intl.DateTimeFormat("ja-JP", {
  dateStyle: "medium",
  timeZone: "Asia/Tokyo",
});

function MemberRow({
  member,
  circleId,
  canManage,
}: {
  member: CircleMember;
  circleId: string;
  canManage: boolean;
}) {
  return (
    <li className="flex items-center justify-between gap-3 border-b border-black/5 py-3 last:border-0 dark:border-white/5">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">
          {member.user?.name ?? "退会したユーザー"}
          {member.role === "admin" && (
            <span className="ml-2 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-normal text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
              管理者
            </span>
          )}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {dateFormatter.format(new Date(member.created_at))}
          {member.status === "pending" && " ／ 承認待ち"}
          {member.status === "rejected" && " ／ 却下済み"}
        </p>
      </div>

      {canManage && member.status === "pending" && (
        <div className="flex shrink-0 gap-2">
          <form action={decideMember}>
            <input type="hidden" name="circle_id" value={circleId} />
            <input type="hidden" name="user_id" value={member.user_id} />
            <input type="hidden" name="approve" value="true" />
            <button
              type="submit"
              className="btn-primary px-3 py-1.5 text-xs"
            >
              承認
            </button>
          </form>
          <form action={decideMember}>
            <input type="hidden" name="circle_id" value={circleId} />
            <input type="hidden" name="user_id" value={member.user_id} />
            <input type="hidden" name="approve" value="false" />
            <button
              type="submit"
              className="btn-ghost-sm"
            >
              却下
            </button>
          </form>
        </div>
      )}
    </li>
  );
}

export function MemberList({
  members,
  circleId,
  canManage,
}: {
  members: CircleMember[];
  circleId: string;
  canManage: boolean;
}) {
  const active = members.filter((m) => m.status === "active");
  // 承認待ちの申請者は管理者にだけ見せる
  const pending = canManage
    ? members.filter((m) => m.status === "pending")
    : [];

  return (
    <div className="space-y-6">
      {pending.length > 0 && (
        <section>
          <h2 className="mb-1 text-sm font-semibold text-amber-700 dark:text-amber-300">
            参加申請 {pending.length}件
          </h2>
          <ul>
            {pending.map((m) => (
              <MemberRow
                key={m.user_id}
                member={m}
                circleId={circleId}
                canManage
              />
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-1 text-sm font-semibold">
          メンバー {active.length}人
        </h2>
        {active.length === 0 ? (
          <p className="py-3 text-sm text-gray-500 dark:text-gray-400">
            まだメンバーがいません。
          </p>
        ) : (
          <ul>
            {active.map((m) => (
              <MemberRow
                key={m.user_id}
                member={m}
                circleId={circleId}
                canManage={false}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
