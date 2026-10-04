"use client";

import { useActionState } from "react";

import {
  offerSponsorship,
  withdrawSponsorshipOffer,
  type ActionState,
} from "@/app/actions/sponsorship";
import { FormMessage } from "@/components/Field";
import { SubmitButton } from "@/components/SubmitButton";
import type { SponsorshipOffer } from "@/lib/sponsorship-shared";

const yen = new Intl.NumberFormat("ja-JP");

const STATUS_TEXT: Record<SponsorshipOffer["status"], string> = {
  pending: "サークルの返事を待っています。",
  accepted: "協賛が成立しました。サークルのページに名前が出ています。",
  declined: "サークルが見送りました。",
  withdrawn: "取り下げました。",
};

/**
 * 企業が協賛を申し込む欄。
 *
 * 前に申し込んだものがあれば、その結果を先に見せる。返事待ちのあいだは
 * 同じ募集に重ねて申し込めない（DB でも断る）ので、入力欄の代わりに
 * 取り下げのボタンを出す。
 */
export function SponsorshipOfferForm({
  requestId,
  circleId,
  myOffers,
  defaultName,
  accepting = true,
}: {
  requestId: string;
  circleId: string;
  /** この募集への、自分の申し込み。新しい順 */
  myOffers: SponsorshipOffer[];
  /** 前に使った会社名。毎回打たなくて済むように */
  defaultName?: string;
  /** 受け付け中か。締め切ったあとは、これまでの申し込みだけを見せる */
  accepting?: boolean;
}) {
  const [offerState, offerAction] = useActionState<ActionState, FormData>(
    offerSponsorship,
    null,
  );
  const [withdrawState, withdrawAction] = useActionState<ActionState, FormData>(
    withdrawSponsorshipOffer,
    null,
  );

  const waiting = myOffers.find((o) => o.status === "pending");

  return (
    <div className="space-y-4">
      {myOffers.length > 0 && (
        <ul className="space-y-2">
          {myOffers.map((o) => (
            <li
              key={o.id}
              className="rounded-xl border border-black/10 p-3.5 text-sm dark:border-white/15"
            >
              <p>
                <span className="font-semibold">{o.sponsor_name}</span>として
                <span className="mx-1 font-semibold">{yen.format(o.amount)}円</span>
                を申し込みました。{STATUS_TEXT[o.status]}
              </p>
            </li>
          ))}
        </ul>
      )}

      {/* 申し込むと取り下げの欄に、取り下げると申し込みの欄に入れ替わるので、
          結果の知らせは入れ替わった先の欄に出す */}
      {waiting ? (
        <form action={withdrawAction} className="space-y-4">
          {offerState?.notice && <FormMessage tone="notice">{offerState.notice}</FormMessage>}
          {withdrawState?.error && <FormMessage tone="error">{withdrawState.error}</FormMessage>}
          <input type="hidden" name="offer_id" value={waiting.id} />
          <input type="hidden" name="circle_id" value={circleId} />
          <input type="hidden" name="request_id" value={requestId} />
          <button type="submit" className="btn-ghost px-5">
            申し込みを取り下げる
          </button>
        </form>
      ) : accepting ? (
        <form action={offerAction} className="space-y-4">
          {withdrawState?.notice && <FormMessage tone="notice">{withdrawState.notice}</FormMessage>}
          {offerState?.error && <FormMessage tone="error">{offerState.error}</FormMessage>}
          <input type="hidden" name="request_id" value={requestId} />
          <input type="hidden" name="circle_id" value={circleId} />

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">会社名・団体名</span>
              <span className="block text-xs text-gray-600 dark:text-gray-400">
                成立すると、サークルのページにこの名前が出ます。
              </span>
              <input
                name="sponsor_name"
                required
                maxLength={60}
                defaultValue={defaultName}
                className="field-input w-full"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Web サイト（任意）</span>
              <span className="block text-xs text-gray-600 dark:text-gray-400">
                協賛企業の名前から、ここへつなぎます。
              </span>
              <input
                name="sponsor_url"
                type="url"
                placeholder="https://"
                className="field-input w-full"
              />
            </label>
          </div>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium">金額（円）</span>
            <input
              name="amount"
              required
              inputMode="numeric"
              placeholder="例: 30000"
              className="field-input w-full sm:w-56"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium">サークルへのメッセージ（任意）</span>
            <textarea
              name="message"
              rows={3}
              maxLength={1000}
              placeholder="協賛の理由や、お返しについての希望など"
              className="field-input w-full"
            />
          </label>

          <SubmitButton pendingLabel="申し込んでいます…">協賛を申し込む</SubmitButton>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            お金のやり取りは、成立したあとにサークルと直接決めてください。
            デモでは、実際のお金は動きません。
          </p>
        </form>
      ) : null}
    </div>
  );
}
