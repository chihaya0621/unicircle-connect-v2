"use client";

import { useActionState } from "react";

import { updateProfile, type ActionState } from "@/app/actions/profile";
import { Field, FormMessage, Input } from "@/components/Field";
import { SubmitButton } from "@/components/SubmitButton";
import type { MyProfile } from "@/lib/mypage";

export function ProfileForm({ profile }: { profile: MyProfile }) {
  const [state, action] = useActionState<ActionState, FormData>(
    updateProfile,
    null,
  );

  const isStudent = profile.role === "student";

  return (
    <form action={action} className="space-y-4">
      {state?.error && <FormMessage tone="error">{state.error}</FormMessage>}
      {state?.notice && <FormMessage tone="notice">{state.notice}</FormMessage>}

      <Field label="氏名">
        <Input name="name" required maxLength={50} defaultValue={profile.name} />
      </Field>

      {isStudent && (
        <>
          <Field label="自己紹介" hint="サークルの仲間や職員に公開されます">
            <textarea
              name="bio"
              rows={4}
              maxLength={500}
              defaultValue={profile.bio ?? ""}
              placeholder="興味のある分野や、参加したい活動などを書きましょう。"
              className="w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:border-white/15 dark:bg-white/5 dark:text-gray-100 dark:focus:ring-indigo-900"
            />
          </Field>

          <Field label="スキル・得意なこと" hint="カンマ区切りで入力してください">
            <Input
              name="skills"
              defaultValue={(profile.skills ?? []).join(", ")}
              placeholder="例: 写真, 動画編集, 英語"
            />
          </Field>

          <Field label="入学年度">
            <Input
              name="enrollment_year"
              type="number"
              min={1900}
              max={2100}
              defaultValue={profile.enrollment_year ?? ""}
              placeholder="2025"
            />
          </Field>
        </>
      )}

      <SubmitButton pendingLabel="保存中…">保存する</SubmitButton>
    </form>
  );
}
