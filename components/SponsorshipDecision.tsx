"use client";

import { decideSponsorship } from "@/app/actions/sponsorship";
import { DecisionForm } from "@/components/DecisionForm";

/**
 * 職員が、協賛の募集を確かめるボタン。
 *
 * 承認すると判子が押され、企業から見えるようになる。設立と違って1人の
 * 判子で決まるので、押した時点で公開されることを、ボタンの名前で伝える。
 */
export function SponsorshipDecision({
  requestId,
  circleId,
}: {
  requestId: string;
  circleId: string;
}) {
  return (
    <DecisionForm
      action={decideSponsorship}
      className="flex flex-wrap items-center gap-2"
    >
      <input type="hidden" name="request_id" value={requestId} />
      <input type="hidden" name="circle_id" value={circleId} />
      <input
        name="comment"
        maxLength={200}
        placeholder="所見（任意）"
        aria-label="所見（任意）"
        className="field-input w-full sm:w-56"
      />
      <button
        type="submit"
        name="approve"
        value="true"
        className="btn-primary tap-target px-3 py-1.5 text-xs"
      >
        承認して公開する
      </button>
      <button type="submit" name="approve" value="false" className="btn-ghost-sm">
        見送る
      </button>
    </DecisionForm>
  );
}
