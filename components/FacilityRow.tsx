"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import {
  deleteFacility,
  toggleFacility,
  updateFacility,
  type ActionState,
} from "@/app/actions/facilities";
import { Field, FormMessage, Input, Select } from "@/components/Field";
import { SubmitButton } from "@/components/SubmitButton";
import type { Facility } from "@/lib/facilities";

const CATEGORY_LABEL = { facility: "施設", equipment: "備品" } as const;

/**
 * 職員向けの施設カード。編集フォームの開閉と削除確認のために
 * クライアント状態を持つ。
 *
 * 学生向けの表示は一覧ページ側で処理する（状態を持つ必要がないため）。
 */
export function FacilityRow({ facility }: { facility: Facility }) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const [updateState, update] = useActionState<ActionState, FormData>(
    updateFacility,
    null,
  );
  const [deleteState, remove] = useActionState<ActionState, FormData>(
    deleteFacility,
    null,
  );

  return (
    <li className="glass-panel">
      {editing ? (
        <form action={update} className="space-y-3">
          {updateState?.error && (
            <FormMessage tone="error">{updateState.error}</FormMessage>
          )}
          <input type="hidden" name="facility_id" value={facility.id} />

          <Field label="名称">
            <Input name="name" required maxLength={60} defaultValue={facility.name} />
          </Field>
          <Field label="区分">
            <Select name="category" defaultValue={facility.category ?? "facility"}>
              <option value="facility">施設</option>
              <option value="equipment">備品</option>
            </Select>
          </Field>

          <div className="flex gap-2">
            <SubmitButton pendingLabel="保存中…">保存する</SubmitButton>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="btn-ghost w-full"
            >
              やめる
            </button>
          </div>
        </form>
      ) : (
        <>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-semibold">{facility.name}</h3>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {facility.category ? CATEGORY_LABEL[facility.category] : "未分類"}
              </p>
            </div>
            {!facility.is_available && (
              <span className="shrink-0 badge bg-gray-500/15 text-gray-600 dark:text-gray-400">
                利用停止中
              </span>
            )}
          </div>

          {updateState?.notice && (
            <p className="mt-3 text-xs text-emerald-700 dark:text-emerald-300">
              {updateState.notice}
            </p>
          )}
          {deleteState?.error && (
            <p
              role="alert"
              className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
            >
              {deleteState.error}
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href={`/facilities/${facility.id}`}
              className="btn-ghost-sm"
            >
              予約状況
            </Link>

            <button
              type="button"
              onClick={() => setEditing(true)}
              className="btn-ghost-sm"
            >
              編集
            </button>

            <form action={toggleFacility}>
              <input type="hidden" name="facility_id" value={facility.id} />
              <input
                type="hidden"
                name="available"
                value={String(!facility.is_available)}
              />
              <button
                type="submit"
                className="btn-ghost-sm"
              >
                {facility.is_available ? "利用停止にする" : "利用可能にする"}
              </button>
            </form>

            {confirming ? (
              <form action={remove} className="flex gap-2">
                <input type="hidden" name="facility_id" value={facility.id} />
                <button
                  type="submit"
                  className="btn-base bg-gradient-to-br from-rose-500 to-red-600 px-3 py-1.5 text-xs text-white shadow-lg shadow-rose-500/25 hover:-translate-y-0.5 hover:shadow-xl"
                >
                  本当に削除する
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  className="btn-ghost-sm"
                >
                  やめる
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="btn-danger-sm"
              >
                削除
              </button>
            )}
          </div>

          {confirming && (
            <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
              過去の予約履歴も一緒に削除されます。今後の予約が残っている場合は
              削除できません。一時的に使わせたくないだけなら「利用停止」を使ってください。
            </p>
          )}
        </>
      )}
    </li>
  );
}
