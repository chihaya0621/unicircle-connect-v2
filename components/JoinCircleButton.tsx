import { requestJoin } from "@/app/actions/circles";
import type { CircleRole, MembershipStatus, UserRole } from "@/lib/database.types";

/**
 * 閲覧者の状態に応じて参加導線を出し分ける。
 *
 * サークル画面は学生・職員のみ到達できる（一般ユーザーは要件定義書3章より
 * 公開イベントの閲覧のみ）。よって viewerRole が null になることはない。
 * 職員は閲覧できるが参加はできないため、ボタンではなく理由を表示する。
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
