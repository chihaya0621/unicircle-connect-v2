"use client";

import { useActionState, useState } from "react";

import { updateEvent, type ActionState } from "@/app/actions/events";
import { Field, FormMessage, Input, Select } from "@/components/Field";
import { SubmitButton } from "@/components/SubmitButton";
import type { EventVisibility, Tables } from "@/lib/database.types";

type University = Pick<Tables<"universities">, "id" | "name">;

const GRADES = ["1年", "2年", "3年", "4年", "大学院", "高校生", "一般"];

const VISIBILITY_HELP: Record<EventVisibility, string> = {
  internal: "主催大学の学生・職員だけが閲覧できます。",
  scoped: "指定した大学の学生・職員だけが閲覧できます。合同イベント向けです。",
  public: "ログインしていない人を含め、誰でも閲覧できます。",
};

/**
 * イベントの編集。主催者にだけ出す。
 *
 * 主催（どの大学・どのサークルか）は変えられない。変えられると
 * 誰が管理してよいかの判定そのものが動く。
 *
 * 日時を変えると、参加者に仕掛けられたリマインドは DB 側で
 * 送信済みが解除され、新しい日時で送り直される。
 */
export function EventEditForm({
  event,
  universities,
  hostUniversityId,
}: {
  event: {
    id: string;
    title: string;
    description: string | null;
    event_date: string;
    visibility: EventVisibility;
    target_grades: string[] | null;
    public_listed: boolean;
    scopedUniversityIds: string[];
  };
  universities: University[];
  /** 主催大学。対象大学の選択肢からは外す */
  hostUniversityId: string | null;
}) {
  const [state, action] = useActionState<ActionState, FormData>(
    updateEvent,
    null,
  );
  const [visibility, setVisibility] = useState<EventVisibility>(
    event.visibility,
  );

  const selected = new Set(event.scopedUniversityIds);
  const grades = new Set(event.target_grades ?? []);
  const selectable = universities.filter((u) => u.id !== hostUniversityId);

  // datetime-local は「その場の時間帯の壁掛け時計」を求めるので、
  // 保存されている時刻を閲覧者の時間帯に直してから渡す
  const local = new Date(event.event_date);
  const localValue = new Date(
    local.getTime() - local.getTimezoneOffset() * 60000,
  )
    .toISOString()
    .slice(0, 16);

  return (
    <form action={action} className="space-y-4">
      {state?.error && <FormMessage tone="error">{state.error}</FormMessage>}

      <input type="hidden" name="event_id" value={event.id} />

      <Field label="イベント名">
        <Input name="title" required maxLength={120} defaultValue={event.title} />
      </Field>

      <Field label="開催日時">
        <Input
          name="event_date"
          type="datetime-local"
          required
          defaultValue={localValue}
        />
      </Field>

      <Field label="説明">
        <textarea
          name="description"
          rows={4}
          maxLength={2000}
          defaultValue={event.description ?? ""}
          className="field-input"
        />
      </Field>

      <Field label="公開範囲" hint={VISIBILITY_HELP[visibility]}>
        <Select
          name="visibility"
          value={visibility}
          onChange={(e) => setVisibility(e.target.value as EventVisibility)}
        >
          <option value="internal">学内限定</option>
          <option value="scoped">指定した大学</option>
          <option value="public">全体公開</option>
        </Select>
      </Field>

      {visibility === "public" && (
        <label className="flex items-start gap-2.5 text-sm">
          <input
            type="checkbox"
            name="public_listed"
            defaultChecked={event.public_listed}
            className="field-check mt-0.5"
          />
          <span>
            学外の方向けの案内にも載せる
            <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
              オープンキャンパスや学園祭など、学外の方を迎える行事に使ってください。
            </span>
          </span>
        </label>
      )}

      {visibility === "scoped" && (
        <fieldset className="rounded-lg border border-black/10 p-4 dark:border-white/10">
          <legend className="px-1 text-sm font-medium">公開する大学</legend>
          {selectable.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              他に選択できる大学がありません。
            </p>
          ) : (
            <div className="space-y-2">
              {selectable.map((u) => (
                <label key={u.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="university_ids"
                    value={u.id}
                    defaultChecked={selected.has(u.id)}
                    className="field-check"
                  />
                  {u.name}
                </label>
              ))}
            </div>
          )}
        </fieldset>
      )}

      <fieldset className="rounded-lg border border-black/10 p-4 dark:border-white/10">
        <legend className="px-1 text-sm font-medium">対象学年</legend>
        <div className="flex flex-wrap gap-3">
          {GRADES.map((g) => (
            <label key={g} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="target_grades"
                value={g}
                defaultChecked={grades.has(g)}
                className="field-check"
              />
              {g}
            </label>
          ))}
        </div>
      </fieldset>

      <SubmitButton pendingLabel="保存中…">変更を保存</SubmitButton>
    </form>
  );
}
