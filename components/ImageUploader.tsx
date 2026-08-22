"use client";

import Image from "next/image";
import { useActionState, useState } from "react";

import type { ActionState } from "@/app/actions/images";
import { FormMessage } from "@/components/Field";
import { SubmitButton } from "@/components/SubmitButton";

/**
 * 画像のアップロードと差し替え。
 *
 * アップロード自体は Server Action から Storage API を呼ぶ。
 * 権限判定は storage.objects のポリシーが行うので、
 * ここは入力の受け付けと表示だけ。
 */
export function ImageUploader({
  action,
  removeAction,
  idField,
  idValue,
  currentUrl,
  label,
  shape = "square",
  hint,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  removeAction: (formData: FormData) => Promise<void>;
  /** circle_id か event_id */
  idField: string;
  idValue: string;
  currentUrl: string | null;
  label: string;
  /** square はアイコン用に切り出す。contain は全体を収める（切れない） */
  shape?: "square" | "contain";
  hint?: string;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    action,
    null,
  );
  const [fileName, setFileName] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      {state?.error && <FormMessage tone="error">{state.error}</FormMessage>}
      {state?.notice && <FormMessage tone="notice">{state.notice}</FormMessage>}

      {currentUrl &&
        (shape === "square" ? (
          <div className="relative size-32 overflow-hidden rounded-2xl border border-white/60 shadow-lg dark:border-white/15">
            <Image
              src={currentUrl}
              alt={label}
              fill
              sizes="128px"
              className="object-cover"
            />
          </div>
        ) : (
          <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-white/60 bg-white/30 shadow-md backdrop-blur-sm dark:border-white/15 dark:bg-white/5">
            <Image
              src={currentUrl}
              alt={label}
              fill
              sizes="(max-width: 768px) 100vw, 640px"
              className="object-contain"
            />
          </div>
        ))}

      <form action={formAction} className="space-y-2">
        <input type="hidden" name={idField} value={idValue} />
        <label className="block">
          <span className="sr-only">{label}</span>
          <input
            type="file"
            name="image"
            accept="image/jpeg,image/png,image/webp,image/gif"
            required
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
            className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-xl file:border-0 file:bg-gradient-to-br file:from-indigo-500 file:to-violet-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white file:transition-all file:duration-300 hover:file:brightness-110 dark:text-gray-400"
          />
        </label>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {hint ?? "JPEG / PNG / WebP / GIF、5MBまで。"}
          {fileName && ` 選択中: ${fileName}`}
        </p>
        <SubmitButton pendingLabel="アップロード中…">
          {currentUrl ? "画像を差し替える" : "画像を設定する"}
        </SubmitButton>
      </form>

      {currentUrl && (
        <form action={removeAction}>
          <input type="hidden" name={idField} value={idValue} />
          <button
            type="submit"
            className="btn-danger-sm"
          >
            画像を削除する
          </button>
        </form>
      )}
    </div>
  );
}
