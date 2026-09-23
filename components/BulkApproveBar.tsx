"use client";

import { useActionState, useId } from "react";

import {
  approveReservations,
  type ActionState,
} from "@/app/actions/facilities";
import { FormMessage } from "@/components/Field";
import { SubmitButton } from "@/components/SubmitButton";

/** 一覧の各行のチェックボックスが、このフォームに属するための ID */
export const BULK_FORM_ID = "bulk-approve-reservations";

/**
 * 承認待ちの予約をまとめて承認する帯。
 *
 * 1件ずつ押すしかないと、新学期のように30件溜まった日に手が止まる。
 * チェックボックスは各行に置き、form 属性でこのフォームに結びつける
 * （行ごとの承認・却下フォームと入れ子にできないため）。
 */
export function BulkApproveBar({ count }: { count: number }) {
  const [state, action] = useActionState<ActionState, FormData>(
    approveReservations,
    null,
  );
  const allId = useId();

  const toggleAll = (checked: boolean) => {
    document
      .querySelectorAll<HTMLInputElement>(
        `input[type=checkbox][form="${BULK_FORM_ID}"]`,
      )
      .forEach((el) => {
        el.checked = checked;
      });
  };

  return (
    <div className="mb-4 space-y-2">
      {state?.error && <FormMessage tone="error">{state.error}</FormMessage>}
      {state?.notice && <FormMessage tone="notice">{state.notice}</FormMessage>}

      <form
        id={BULK_FORM_ID}
        action={action}
        className="glass-panel flex flex-wrap items-center justify-between gap-3 p-3"
      >
        <label
          htmlFor={allId}
          className="flex min-h-11 items-center gap-2.5 text-sm"
        >
          <input
            id={allId}
            type="checkbox"
            className="field-check size-5"
            onChange={(e) => toggleAll(e.target.checked)}
          />
          すべて選ぶ（{count}件）
        </label>
        <SubmitButton pendingLabel="承認しています…">
          選んだ予約を承認する
        </SubmitButton>
      </form>
    </div>
  );
}
