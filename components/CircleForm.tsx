"use client";

import { useActionState } from "react";

import { createCircle, type ActionState } from "@/app/actions/circles";
import { Field, FormMessage, Input } from "@/components/Field";
import { SubmitButton } from "@/components/SubmitButton";

export function CircleForm() {
  const [state, action] = useActionState<ActionState, FormData>(
    createCircle,
    null,
  );

  return (
    <form action={action} className="space-y-4">
      {state?.error && <FormMessage tone="error">{state.error}</FormMessage>}

      <Field label="サークル名">
        <Input name="name" required maxLength={60} placeholder="例: テニス同好会" />
      </Field>

      <Field label="活動内容" hint="どんな活動をするか、活動頻度などを書きましょう">
        <textarea
          name="description"
          rows={5}
          maxLength={1000}
          placeholder="週2回、大学のコートで活動しています。初心者歓迎です。"
          className="w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:border-white/15 dark:bg-white/5 dark:text-gray-100 dark:focus:ring-indigo-900"
        />
      </Field>

      <p className="text-xs text-gray-500 dark:text-gray-400">
        申請後、大学職員が承認するまでは一覧に表示されません。
        設立者は自動的にサークル管理者になります。
      </p>

      <SubmitButton pendingLabel="申請中…">設立を申請する</SubmitButton>
    </form>
  );
}
