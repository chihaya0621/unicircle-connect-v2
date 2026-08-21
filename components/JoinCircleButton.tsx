import { requestJoin } from "@/app/actions/circles";
import type { CircleRole, MembershipStatus, UserRole } from "@/lib/database.types";

/**
 * 閲覧者の状態に応じて参加導線を出し分ける。
 *
 * 参加できるのは学生だけ。職員と一般ユーザーは閲覧のみなので、
 * 押せないボタンを出すより、参加できない理由を書く。
 */
export function JoinCircleButton({
  circleId,
  viewerRole,
  membership,
}: {
  circleId: string;
  viewerRole: UserRole;
  membership: { role: CircleRole; status: MembershipStatus } | null;
}) {
  if (viewerRole !== "student") {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">
        サークルに参加できるのは学生アカウントのみです。
        {viewerRole === "staff" && "（職員は閲覧と承認のみ行えます）"}
        {viewerRole === "general" &&
          "在学生の方は、大学のメールアドレスで学生登録をすると参加できます。"}
      </p>
    );
  }

  if (membership?.status === "active") {
    return (
      <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
        参加中のサークルです
        {membership.role === "admin" && "（管理者）"}
      </p>
    );
  }

  if (membership?.status === "pending") {
    return (
      <p className="text-sm text-amber-700 dark:text-amber-300">
        参加申請中です。管理者の承認をお待ちください。
      </p>
    );
  }

  return (
    <form action={requestJoin}>
      <input type="hidden" name="circle_id" value={circleId} />
      <button
        type="submit"
        className="btn-primary"
      >
        {membership?.status === "rejected" ? "再度申請する" : "参加を申請する"}
      </button>
    </form>
  );
}
