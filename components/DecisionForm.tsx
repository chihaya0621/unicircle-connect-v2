"use client";

import { useActionState } from "react";

import type { ActionState } from "@/app/actions/circles";
import { FormMessage } from "@/components/Field";

/**
 * 承認・却下のフォーム。
 *
 * 失敗したら、押した人に理由を見せる。以前はサーバーのログに書くだけで、
 * 画面には何も出なかった。公開デモでは同じ職員のアカウントを何人もが
 * 使うので、2人目が押すと「押しても何も起きない」ように見えていた。
 *
 * 送信中は中身をまとめて無効にして、続けて押しても1回しか送らない。
 * 押したボタンの name と value は、無効にする前に FormData に入る。
 */
export function DecisionForm({
  action,
  className = "",
  children,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  className?: string;
  children: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <form action={formAction} className={className} aria-busy={pending}>
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
      {state?.error && (
        <div className="basis-full max-w-xs">
          <FormMessage tone="error">{state.error}</FormMessage>
        </div>
      )}
    </form>
  );
}
