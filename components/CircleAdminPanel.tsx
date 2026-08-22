"use client";

import { useActionState, useState } from "react";

import {
  leaveCircle,
  requestClosure,
  updateCircle,
  type ActionState,
} from "@/app/actions/circles";
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

/**
 * サークル情報の編集。管理者にだけ出す。
 *
 * 所属大学は変えられない。変えると施設や職員の担当が丸ごとずれる。
 * 承認状態もここでは動かない（職員の承認を迂回させないため）。
 */
export function CircleEditForm({
  circleId,
  name,
  description,
  scope: initialScope,
  scopedUniversityIds,
  universities,
  myUniversityId,
}: {
  circleId: string;
  name: string;
  description: string | null;
  scope: Scope;
  scopedUniversityIds: string[];
  universities: University[];
  myUniversityId: string | null;
}) {
  const [state, action] = useActionState<ActionState, FormData>(
    updateCircle,
    null,
  );
  const [scope, setScope] = useState<Scope>(initialScope);
  const selected = new Set(scopedUniversityIds);

  // 主管大学は自動で対象に含まれるので、選択肢からは外す
  const selectable = universities.filter((u) => u.id !== myUniversityId);

  return (
    <form action={action} className="space-y-4">
      {state?.error && <FormMessage tone="error">{state.error}</FormMessage>}
      {state?.notice && <FormMessage tone="notice">{state.notice}</FormMessage>}

      <input type="hidden" name="circle_id" value={circleId} />

      <Field label="サークル名">
        <Input name="name" required maxLength={60} defaultValue={name} />
      </Field>

      <Field label="説明">
        <textarea
          name="description"
          rows={4}
          maxLength={1000}
          defaultValue={description ?? ""}
          className="field-input"
        />
      </Field>

      <Field label="参加できる範囲" hint={SCOPE_HELP[scope]}>
        <Select
          name="scope"
          value={scope}
          onChange={(e) => setScope(e.target.value as Scope)}
        >
          <option value="university">自分の大学のみ</option>
          <option value="scoped">指定した大学</option>
          <option value="public">すべての大学（インカレ）</option>
        </Select>
      </Field>

      {scope === "scoped" && (
        <fieldset className="rounded-lg border border-black/10 p-4 dark:border-white/10">
          <legend className="px-1 text-sm font-medium">参加できる大学</legend>
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

      <SubmitButton pendingLabel="保存中…">サークル情報を保存</SubmitButton>
    </form>
  );
}

/**
 * 退会。
 *
 * 管理者が自分ひとりのときは DB 側で止まる。先に誰かを管理者にしてもらう。
 */
export function LeaveCircleButton({ circleId }: { circleId: string }) {
  const [state, action] = useActionState<ActionState, FormData>(
    leaveCircle,
    null,
  );
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <div className="space-y-2">
        {state?.error && <FormMessage tone="error">{state.error}</FormMessage>}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="btn-ghost-sm"
        >
          このサークルを退会する
        </button>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-2">
      {state?.error && <FormMessage tone="error">{state.error}</FormMessage>}
      <input type="hidden" name="circle_id" value={circleId} />
      <p className="text-sm text-gray-700 dark:text-gray-300">
        退会すると掲示板と活動記録が見られなくなります。もう一度参加するには
        申請が必要です。
      </p>
      <div className="flex flex-wrap gap-3">
        <SubmitButton pendingLabel="処理中…">退会する</SubmitButton>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="btn-ghost-sm"
        >
          やめる
        </button>
      </div>
    </form>
  );
}

/**
 * 廃止の申請と取り下げ。管理者にだけ出す。
 *
 * 申請しても活動はそのまま続く。職員の承認が揃った時点で廃止になる。
 */
export function ClosureRequest({
  circleId,
  requested,
  requiredApprovals,
  approvedCount,
}: {
  circleId: string;
  requested: boolean;
  requiredApprovals: number;
  /** すでに集まっている承認の数 */
  approvedCount: number;
}) {
  const [open, setOpen] = useState(false);

  if (requested) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-amber-700 dark:text-amber-300">
          廃止を申請しています（承認 {approvedCount} / {requiredApprovals} 人）。
          承認が揃うまで活動は続けられます。
        </p>
        <form action={requestClosure}>
          <input type="hidden" name="circle_id" value={circleId} />
          <input type="hidden" name="cancel" value="true" />
          <button type="submit" className="btn-ghost-sm">
            申請を取り下げる
          </button>
        </form>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-danger-sm"
      >
        サークルの廃止を申請する
      </button>
    );
  }

  return (
    <form action={requestClosure} className="space-y-2">
      <input type="hidden" name="circle_id" value={circleId} />
      <p className="text-sm text-gray-700 dark:text-gray-300">
        大学職員{requiredApprovals}人の承認で廃止されます。
        申請中も活動は続けられ、取り下げもできます。
      </p>
      <div className="flex flex-wrap gap-3">
        <SubmitButton pendingLabel="申請中…">廃止を申請する</SubmitButton>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="btn-ghost-sm"
        >
          やめる
        </button>
      </div>
    </form>
  );
}
