"use client";

import { useActionState } from "react";

import {
  requestPasswordReset,
  updatePassword,
  type AuthFormState,
} from "@/app/actions/auth";
import { Field, FormMessage } from "@/components/Field";
import { SubmitButton } from "@/components/SubmitButton";

/**
 * 再設定メールの送信。
 *
 * 送信後は、宛先が登録済みかどうかに関わらず同じ文面を出す。
 * 出し分けると、どのアドレスが登録されているかを外から確かめられる。
 */
export function PasswordResetForm() {
  const [state, action] = useActionState<AuthFormState, FormData>(
    requestPasswordReset,
    null,
  );

  return (
    <form action={action} className="space-y-4">
      {state?.error && <FormMessage tone="error">{state.error}</FormMessage>}
      {state?.notice && <FormMessage tone="notice">{state.notice}</FormMessage>}

      <Field label="メールアドレス">
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="field-input"
        />
      </Field>

      <SubmitButton pendingLabel="送信中…">再設定メールを送る</SubmitButton>
    </form>
  );
}

/** メールのリンクから来た人が、新しいパスワードを決める欄。 */
export function UpdatePasswordForm() {
  const [state, action] = useActionState<AuthFormState, FormData>(
    updatePassword,
    null,
  );

  return (
    <form action={action} className="space-y-4">
      {state?.error && <FormMessage tone="error">{state.error}</FormMessage>}

      <Field label="新しいパスワード">
        <input
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="field-input"
        />
      </Field>

      <Field label="確認のためもう一度">
        <input
          name="confirm"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="field-input"
        />
      </Field>

      <SubmitButton pendingLabel="設定中…">設定する</SubmitButton>
    </form>
  );
}
