"use client";

import { useActionState, useRef } from "react";

import { removeCampus, saveCampus, type ActionState } from "@/app/actions/campuses";
import { FormMessage } from "@/components/Field";
import { SubmitButton } from "@/components/SubmitButton";
import type { Campus } from "@/lib/discovery";

/**
 * 自大学のキャンパス管理。職員にのみ出す。
 *
 * サークルはここに登録されたものから拠点を選ぶ。増やす場所が
 * どこにも無いと、複数キャンパスの大学で拠点を書けなくなる。
 */
export function CampusManager({ campuses }: { campuses: Campus[] }) {
  const [state, action] = useActionState<ActionState, FormData>(
    saveCampus,
    null,
  );
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div className="space-y-4">
      {state?.error && <FormMessage tone="error">{state.error}</FormMessage>}
      {state?.notice && <FormMessage tone="notice">{state.notice}</FormMessage>}

      {campuses.length > 0 && (
        <ul className="space-y-2">
          {campuses.map((c) => (
            <li
              key={c.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black/[0.08] px-3.5 py-2.5 dark:border-white/10"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">{c.name}</p>
                {c.address && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {c.address}
                  </p>
                )}
              </div>
              <form action={removeCampus}>
                <input type="hidden" name="campus_id" value={c.id} />
                <button type="submit" className="btn-danger-sm">
                  削除
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <form
        ref={formRef}
        action={async (data) => {
          await action(data);
          formRef.current?.reset();
        }}
        className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
      >
        <div>
          <label htmlFor="campus-name" className="mb-1 block text-xs font-medium">
            キャンパス名
          </label>
          <input
            id="campus-name"
            name="name"
            required
            maxLength={60}
            placeholder="第2キャンパス"
            className="field-input"
          />
        </div>
        <div>
          <label
            htmlFor="campus-address"
            className="mb-1 block text-xs font-medium"
          >
            住所（任意）
          </label>
          <input
            id="campus-address"
            name="address"
            maxLength={200}
            placeholder="横浜市○○区…"
            className="field-input"
          />
        </div>
        <SubmitButton pendingLabel="追加中…">追加</SubmitButton>
      </form>
    </div>
  );
}
