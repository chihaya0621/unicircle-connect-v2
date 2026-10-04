"use client";

import { startTransition, useActionState, useState } from "react";

import { requestFacilityUse, type FacilityUseState } from "@/app/actions/facilities";
import { Field, FormMessage, Input, Select } from "@/components/Field";
import { TimeSelect } from "@/components/TimeSelect";
import { toJstInput } from "@/lib/jst";

/** 1回で出せる日時の数（紙の様式の行数に合わせる） */
const MAX_SLOTS = 16;

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

const COUNT_FIELDS = [
  { name: "student_count", label: "学生（名）" },
  { name: "staff_count", label: "教職員（名）" },
  { name: "other_count", label: "その他（名）" },
] as const;

/** 今日の日付（日本時間）。input[type=date] の min に使う */
function todayISO() {
  return toJstInput(new Date()).slice(0, 10);
}

/** "2026-10-17" → "土"。日付だけを扱うので、時差の影響を受けない UTC で読む */
function weekdayOf(date: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const day = new Date(`${date}T00:00:00Z`);
  return Number.isNaN(day.getTime()) ? null : WEEKDAYS[day.getUTCDay()];
}

/**
 * 施設使用許可願。紙の様式と同じ順（団体名・目的・利用人員・日時・
 * 使用用具・器具等・備考）に並べる。
 *
 * 学生番号・所属・氏名・連絡先はアカウントから分かり、受付欄は職員の
 * 承認が受け持つので、どちらも尋ねない。
 *
 * 入力が多いので、断られたときは入力を残す。form の action に渡すと
 * 返事のたびに欄が空に戻るため、送信は onSubmit から行う。
 */
export function FacilityUseForm({
  facilityId,
  circles,
}: {
  facilityId: string;
  circles: { id: string; name: string }[];
}) {
  const [state, dispatch, pending] = useActionState<FacilityUseState, FormData>(
    requestFacilityUse,
    null,
  );

  return (
    <div className="space-y-4">
      {state?.error && <FormMessage tone="error">{state.error}</FormMessage>}
      {!state?.error && state?.notice && (
        <FormMessage tone="notice">{state.notice}</FormMessage>
      )}
      {/* 出せたときだけ at が変わり、欄を空に戻す */}
      <FacilityUseFields
        key={state?.at ?? 0}
        facilityId={facilityId}
        circles={circles}
        pending={pending}
        onSubmit={(formData) => startTransition(() => dispatch(formData))}
      />
    </div>
  );
}

