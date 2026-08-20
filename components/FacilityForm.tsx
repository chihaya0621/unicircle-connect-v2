"use client";

import { useActionState } from "react";

import { createFacility, type ActionState } from "@/app/actions/facilities";
import { Field, FormMessage, Input, Select } from "@/components/Field";
import { SubmitButton } from "@/components/SubmitButton";

export function FacilityForm() {
  const [state, action] = useActionState<ActionState, FormData>(
    createFacility,
    null,
  );

  return (
    <form action={action} className="space-y-4">
      {state?.error && <FormMessage tone="error">{state.error}</FormMessage>}
      {state?.notice && <FormMessage tone="notice">{state.notice}</FormMessage>}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="名称">
          <Input name="name" required maxLength={60} placeholder="例: 第3講義室" />
        </Field>
        <Field label="区分">
          <Select name="category" defaultValue="facility">
            <option value="facility">施設</option>
            <option value="equipment">備品</option>
          </Select>
        </Field>
      </div>

      <SubmitButton pendingLabel="登録中…">登録する</SubmitButton>
    </form>
  );
}
