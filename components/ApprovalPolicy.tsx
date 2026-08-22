"use client";

import { useActionState } from "react";

import {
  setRequiredApprovals,
  type ActionState,
} from "@/app/actions/circles";
import { FormMessage } from "@/components/Field";
import { SubmitButton } from "@/components/SubmitButton";

/**
 * サークルの設立・廃止に必要な承認者数。
 *
 * 紙の決裁で複数の印鑑が要るのと同じ扱いにするための設定。
 * 設立と廃止だけが対象で、施設の予約は日々の運用なので1人のまま。
 * だからこの設定はサークル一覧に置いてある。
 *
 * 職員の人数を超える値は DB 側で弾かれる。超えると誰も承認を
 * 完了できない状態になるため。
 */
export function ApprovalPolicy({
  current,
  staffCount,
}: {
  current: number;
  /** 同じ大学に登録されている職員の数 */
  staffCount: number;
}) {
  const [state, action] = useActionState<ActionState, FormData>(
    setRequiredApprovals,
    null,
  );

  return (
    <form action={action} className="space-y-3">
      {state?.error && <FormMessage tone="error">{state.error}</FormMessage>}
      {state?.notice && <FormMessage tone="notice">{state.notice}</FormMessage>}

      <div className="flex flex-wrap items-end gap-3">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">必要な承認者数</span>
          <select name="count" defaultValue={current} className="field-input">
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n} disabled={n > staffCount}>
                {n}人{n > staffCount && "（職員が足りません）"}
              </option>
            ))}
          </select>
        </label>
        <SubmitButton pendingLabel="保存中…">保存</SubmitButton>
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400">
        いまこの大学に登録されている職員は{staffCount}人です。
        承認は人数が揃って初めて成立し、却下は1人で成立します。
      </p>
    </form>
  );
}
