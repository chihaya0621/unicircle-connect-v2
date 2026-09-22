"use client";

import { useActionState } from "react";

import {
  cancelHandover,
  requestHandover,
  respondHandover,
  type ActionState,
} from "@/app/actions/handover";
import { FormMessage } from "@/components/Field";
import { SubmitButton } from "@/components/SubmitButton";
import type { Handover } from "@/lib/handover";

const stamp = new Intl.DateTimeFormat("ja-JP", {
  dateStyle: "medium",
  timeZone: "Asia/Tokyo",
});

export type HandoverCandidate = { id: string; name: string };

/**
 * 代替わり。
 *
 * 役職を変えるだけなら管理者が一方的にできるが、代表は押し付けられると
 * 困るので、相手が受けて初めて成立する。承認と同じ考え方。
 *
 * 画面は立場ごとに1つだけ出す。申し出る側と受ける側で必要な操作が
 * 違うのに、両方並べると誰が何をすればいいか読めなくなる。
 */
export function HandoverPanel({
  circleId,
  pending,
  candidates,
  isAdmin,
  viewerId,
  termYear,
}: {
  circleId: string;
  /** 処理中の申し出。同時に1件まで */
  pending: Handover | null;
  /** 引き継ぎ先に選べる人。在籍しているメンバーから自分を除いたもの */
  candidates: HandoverCandidate[];
  isAdmin: boolean;
  viewerId: string;
  /** いまの代が引き継いだ年度。null は設立の代のまま */
  termYear: number | null;
}) {
  const [reqState, reqAction] = useActionState<ActionState, FormData>(
    requestHandover,
    null,
  );
  const [resState, resAction] = useActionState<ActionState, FormData>(
    respondHandover,
    null,
  );
  const [canState, canAction] = useActionState<ActionState, FormData>(
    cancelHandover,
    null,
  );

  // ── 指名された人への画面 ──────────────────────────────
  if (pending && pending.to_user_id === viewerId) {
    return (
      <section className="mb-10 rounded-2xl border border-indigo-300/70 bg-indigo-50/60 p-5 dark:border-indigo-800/60 dark:bg-indigo-950/30">
        <h2 className="mb-1 text-lg font-semibold">代表を引き継いでほしいと頼まれています</h2>
        <p className="mb-4 text-sm text-gray-700 dark:text-gray-300">
          {pending.from_name} さんからの申し出です（
          {stamp.format(new Date(pending.created_at))}）。
          受けると、あなたがこのサークルの管理者になります。断っても構いません。
        </p>

        {pending.note && (
          <blockquote className="mb-4 whitespace-pre-wrap rounded-xl bg-white/70 p-3.5 text-sm dark:bg-white/5">
            {pending.note}
          </blockquote>
        )}

        {resState?.error && <FormMessage tone="error">{resState.error}</FormMessage>}

        <form action={resAction} className="mt-3 flex flex-wrap gap-2">
          <input type="hidden" name="handover_id" value={pending.id} />
          <input type="hidden" name="circle_id" value={circleId} />
          <button type="submit" name="accept" value="true" className="btn-primary px-5">
            引き継ぐ
          </button>
          <button type="submit" name="accept" value="false" className="btn-ghost px-5">
            受けない
          </button>
        </form>
      </section>
    );
  }

  // ── 申し出た側への画面 ────────────────────────────────
  if (pending && pending.from_user_id === viewerId) {
    return (
      <section className="mb-10 glass-panel">
        <h2 className="mb-1 text-lg font-semibold">引き継ぎを申し出ています</h2>
        <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
          {pending.to_name} さんの返事を待っています（
          {stamp.format(new Date(pending.created_at))}）。
          受けてもらえるまで、代表はあなたのままです。
        </p>
        {canState?.error && <FormMessage tone="error">{canState.error}</FormMessage>}
        <form action={canAction}>
          <input type="hidden" name="handover_id" value={pending.id} />
          <input type="hidden" name="circle_id" value={circleId} />
          <button type="submit" className="btn-ghost px-5">
            申し出を取り下げる
          </button>
        </form>
      </section>
    );
  }

  // ── ほかの人から見た、処理中の申し出 ──────────────────
  if (pending) {
    return (
      <section className="mb-10 glass-panel">
        <h2 className="mb-1 text-lg font-semibold">代替わりの手続き中です</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {pending.from_name} さんから {pending.to_name} さんへ。
          受けるかどうかの返事を待っています。
        </p>
      </section>
    );
  }

  if (!isAdmin) return null;

  // ── 管理者への画面。申し出を出す ──────────────────────
  return (
    <section className="mb-10 glass-panel">
      <h2 className="mb-1 text-lg font-semibold">代表を引き継ぐ</h2>
      <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
        {termYear
          ? `いまの代は ${termYear} 年度に引き継がれました。`
          : "まだ一度も代替わりしていません。"}
        {" "}
        相手が受けると管理者が移り、あなたは一般のメンバーになります。在籍は続きます。
      </p>

      {candidates.length === 0 ? (
        <p className="glass-empty py-6 text-sm">
          引き継げる相手がいません。先にメンバーの参加を承認してください。
        </p>
      ) : (
        <form action={reqAction} className="space-y-3">
          {reqState?.error && <FormMessage tone="error">{reqState.error}</FormMessage>}
          {reqState?.notice && (
            <FormMessage tone="notice">{reqState.notice}</FormMessage>
          )}
          <input type="hidden" name="circle_id" value={circleId} />

          <label className="block space-y-1.5">
            <span className="text-sm font-medium">次の代表</span>
            <select name="to_user" className="field-input w-full sm:w-72" required>
              <option value="">選んでください</option>
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium">申し送り（任意）</span>
            <textarea
              name="note"
              rows={4}
              maxLength={1000}
              placeholder="鍵の場所、顧問の連絡先、引き継ぎ中の案件など。次の代が最初に読む場所です。"
              className="field-input w-full"
            />
          </label>

          <SubmitButton pendingLabel="申し出ています…">引き継ぎを申し出る</SubmitButton>
        </form>
      )}
    </section>
  );
}
