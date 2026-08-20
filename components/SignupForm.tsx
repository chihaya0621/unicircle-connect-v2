"use client";

import Link from "next/link";
import { useActionState } from "react";

import { signUp, type AuthFormState } from "@/app/actions/auth";
import { Field, FormMessage, Input } from "@/components/Field";
import { SubmitButton } from "@/components/SubmitButton";

/**
 * 新規登録フォーム。
 *
 * ここで作れるのは一般ユーザーのみ。学生・職員としての登録は、
 * 大学の担当者が本人確認のうえ行う（氏名や所属大学は大学が管理する
 * 公式情報のため、自己申告できないようにしている）。
 */
export function SignupForm() {
  const [state, action] = useActionState<AuthFormState, FormData>(signUp, null);

  return (
    <form action={action} className="space-y-4">
      {state?.error && <FormMessage tone="error">{state.error}</FormMessage>}
      {state?.notice && <FormMessage tone="notice">{state.notice}</FormMessage>}

      <Field label="表示名" hint="学生として登録されると、大学に届け出た氏名に置き換わります">
        <Input name="name" required autoComplete="name" placeholder="山田 太郎" />
      </Field>

      <Field label="メールアドレス">
        <Input
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
        />
      </Field>

      <Field label="パスワード" hint="8文字以上">
        <Input
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
        />
      </Field>

      <div className="rounded-lg border border-black/10 bg-black/[0.02] p-3 text-xs text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-400">
        <p className="font-medium text-gray-800 dark:text-gray-200">
          学生の方へ
        </p>
        <p className="mt-1">
          まずこの画面で登録してください。そのあと大学の担当部署に連絡すると、
          学生として登録され、サークルへの参加や施設の予約ができるようになります。
        </p>
      </div>

      <SubmitButton pendingLabel="登録中…">アカウントを作成</SubmitButton>

      <p className="text-center text-sm text-gray-600 dark:text-gray-400">
        すでにアカウントをお持ちですか？{" "}
        <Link href="/login" className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
          ログイン
        </Link>
      </p>
    </form>
  );
}
