"use client";

import Link from "next/link";
import { useActionState } from "react";

import { signIn, type AuthFormState } from "@/app/actions/auth";
import { Field, FormMessage, Input } from "@/components/Field";
import { SubmitButton } from "@/components/SubmitButton";

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState<AuthFormState, FormData>(signIn, null);

  return (
    <form action={action} className="space-y-4">
      {state?.error && <FormMessage tone="error">{state.error}</FormMessage>}

      {/* ログイン後の戻り先。proxy.ts がクエリに付けてくる */}
      {next && <input type="hidden" name="next" value={next} />}

      <Field label="メールアドレス">
        <Input
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
        />
      </Field>

      <Field label="パスワード">
        <Input
          name="password"
          type="password"
          required
          autoComplete="current-password"
        />
      </Field>

      <SubmitButton pendingLabel="ログイン中…">ログイン</SubmitButton>

      <p className="text-center text-sm text-gray-600 dark:text-gray-400">
        アカウントをお持ちでないですか？{" "}
        <Link href="/signup" className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
          新規登録
        </Link>
      </p>
    </form>
  );
}