function FacilityUseFields({
  facilityId,
  circles,
  pending,
  onSubmit,
}: {
  facilityId: string;
  circles: { id: string; name: string }[];
  pending: boolean;
  onSubmit: (formData: FormData) => void;
}) {
  const [slots, setSlots] = useState([{ id: 1, date: "" }]);
  const [nextId, setNextId] = useState(2);
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [outside, setOutside] = useState(false);

  const total = COUNT_FIELDS.reduce((sum, f) => {
    const n = Number(counts[f.name]);
    return sum + (Number.isInteger(n) && n > 0 ? n : 0);
  }, 0);

  const addSlot = () => {
    setSlots((list) => [...list, { id: nextId, date: "" }]);
    setNextId((n) => n + 1);
  };
  const removeSlot = (id: number) =>
    setSlots((list) => list.filter((s) => s.id !== id));
  const setDate = (id: number, date: string) =>
    setSlots((list) => list.map((s) => (s.id === id ? { ...s, date } : s)));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(new FormData(e.currentTarget));
      }}
      className="space-y-6"
    >
      <input type="hidden" name="facility_id" value={facilityId} />

      <Field
        label="団体名"
        hint="サークル名義にすると、そのサークルの管理者も取り消せます"
      >
        <Select name="circle_id" defaultValue="">
          <option value="">団体なし（個人で使う）</option>
          {circles.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="目的">
        <Input
          name="purpose"
          required
          maxLength={200}
          placeholder="例: 部室での作業、定期練習"
        />
      </Field>

      <fieldset className="space-y-3">
        <legend className="mb-1.5 text-sm font-medium text-gray-800 dark:text-gray-200">
          利用人員
        </legend>
        <div className="grid grid-cols-3 gap-3">
          {COUNT_FIELDS.map((f) => (
            <Field key={f.name} label={f.label}>
              <Input
                type="number"
                name={f.name}
                min={0}
                max={9999}
                inputMode="numeric"
                placeholder="0"
                value={counts[f.name] ?? ""}
                onChange={(e) =>
                  setCounts((c) => ({ ...c, [f.name]: e.target.value }))
                }
              />
            </Field>
          ))}
        </div>
        <p className="text-sm text-gray-700 dark:text-gray-300">
          合計 <span className="font-semibold tabular-nums">{total}</span> 名
        </p>

        <fieldset>
          <legend className="mb-1.5 text-sm text-gray-800 dark:text-gray-200">
            上記のうち学外者の利用
          </legend>
          <div className="flex gap-6">
            <label className="tap-target flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="outside"
                value="no"
                checked={!outside}
                onChange={() => setOutside(false)}
                className="size-4 accent-current"
              />
              無
            </label>
            <label className="tap-target flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="outside"
                value="yes"
                checked={outside}
                onChange={() => setOutside(true)}
                className="size-4 accent-current"
              />
              有
            </label>
          </div>
        </fieldset>
        {outside && (
          <div className="space-y-3 rounded-xl border border-black/10 p-3.5 dark:border-white/15">
            <Field label="学外者の人数（名）">
              <Input
                type="number"
                name="outside_count"
                required
                min={1}
                max={total > 0 ? total : undefined}
                inputMode="numeric"
              />
            </Field>
            <label className="flex items-start gap-2.5 text-sm">
              <input
                type="checkbox"
                name="outside_rules"
                required
                className="field-check mt-0.5 size-5 shrink-0"
              />
              <span>キャンパス内は全面禁煙であることを学外の方に伝え、守ってもらいます</span>
            </label>
          </div>
        )}
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="mb-1 text-sm font-medium text-gray-800 dark:text-gray-200">
          日時
        </legend>
        <p className="text-xs text-gray-600 dark:text-gray-400">
          同じ内容で、{MAX_SLOTS}件まで日時をまとめて出せます。重なる予約が1つでもあると、
          まとめて出せません。
        </p>
        <ol className="space-y-3">
          {slots.map((slot, i) => {
            const day = weekdayOf(slot.date);
            return (
              <li key={slot.id}>
                <fieldset className="rounded-xl border border-black/10 p-3.5 dark:border-white/15">
                  <legend className="sr-only">{i + 1}件目の日時</legend>
                  <div className="mb-2 flex min-h-8 items-center justify-between gap-2">
                    <span
                      aria-hidden
                      className="text-xs font-semibold text-gray-600 tabular-nums dark:text-gray-400"
                    >
                      {i + 1}
                    </span>
                    {slots.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeSlot(slot.id)}
                        className="btn-ghost-sm"
                      >
                        この日時を消す
                      </button>
                    )}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)]">
                    <Field label={day ? `日付（${day}）` : "日付"}>
                      <Input
                        type="date"
                        name="slot_date"
                        required
                        min={todayISO()}
                        value={slot.date}
                        onChange={(e) => setDate(slot.id, e.target.value)}
                      />
                    </Field>
                    <Field label="開始時刻">
                      <TimeSelect name="slot_start" />
                    </Field>
                    <Field label="終了時刻">
                      <TimeSelect name="slot_end" />
                    </Field>
                  </div>
                </fieldset>
              </li>
            );
          })}
        </ol>
        {slots.length < MAX_SLOTS && (
          <button type="button" onClick={addSlot} className="btn-ghost-sm">
            日時を追加
          </button>
        )}
      </fieldset>

      <Field
        label="使用用具・器具等（任意）"
        hint="備品を借りるときは、備品のページから別に申請してください"
      >
        <Input
          name="equipment_note"
          maxLength={200}
          placeholder="例: 持ち込みのスピーカー、延長コード"
        />
      </Field>

      <Field label="備考（任意）">
        <textarea
          name="remarks"
          rows={3}
          maxLength={500}
          className="field-input w-full"
        />
      </Field>

      <div className="rounded-xl border border-amber-300/70 bg-amber-50/70 p-3.5 text-sm dark:border-amber-800/60 dark:bg-amber-950/30">
        <p className="font-semibold">注意事項</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-5">
          <li>使用後は必ず清掃してください。</li>
          <li>火気には注意してください。</li>
        </ul>
      </div>

      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "申請しています…" : "使用許可を申請する"}
      </button>
    </form>
  );
}
