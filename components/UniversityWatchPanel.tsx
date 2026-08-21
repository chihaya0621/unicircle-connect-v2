"use client";

import { useActionState } from "react";

import {
  saveWatchedUniversities,
  type ActionState,
} from "@/app/actions/discovery";
import { FormMessage } from "@/components/Field";
import { SubmitButton } from "@/components/SubmitButton";

/**
 * 気にしている大学の指定。
 *
 * 一般ユーザー（高校生・企業）は所属大学を持たないので、
 * 何も指定しないうちは全大学の公開情報が並ぶ。志望校や取引先を
 * 選んでもらうと、以降はその大学中心に見えるようになる。
 *
 * 「指定しない＝全部見せる」にしているのは、最初に来た人へ
 * 空の画面を出さないため。絞り込みは足し算ではなく引き算にする。
 */
export function UniversityWatchPanel({
  universities,
  selectedIds,
}: {
  universities: { id: string; name: string }[];
  selectedIds: string[];
}) {
  const [state, action] = useActionState<ActionState, FormData>(
    saveWatchedUniversities,
    null,
  );
  const selected = new Set(selectedIds);

  return (
    <form action={action} className="space-y-4">
      {state?.error && <FormMessage tone="error">{state.error}</FormMessage>}
      {state?.notice && <FormMessage tone="notice">{state.notice}</FormMessage>}

      <ul className="grid gap-2 sm:grid-cols-2">
        {universities.map((u) => (
          <li key={u.id}>
            <label className="flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-colors duration-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]">
              <input
                type="checkbox"
                name="university_ids"
                value={u.id}
                defaultChecked={selected.has(u.id)}
                className="field-check"
              />
              {u.name}
            </label>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingLabel="保存中…">指定を保存</SubmitButton>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          すべて外すと、全大学の公開情報を表示します。
        </p>
      </div>
    </form>
  );
}
