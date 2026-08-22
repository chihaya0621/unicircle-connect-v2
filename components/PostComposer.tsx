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
 *
 * 閉じているときはコルクの空きスペース、開くと書きかけの紙になる。
 * 板の上に置かれるので、ガラス系のクラスは使わない。
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
          className="note-blank"
        >
          ＋ ここに連絡を貼る…
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
      className="note note-static space-y-3"
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
        className="note-input"
      />

      {canPin && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="pinned"
            className="rounded-[3px] border-black/30 text-rose-600 transition-all duration-200 focus:ring-2 focus:ring-rose-400/40"
          />
          お知らせとして上部に固定する
        </label>
      )}

      <div className="flex items-center gap-3">
        <SubmitButton pendingLabel="投稿中…">投稿する</SubmitButton>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="note-action"
        >
          やめる
        </button>
      </div>
    </form>
  );
}
