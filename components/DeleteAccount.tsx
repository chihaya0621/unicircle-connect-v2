"use client";

import { useActionState, useState } from "react";

import { deleteAccount, type ActionState } from "@/app/actions/account";
import { FormMessage } from "@/components/Field";
import { SubmitButton } from "@/components/SubmitButton";

/**
 * アカウントの削除。一般アカウントにだけ出す。
 *
 * 押し間違いで消えないよう、開いてから「削除」と入力させる。
 * 取り消せない操作なので、確認は文章ではなく手を動かす形にしている。
 */
export function DeleteAccount() {
  const [state, action] = useActionState<ActionState, FormData>(
    deleteAccount,
    null,
  );
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-danger-sm"
      >
        アカウントを削除する
      </button>
    );
  }

  return (
    <form action={action} className="space-y-3">
      {state?.error && <FormMessage tone="error">{state.error}</FormMessage>}

      <p className="text-sm text-gray-700 dark:text-gray-300">
        気になる大学・気になるサークル・通知もまとめて消えます。元には戻せません。
        続ける場合は
        <span className="mx-1 font-semibold">削除</span>
        と入力してください。
      </p>

      <input
        name="confirm"
        required
        autoComplete="off"
        placeholder="削除"
        className="field-input"
      />

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingLabel="削除中…">削除する</SubmitButton>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="btn-ghost-sm"
        >
          やめる
        </button>
      </div>
    </form>
  );
}
