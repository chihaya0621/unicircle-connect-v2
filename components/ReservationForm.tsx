"use client";

import { useActionState, useState } from "react";

import { createReservation, type ActionState } from "@/app/actions/facilities";
import { Field, FormMessage, Input, Select } from "@/components/Field";
import { SubmitButton } from "@/components/SubmitButton";
import type { FacilityCategory } from "@/lib/database.types";
import { toJstInput } from "@/lib/jst";

/**
 * 今日の日付（日本時間）を input[type=date] の min 用に整形する。
 * 閲覧者の時間帯で出すと、サーバーで描いた値（UTC）と食い違う
 */
function todayISO() {
  return toJstInput(new Date()).slice(0, 10);
}

/** 30分刻みの時刻（00:00〜23:30）。午前と午後に分けて並べる */
const HALF_HOURS = Array.from({ length: 48 }, (_, i) => {
  const hour = String(Math.floor(i / 2)).padStart(2, "0");
  return `${hour}:${i % 2 === 0 ? "00" : "30"}`;
});

/**
 * 時刻の選択欄。
 *
 * input[type=time] は step を付けても、Chrome の選択欄には1分ずつの分が
 * 並ぶ（15:12 のような半端な時刻を選べてしまう）。予約は30分単位で足りる
 * ので、選択肢を30分刻みに絞る。サーバー側でも30分単位かを確かめる。
 */
function TimeSelect({ name }: { name: string }) {
  return (
    <Select name={name} required defaultValue="">
      <option value="" disabled>
        選んでください
      </option>
      <optgroup label="午前">
        {HALF_HOURS.slice(0, 24).map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </optgroup>
      <optgroup label="午後">
        {HALF_HOURS.slice(24).map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </optgroup>
    </Select>
  );
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
              <TimeSelect name="start_time" />
            </Field>
            <Field label="終了時刻">
              <TimeSelect name="end_time" />
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
