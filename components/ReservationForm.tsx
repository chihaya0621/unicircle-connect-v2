"use client";

import { useActionState, useState } from "react";

import { createReservation, type ActionState } from "@/app/actions/facilities";
import { Field, FormMessage, Input, Select } from "@/components/Field";
import { SubmitButton } from "@/components/SubmitButton";
import type { FacilityCategory } from "@/lib/database.types";

/** 今日の日付を input[type=date] の min 用に整形する */
function todayISO() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

/**
 * 予約フォーム。
 *
 * 区分によって日付の入力方法を変える。
 *   施設 (facility)  … 講義室などは同日内の時間帯予約。日付は1つ。
 *   備品 (equipment) … 貸し出しは日をまたぐため、開始日と返却日を分ける。
 *
 * スキーマは共通のまま（start_time / end_time は TIMESTAMPTZ なので
 * 日またぎを元々表現できる）。分けているのは入力体験だけ。
 */
export function ReservationForm({
  facilityId,
  category,
  circles,
}: {
  facilityId: string;
  category: FacilityCategory | null;
  circles: { id: string; name: string }[];
}) {
  const [state, action] = useActionState<ActionState, FormData>(
    createReservation,
    null,
  );

  const isEquipment = category === "equipment";
  const [startDate, setStartDate] = useState("");

  return (
    <form action={action} className="space-y-4">
      {state?.error && <FormMessage tone="error">{state.error}</FormMessage>}
      {state?.notice && <FormMessage tone="notice">{state.notice}</FormMessage>}

      <input type="hidden" name="facility_id" value={facilityId} />

      {isEquipment ? (
        <>
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
              <Input type="time" name="start_time" required step={900} />
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
              <Input type="time" name="end_time" required step={900} />
            </Field>
          </div>
        </>
      ) : (
        <>
          <Field label="日付">
            <Input
              type="date"
              name="start_date"
              required
              min={todayISO()}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </Field>
          {/* 施設は同日内の利用なので、終了日は開始日に合わせる */}
          <input type="hidden" name="end_date" value={startDate} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="開始時刻">
              <Input type="time" name="start_time" required step={900} />
            </Field>
            <Field label="終了時刻">
              <Input type="time" name="end_time" required step={900} />
            </Field>
          </div>
        </>
      )}

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

      <Field label={isEquipment ? "利用目的" : "利用目的"}>
        <Input
          name="purpose"
          maxLength={200}
          placeholder={isEquipment ? "例: 学園祭で使用" : "例: 週次ミーティング"}
        />
      </Field>

      <SubmitButton pendingLabel="申請中…">
        {isEquipment ? "貸出を申請する" : "予約を申請する"}
      </SubmitButton>
    </form>
  );
}
