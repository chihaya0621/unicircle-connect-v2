"use client";

import { useActionState } from "react";

import { registerStudent, type ActionState } from "@/app/actions/students";
import { Field, FormMessage, Input } from "@/components/Field";
import { SubmitButton } from "@/components/SubmitButton";

export function StudentRegisterForm() {
  const [state, action] = useActionState<ActionState, FormData>(
    registerStudent,
    null,
  );

  return (
    <form action={action} className="space-y-4">
      {state?.error && <FormMessage tone="error">{state.error}</FormMessage>}
      {state?.notice && <FormMessage tone="notice">{state.notice}</FormMessage>}

      <Field
        label="メールアドレス"
        hint="本人が新規登録に使ったアドレスを入力してください"
      >
        <Input
          name="email"
          type="email"
          required
          placeholder="student@example.com"
        />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="氏名">
          <Input name="name" required maxLength={50} placeholder="山田 太郎" />
        </Field>
        <Field label="入学年度">
          <Input
            name="enrollment_year"
            type="number"
            min={1900}
            max={2100}
            placeholder="2026"
          />
        </Field>
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400">
        所属大学はあなたの所属大学が設定されます。
        登録すると、その方はサークルへの参加や施設の予約ができるようになります。
      </p>

      <SubmitButton pendingLabel="登録中…">学生として登録する</SubmitButton>
    </form>
  );
}
