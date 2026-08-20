"use client";

import { useActionState, useState } from "react";

import { createEvent, type ActionState } from "@/app/actions/events";
import { Field, FormMessage, Input, Select } from "@/components/Field";
import { SubmitButton } from "@/components/SubmitButton";
import type { EventVisibility, Tables, UserRole } from "@/lib/database.types";

type University = Pick<Tables<"universities">, "id" | "name">;

/** 想定される対象学年。未選択なら「全員」の意味になる。 */
const GRADES = ["1年", "2年", "3年", "4年", "大学院", "高校生", "一般"];

const VISIBILITY_HELP: Record<EventVisibility, string> = {
  internal: "主催大学の学生・職員だけが閲覧できます。",
  scoped: "指定した大学の学生・職員だけが閲覧できます。合同イベント向けです。",
  public: "ログインしていない人を含め、誰でも閲覧できます。",
};

function todayISO() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

export function EventForm({
  role,
  circles,
  universities,
  myUniversityId,
}: {
  role: UserRole;
  /** 自分が管理者を務める承認済みサークル */
  circles: { id: string; name: string }[];
  universities: University[];
  myUniversityId: string | null;
}) {
  const [state, action] = useActionState<ActionState, FormData>(
    createEvent,
    null,
  );
  const [visibility, setVisibility] = useState<EventVisibility>("internal");
  // 職員は大学主催（空文字）も選べる。学生はサークル必須。
  const [circleId, setCircleId] = useState(
    role === "staff" ? "" : (circles[0]?.id ?? ""),
  );

  const selectableUniversities = universities.filter(
    (u) => u.id !== myUniversityId,
  );

  return (
    <form action={action} className="space-y-4">
      {state?.error && <FormMessage tone="error">{state.error}</FormMessage>}

      <Field label="主催">
        <Select
          name="circle_id"
          value={circleId}
          onChange={(e) => setCircleId(e.target.value)}
        >
          {role === "staff" && <option value="">大学公式イベント</option>}
          {circles.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="イベント名">
        <Input
          name="title"
          required
          maxLength={100}
          placeholder="例: 新歓ライブ"
        />
      </Field>

      <Field label="詳細">
        <textarea
          name="description"
          rows={5}
          maxLength={2000}
          placeholder="会場、持ち物、参加方法などを書きましょう。"
          className="w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:border-white/15 dark:bg-white/5 dark:text-gray-100 dark:focus:ring-indigo-900"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="開催日">
          <Input type="date" name="event_date" required min={todayISO()} />
        </Field>
        <Field label="開始時刻">
          <Input type="time" name="event_time" required step={900} />
        </Field>
      </div>

      <Field label="公開範囲" hint={VISIBILITY_HELP[visibility]}>
        <Select
          name="visibility"
          value={visibility}
          onChange={(e) => setVisibility(e.target.value as EventVisibility)}
        >
          <option value="internal">学内限定</option>
          <option value="scoped">指定した大学のみ</option>
          <option value="public">全体公開</option>
        </Select>
      </Field>

      {visibility === "scoped" && (
        <fieldset className="rounded-lg border border-black/10 p-4 dark:border-white/10">
          <legend className="px-1 text-sm font-medium">公開する大学</legend>
          {selectableUniversities.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              他に選択できる大学がありません。
            </p>
          ) : (
            <div className="space-y-2">
              {selectableUniversities.map((u) => (
                <label key={u.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="university_ids"
                    value={u.id}
                    className="rounded border-black/20 text-indigo-600 focus:ring-indigo-500"
                  />
                  {u.name}
                </label>
              ))}
            </div>
          )}
          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
            主催大学は自動的に含まれます。
          </p>
        </fieldset>
      )}

      <fieldset className="rounded-lg border border-black/10 p-4 dark:border-white/10">
        <legend className="px-1 text-sm font-medium">対象学年</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {GRADES.map((g) => (
            <label key={g} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="target_grades"
                value={g}
                className="rounded border-black/20 text-indigo-600 focus:ring-indigo-500"
              />
              {g}
            </label>
          ))}
        </div>
        <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
          選択しない場合は対象を限定しません。
        </p>
      </fieldset>

      <SubmitButton pendingLabel="作成中…">イベントを作成する</SubmitButton>
    </form>
  );
}
