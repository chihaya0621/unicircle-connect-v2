"use client";

import { useActionState, useState } from "react";

import { updateStudent, type ActionState } from "@/app/actions/students";
import { Field, FormMessage, Input } from "@/components/Field";
import { SubmitButton } from "@/components/SubmitButton";

export type Student = {
  student_id: string;
  student_name: string;
  student_email: string | null;
  student_enrollment: number | null;
};

export function StudentRow({ student }: { student: Student }) {
  const [editing, setEditing] = useState(false);
  const [state, action] = useActionState<ActionState, FormData>(
    updateStudent,
    null,
  );

  return (
    <li className="glass-panel p-4">
      {editing ? (
        <form action={action} className="space-y-3">
          {state?.error && <FormMessage tone="error">{state.error}</FormMessage>}
          <input type="hidden" name="user_id" value={student.student_id} />

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="氏名">
              <Input
                name="name"
                required
                maxLength={50}
                defaultValue={student.student_name}
              />
            </Field>
            <Field label="入学年度">
              <Input
                name="enrollment_year"
                type="number"
                min={1900}
                max={2100}
                defaultValue={student.student_enrollment ?? ""}
              />
            </Field>
          </div>

          <div className="flex gap-2">
            <SubmitButton pendingLabel="保存中…">保存する</SubmitButton>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="btn-ghost w-full"
            >
              やめる
            </button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{student.student_name}</p>
            <p className="truncate text-xs text-gray-500 dark:text-gray-400">
              {student.student_email ?? "メール不明"}
              {student.student_enrollment && ` ／ ${student.student_enrollment}年度入学`}
            </p>
            {state?.notice && (
              <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">
                {state.notice}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="shrink-0 btn-ghost-sm"
          >
            編集
          </button>
        </div>
      )}
    </li>
  );
}
