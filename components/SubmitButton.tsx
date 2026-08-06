"use client";

import { useFormStatus } from "react-dom";

/**
 * 送信中は自動で無効化されるボタン。
 * `useFormStatus` は親の <form> の状態を読むため、必ず form の内側で使うこと。
 */
export function SubmitButton({
  children,
  pendingLabel = "送信中…",
}: {
  children: React.ReactNode;
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
