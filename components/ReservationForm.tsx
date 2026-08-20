"use client";

import { useActionState } from "react";

import { createReservation, type ActionState } from "@/app/actions/facilities";
import { Field, FormMessage, Input, Select } from "@/components/Field";
import { SubmitButton } from "@/components/SubmitButton";

/** 今日の日付を input[type=date] の min 用に整形する */
function todayISO() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

export function ReservationForm({
  facilityId,
  circles,
}: {
  facilityId: string;
  circles: { id: string; name: string }[];
}) {
  const [state, action] = useActionState<ActionState, FormData>(
    createReservation,
    null,
  );

  return (
    <form action={action} className="space-y-4">
      {state?.error && <FormMessage tone="error">{state.error}</FormMessage>}
      {state?.notice && <FormMessage tone="notice">{state.notice}</FormMessage>}

      <input type="hidden" name="facility_id" value={facilityId} />

      <Field label="日付">
        <Input type="date" name="date" required min={todayISO()} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="開始時刻">
          <Input type="time" name="start_time" required step={900} />
        </Field>
        <Field label="終了時刻">
          <Input type="time" name="end_time" required step={900} />
        </Field>
      </div>

      <Field
        label="利用者"
        hint="サークル名義で予約すると、そのサークルの管理者も取り消せます"
      >
        <Select name="circle_id" defaultValue="">
          <option value="">個人として予約</option>
          {circles.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} として予約
            </option>
          ))}
        </Select>
      </Field>

      <Field label="利用目的">
        <Input name="purpose" maxLength={200} placeholder="例: 週次ミーティング" />
      </Field>

      <SubmitButton pendingLabel="申請中…">予約を申請する</SubmitButton>
    </form>
  );
}
