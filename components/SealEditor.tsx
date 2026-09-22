"use client";

import { useActionState, useState } from "react";

import { updateSeal, type ActionState } from "@/app/actions/profile";
import { FormMessage } from "@/components/Field";
import { Seal } from "@/components/Seal";
import { SubmitButton } from "@/components/SubmitButton";
import type { SealShape } from "@/lib/database.types";

/**
 * 印影を決める画面。職員のみ。
 *
 * 入力しながら現物が見えないと、何字入れたらどう組まれるかが
 * 分からない。実物の印鑑屋が校正を見せるのと同じで、
 * 押される前に確かめられるようにしている。
 */
export function SealEditor({
  current,
  shape: currentShape,
  fallback,
}: {
  current: string | null;
  shape: SealShape;
  /** 未設定のときに使われる文字（氏名の頭2字） */
  fallback: string;
}) {
  const [state, action] = useActionState<ActionState, FormData>(
    updateSeal,
    null,
  );
  const [text, setText] = useState(current ?? "");
  const [shape, setShape] = useState<SealShape>(currentShape);

  const preview = text.trim() || fallback;

  return (
    <form action={action} className="space-y-4">
      {state?.error && <FormMessage tone="error">{state.error}</FormMessage>}
      {state?.notice && <FormMessage tone="notice">{state.notice}</FormMessage>}

      <div className="flex flex-wrap items-start gap-6">
        <div className="flex flex-col items-center gap-2">
          <div className="rounded-xl border border-black/10 bg-white p-3 dark:border-white/15 dark:bg-white/5">
            <Seal text={preview} shape={shape} size={76} />
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {text.trim() ? "この印になります" : "未設定のときの印"}
          </span>
        </div>

        <div className="min-w-[14rem] flex-1 space-y-3">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">彫る文字</span>
            <input
              name="seal_text"
              value={text}
              onChange={(e) => setText([...e.target.value].slice(0, 4).join(""))}
              placeholder={fallback}
              className="field-input w-full"
              aria-describedby="seal-hint"
            />
          </label>

          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium">形</legend>
            <div className="flex gap-2">
              {(
                [
                  ["circle", "丸（認印）"],
                  ["square", "角（角印）"],
                ] as const
              ).map(([value, label]) => (
                <label
                  key={value}
                  className={`cursor-pointer rounded-lg border px-3 py-1.5 text-sm transition ${
                    shape === value
                      ? "border-indigo-500 bg-indigo-500/10 font-medium"
                      : "border-black/10 hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
                  }`}
                >
                  <input
                    type="radio"
                    name="seal_shape"
                    value={value}
                    checked={shape === value}
                    onChange={() => setShape(value)}
                    className="sr-only"
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>

          <SubmitButton pendingLabel="保存中…">印影を保存</SubmitButton>
        </div>
      </div>

      <p id="seal-hint" className="text-xs text-gray-500 dark:text-gray-400">
        1〜4字。空にすると未設定に戻り、承認したときは氏名の頭2字で押されます。
        押した印影はその時点の記録として残るので、
        あとから彫り直しても過去に押した跡は変わりません。
      </p>
    </form>
  );
}
