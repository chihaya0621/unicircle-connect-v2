"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { signUp, type AuthFormState } from "@/app/actions/auth";
import { Field, FormMessage, Input, Select } from "@/components/Field";
import { SubmitButton } from "@/components/SubmitButton";
import type { Tables } from "@/lib/database.types";

type University = Pick<Tables<"universities">, "id" | "name">;

export function SignupForm({ universities }: { universities: University[] }) {
  const [state, action] = useActionState<AuthFormState, FormData>(signUp, null);
  // 学生を選んだときだけ大学・入学年度を出すため、ロールのみクライアント状態で持つ
  const [role, setRole] = useState<"student" | "general">("student");

  return (
    <form action={action} className="space-y-4">
      {state?.error && <FormMessage tone="error">{state.error}</FormMessage>}
      {state?.notice && <FormMessage tone="notice">{state.notice}</FormMessage>}

      <Field label="アカウント種別">
        <Select
          name="role"
          value={role}
          onChange={(e) => setRole(e.target.value as "student" | "general")}
        >
          <option value="student">学生</option>
          <option value="general">一般</option>
        </Select>
      </Field>

      <Field label="氏名">
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

      {role === "student" && (
        <>
          <Field label="大学">
            <Select name="university_id" required defaultValue="">
              <option value="" disabled>
                選択してください
              </option>
              {universities.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="入学年度">
            <Input
              name="enrollment_year"
              type="number"
              min={1900}
              max={2100}
              placeholder="2025"
            />
          </Field>
        </>
      )}

      <p className="text-xs text-gray-500 dark:text-gray-400">
        大学職員アカウントはこの画面からは作成できません。担当部署にお問い合わせください。
      </p>

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
