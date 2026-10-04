"use client";

import { useActionState, useState } from "react";

import { createReservation, type ActionState } from "@/app/actions/facilities";
import { Field, FormMessage, Input, Select } from "@/components/Field";
import { SubmitButton } from "@/components/SubmitButton";
import { TimeSelect } from "@/components/TimeSelect";
import { toJstInput } from "@/lib/jst";

/**
 * 今日の日付（日本時間）を input[type=date] の min 用に整形する。
 * 閲覧者の時間帯で出すと、サーバーで描いた値（UTC）と食い違う
 */
function todayISO() {
  return toJstInput(new Date()).slice(0, 10);
}

/**
 * 備品の貸出の申請。
 *
 * 貸し出しは日をまたぐため、貸出日と返却日を分けて受け取る
 * （start_time / end_time は TIMESTAMPTZ なので日またぎを表せる）。
 * 施設の予約は、紙の施設使用許可願に合わせた FacilityUseForm を使う。
 */
export function EquipmentLoanForm({
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
  const [startDate, setStartDate] = useState("");

  return (
    <form action={action} className="space-y-4">
      {state?.error && <FormMessage tone="error">{state.error}</FormMessage>}
      {state?.notice && <FormMessage tone="notice">{state.notice}</FormMessage>}

      <input type="hidden" name="facility_id" value={facilityId} />

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="貸出日">
          <Input
            type="date"
            name="start_date"
            required
            min={todayISO()}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </Field>
        <Field label="貸出時刻">
          <TimeSelect name="start_time" />
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="返却日" hint="日をまたぐ貸し出しができます">
          <Input
            type="date"
            name="end_date"
            required
            min={startDate || todayISO()}
          />
        </Field>
        <Field label="返却時刻">
          <TimeSelect name="end_time" />
        </Field>
      </div>

      <Field
        label="利用者"
        hint="サークル名義で借りると、そのサークルの管理者も取り消せます"
      >
        <Select name="circle_id" defaultValue="">
          <option value="">個人として借りる</option>
          {circles.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} として借りる
            </option>
          ))}
        </Select>
      </Field>

      <Field label="利用目的">
        <Input name="purpose" maxLength={200} placeholder="例: 学園祭で使用" />
      </Field>

      <SubmitButton pendingLabel="申請中…">貸出を申請する</SubmitButton>
    </form>
  );
}
