"use client";

import { useActionState } from "react";

import {
  closeSponsorship,
  requestSponsorship,
  respondSponsorshipOffer,
  type ActionState,
} from "@/app/actions/sponsorship";
import { FormMessage } from "@/components/Field";
import { SponsorshipStatusBadge } from "@/components/SponsorshipCard";
import { SubmitButton } from "@/components/SubmitButton";
import type { Sponsorship, SponsorshipOffer } from "@/lib/sponsorship-shared";

const yen = new Intl.NumberFormat("ja-JP");
const stamp = new Intl.DateTimeFormat("ja-JP", {
  dateStyle: "medium",
  timeZone: "Asia/Tokyo",
});

/**
 * サークルの管理者が、協賛を募集し、届いた申し込みに答える場所。
 *
 * 返事を待たせている申し込みがあれば、それを先頭に出す。企業は返事を
 * 待っているので、毎日見る場所の先頭に置く。募集を出す入力欄は、
 * たまにしか使わないので畳んでおく。
 */
export function SponsorshipManager({
  circleId,
  requests,
  offers,
  today,
  canRequest = true,
}: {
  circleId: string;
  /** このサークルの募集。確認待ち・見送りも含む */
  requests: Sponsorship[];
  /** 募集への申し込み（管理者にだけ返る） */
  offers: SponsorshipOffer[];
  /** 日本時間の今日（YYYY-MM-DD）。締め切り日の入力の下限に使う */
  today: string;
  /** 新しく募集を出せるか。廃止を申請中のサークルは出せない */
  canRequest?: boolean;
}) {
  const [reqState, reqAction] = useActionState<ActionState, FormData>(
    requestSponsorship,
    null,
  );
  const [resState, resAction] = useActionState<ActionState, FormData>(
    respondSponsorshipOffer,
    null,
  );
  const [closeState, closeAction] = useActionState<ActionState, FormData>(
    closeSponsorship,
    null,
  );

  const titleOf = new Map(requests.map((r) => [r.id, r.title]));
  const waiting = offers.filter((o) => o.status === "pending");

  return (
    <div className="space-y-6">
      {/* 最後の1件に返事をすると下の枠ごと消えるので、結果は枠の外に出す */}
      {resState?.error && <FormMessage tone="error">{resState.error}</FormMessage>}
      {resState?.notice && <FormMessage tone="notice">{resState.notice}</FormMessage>}
      {waiting.length > 0 && (
        <div className="rounded-2xl border border-indigo-300/70 bg-indigo-50/60 p-4 dark:border-indigo-800/60 dark:bg-indigo-950/30">
          <h3 className="mb-1 font-semibold">
            返事を待っている申し込み（{waiting.length}件）
          </h3>
          <p className="mb-3 text-sm text-gray-700 dark:text-gray-300">
            受けると協賛が成立し、このページに企業の名前が出ます。
            お金のやり取りは、企業と直接決めてください。
          </p>
          <ul className="mt-2 space-y-3">
            {waiting.map((o) => (
              <li
                key={o.id}
                className="rounded-xl bg-white/70 p-3.5 dark:bg-white/5"
              >
                <p className="text-sm">
                  <span className="font-semibold">
                    {o.sponsor_url ? (
                      <a
                        href={o.sponsor_url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="underline"
                      >
                        {o.sponsor_name}
                      </a>
                    ) : (
                      o.sponsor_name
                    )}
                  </span>
                  から「{titleOf.get(o.request_id) ?? "募集"}」へ
                  <span className="ml-1 font-semibold">
                    {yen.format(o.amount)}円
                  </span>
                </p>
                {o.message && (
                  <p className="mt-1.5 whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
                    {o.message}
                  </p>
                )}
                <form action={resAction} className="mt-3 flex flex-wrap gap-2">
                  <input type="hidden" name="offer_id" value={o.id} />
                  <input type="hidden" name="circle_id" value={circleId} />
                  <input type="hidden" name="request_id" value={o.request_id} />
                  <button
                    type="submit"
                    name="accept"
                    value="true"
                    className="btn-primary tap-target px-4 py-1.5 text-sm"
                  >
                    協賛を受ける
                  </button>
                  <button
                    type="submit"
                    name="accept"
                    value="false"
                    className="btn-ghost-sm"
                  >
                    見送る
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </div>
      )}

      {requests.length > 0 && (
        <div>
          <h3 className="mb-2 font-semibold">出した募集</h3>
          {closeState?.error && (
            <FormMessage tone="error">{closeState.error}</FormMessage>
          )}
          {closeState?.notice && (
            <FormMessage tone="notice">{closeState.notice}</FormMessage>
          )}
          <ul className="divide-y divide-black/5 dark:divide-white/10">
            {requests.map((r) => {
              const accepted = offers.filter(
                (o) => o.request_id === r.id && o.status === "accepted",
              );
              const total = accepted.reduce((sum, o) => sum + o.amount, 0);
              return (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{r.title}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {stamp.format(new Date(r.created_at))}に出した募集
                      {accepted.length > 0 &&
                        ` ・ 成立 ${accepted.length}件 ${yen.format(total)}円` +
                          (r.amount_goal
                            ? `（目標 ${yen.format(r.amount_goal)}円）`
                            : "")}
                    </p>
                  </div>
                  <SponsorshipStatusBadge sponsorship={r} />
                  {r.status === "open" && (
                    <form action={closeAction}>
                      <input type="hidden" name="request_id" value={r.id} />
                      <input type="hidden" name="circle_id" value={circleId} />
                      <button type="submit" className="btn-ghost-sm">
                        締め切る
                      </button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {canRequest && (
        <details className="group">
          <summary className="cursor-pointer list-none text-sm font-semibold [&::-webkit-details-marker]:hidden">
            <span className="inline-flex min-h-11 items-center gap-2">
              <span
                aria-hidden
                className="inline-block transition-transform group-open:rotate-90"
              >
                ▸
              </span>
              協賛を募集する
            </span>
          </summary>
          <form action={reqAction} className="mt-3 space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              企業に、活動の費用を支えてもらう募集です。出すと、まず大学の職員が中身を
              確かめます。判子が押されると、企業から見えるようになります。
            </p>
            {reqState?.error && (
              <FormMessage tone="error">{reqState.error}</FormMessage>
            )}
            {reqState?.notice && (
              <FormMessage tone="notice">{reqState.notice}</FormMessage>
            )}
            <input type="hidden" name="circle_id" value={circleId} />

            <label className="block space-y-1.5">
              <span className="text-sm font-medium">題名</span>
              <input
                name="title"
                required
                maxLength={60}
                placeholder="例: 全国大会の遠征費"
                className="field-input w-full"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-sm font-medium">何に使うか</span>
              <span className="block text-xs text-gray-600 dark:text-gray-400">
                企業がいちばん知りたいところです。いつ、何に、どれくらい要るかを書きます。
              </span>
              <textarea
                name="purpose"
                required
                rows={4}
                maxLength={1000}
                placeholder="例: 8月の全国大会に出る部員8人の交通費と宿泊費に使います。"
                className="field-input w-full"
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-1.5">
                <span className="text-sm font-medium">目標額（円・任意）</span>
                <input
                  name="amount_goal"
                  inputMode="numeric"
                  placeholder="例: 100000"
                  className="field-input w-full"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-medium">締め切り</span>
                <input
                  type="date"
                  name="deadline"
                  required
                  min={today}
                  className="field-input w-full"
                />
              </label>
            </div>

            <label className="block space-y-1.5">
              <span className="text-sm font-medium">
                協賛へのお返し（任意）
              </span>
              <textarea
                name="returns"
                rows={2}
                maxLength={500}
                placeholder="例: 大会のユニフォームと配布物に、協賛企業のロゴを載せます。"
                className="field-input w-full"
              />
            </label>

            <SubmitButton pendingLabel="出しています…">募集を出す</SubmitButton>
          </form>
        </details>
      )}
    </div>
  );
}
