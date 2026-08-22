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
      className="btn-primary w-full"
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
