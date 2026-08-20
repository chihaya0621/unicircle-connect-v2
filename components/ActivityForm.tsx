"use client";

import { useActionState, useRef, useState } from "react";

import { createActivity, type ActionState } from "@/app/actions/activities";
import { Field, FormMessage, Input } from "@/components/Field";
import { SubmitButton } from "@/components/SubmitButton";

export function ActivityForm({ circleId }: { circleId: string }) {
  const [state, action] = useActionState<ActionState, FormData>(
    createActivity,
    null,
  );
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  if (!open) {
    return (
      <div className="space-y-2">
        {state?.notice && (
          <FormMessage tone="notice">{state.notice}</FormMessage>
        )}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500"
        >
          活動を登録する
        </button>
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        await action(formData);
        formRef.current?.reset();
        setOpen(false);
      }}
      className="space-y-3"
    >
      {state?.error && <FormMessage tone="error">{state.error}</FormMessage>}
      <input type="hidden" name="circle_id" value={circleId} />

      <Field label="活動名">
        <Input name="title" required maxLength={100} placeholder="例: 定例練習" />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="日付">
          <Input type="date" name="date" required />
        </Field>
        <Field label="開始時刻">
          <Input type="time" name="time" required step={900} />
        </Field>
      </div>

      <Field label="場所">
        <Input name="location" maxLength={100} placeholder="例: 第1コート" />
      </Field>

      <Field label="メモ">
        <Input name="note" maxLength={200} placeholder="例: 雨天中止" />
      </Field>

      <p className="text-xs text-gray-500 dark:text-gray-400">
        過去の日付も登録できます。実施済みの活動を記録として残せます。
      </p>

      <div className="flex gap-2">
        <SubmitButton pendingLabel="登録中…">登録する</SubmitButton>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="w-full rounded-lg border border-black/15 px-4 py-2.5 text-sm font-medium transition hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
        >
          やめる
        </button>
      </div>
    </form>
  );
}
