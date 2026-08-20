"use client";

import { useActionState, useRef, useState } from "react";

import { createPost, type ActionState } from "@/app/actions/board";
import { FormMessage } from "@/components/Field";
import { SubmitButton } from "@/components/SubmitButton";

/**
 * 投稿フォーム。
 *
 * 掲示板は「所属サークルごとのブロック」が縦に並ぶので、
 * 各ブロックで常時フォームを開いていると画面が縦に伸びすぎる。
 * 既定は折りたたみ、押したときだけ開く。
 */
export function PostComposer({
  circleId,
  canPin,
}: {
  circleId: string;
  /** 管理者のみ「お知らせとして固定」を選べる */
  canPin: boolean;
}) {
  const [state, action] = useActionState<ActionState, FormData>(
    createPost,
    null,
  );
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  if (!open) {
    return (
      <div className="space-y-2">
        {state?.notice && (
          <FormMessage tone="notice">{state.notice}</FormMessage>
        )}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full rounded-xl border border-dashed border-white/70 bg-white/25 px-3.5 py-2.5 text-left text-sm text-gray-600 backdrop-blur-md transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-white/40 hover:shadow-md dark:border-white/20 dark:bg-white/5 dark:text-gray-400 dark:hover:bg-white/10"
        >
          メンバーに連絡を投稿する…
        </button>
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        await action(formData);
        formRef.current?.reset();
        setOpen(false);
      }}
      className="space-y-3"
    >
      {state?.error && <FormMessage tone="error">{state.error}</FormMessage>}

      <input type="hidden" name="circle_id" value={circleId} />
      <textarea
        name="body"
        required
        rows={4}
        maxLength={2000}
        autoFocus
        placeholder="次回の活動日や持ち物など、メンバーへの連絡を書きましょう。"
        className="field-input"
      />

      {canPin && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="pinned"
            className="field-check"
          />
          お知らせとして上部に固定する
        </label>
      )}

      <div className="flex gap-2">
        <SubmitButton pendingLabel="投稿中…">投稿する</SubmitButton>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="btn-ghost w-full"
        >
          やめる
        </button>
      </div>
    </form>
  );
}
