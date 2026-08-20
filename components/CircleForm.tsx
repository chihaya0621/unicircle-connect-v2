"use client";

import { useActionState, useState } from "react";

import { createCircle, type ActionState } from "@/app/actions/circles";
import { Field, FormMessage, Input, Select } from "@/components/Field";
import { SubmitButton } from "@/components/SubmitButton";
import type { Scope, Tables } from "@/lib/database.types";

type University = Pick<Tables<"universities">, "id" | "name">;

const SCOPE_HELP: Record<Scope, string> = {
  university: "自分の大学の学生だけが参加できます。",
  scoped:
    "指定した大学の学生だけが参加できます。合同サークルや他大学との共同活動向けです。",
  public: "どの大学の学生でも参加できます。インカレサークル向けです。",
};

export function CircleForm({
  universities,
  myUniversityId,
}: {
  universities: University[];
  myUniversityId: string | null;
}) {
  const [state, action] = useActionState<ActionState, FormData>(
    createCircle,
    null,
  );
  const [scope, setScope] = useState<Scope>("university");

  // 主管大学は自動で対象に含まれるので、選択肢からは外す
  const selectable = universities.filter((u) => u.id !== myUniversityId);

  return (
    <form action={action} className="space-y-4">
      {state?.error && <FormMessage tone="error">{state.error}</FormMessage>}

      <Field label="サークル名">
        <Input name="name" required maxLength={60} placeholder="例: テニス同好会" />
      </Field>

      <Field label="活動内容" hint="どんな活動をするか、活動頻度などを書きましょう">
        <textarea
          name="description"
          rows={5}
          maxLength={1000}
          placeholder="週2回、大学のコートで活動しています。初心者歓迎です。"
          className="w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:border-white/15 dark:bg-white/5 dark:text-gray-100 dark:focus:ring-indigo-900"
        />
      </Field>

      <Field label="参加できる範囲" hint={SCOPE_HELP[scope]}>
        <Select
          name="scope"
          value={scope}
          onChange={(e) => setScope(e.target.value as Scope)}
        >
          <option value="university">自大学のみ</option>
          <option value="scoped">指定した大学のみ</option>
          <option value="public">すべての大学（インカレ）</option>
        </Select>
      </Field>

      {scope === "scoped" && (
        <fieldset className="rounded-lg border border-black/10 p-4 dark:border-white/10">
          <legend className="px-1 text-sm font-medium">
            参加を認める大学
          </legend>
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
                    className="rounded border-black/20 text-indigo-600 focus:ring-indigo-500"
                  />
                  {u.name}
                </label>
              ))}
            </div>
          )}
          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
            自分の大学は自動的に含まれます。
          </p>
        </fieldset>
      )}

      <p className="text-xs text-gray-500 dark:text-gray-400">
        申請後、大学職員が承認するまでは一覧に表示されません。
        設立者は自動的にサークル管理者になります。
      </p>

      <SubmitButton pendingLabel="申請中…">設立を申請する</SubmitButton>
    </form>
  );
}
