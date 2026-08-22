"use client";

import { useActionState, useState } from "react";

import { updateProfile, type ActionState } from "@/app/actions/profile";
import { Field, FormMessage, Input } from "@/components/Field";
import { SubmitButton } from "@/components/SubmitButton";
import type { MyProfile } from "@/lib/mypage";

/** 表示専用の項目。編集できないことが分かるよう、入力欄では出さない。 */
function ReadOnlyRow({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div>
      <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
        {label}
      </p>
      <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300">{value}</p>
      {note && (
        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{note}</p>
      )}
    </div>
  );
}

/**
 * プロフィールの表示と編集。
 *
 * 既定は表示のみ。「編集する」を押したときだけ入力欄を出す。
 * 常時入力欄が開いていると、意図せず書き換えて保存してしまうため。
 *
 * 学生の氏名・所属大学・入学年度は大学が管理する公式情報なので、
 * 編集モードでも表示のみ。DB 側でも学生からの氏名変更は無視される。
 */
export function ProfileForm({ profile }: { profile: MyProfile }) {
  const [state, action] = useActionState<ActionState, FormData>(
    updateProfile,
    null,
  );
  const [editing, setEditing] = useState(false);

  const isStudent = profile.role === "student";

  if (!editing) {
    return (
      <div className="space-y-4">
        {state?.notice && (
          <FormMessage tone="notice">{state.notice}</FormMessage>
        )}

        <ReadOnlyRow label="氏名" value={profile.name} />
        {profile.university && (
          <ReadOnlyRow label="所属大学" value={profile.university} />
        )}
        {isStudent && (
          <>
            <ReadOnlyRow
              label="入学年度"
              value={
                profile.enrollment_year ? `${profile.enrollment_year}年` : "未設定"
              }
            />
            <ReadOnlyRow
              label="自己紹介"
              value={profile.bio || "未記入"}
            />
            <ReadOnlyRow
              label="スキル・得意なこと"
              value={
                profile.skills && profile.skills.length > 0
                  ? profile.skills.join("、")
                  : "未記入"
              }
            />
          </>
        )}

        <button
          type="button"
          onClick={() => setEditing(true)}
          className="btn-ghost py-2 font-medium"
        >
          編集する
        </button>

        {isStudent && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            氏名・所属大学・入学年度は大学が管理しています。
            変更が必要な場合は大学の担当部署にお問い合わせください。
          </p>
        )}
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      {state?.error && <FormMessage tone="error">{state.error}</FormMessage>}

      {isStudent ? (
        <>
          <ReadOnlyRow
            label="氏名"
            value={profile.name}
            note="大学が管理しているため変更できません"
          />
          {/* RPC 側で学生の氏名変更は無視されるが、引数は必須なので現在値を送る */}
          <input type="hidden" name="name" value={profile.name} />

          <Field label="自己紹介" hint="サークルの仲間や職員に公開されます">
            <textarea
              name="bio"
              rows={4}
              maxLength={500}
              defaultValue={profile.bio ?? ""}
              placeholder="興味のある分野や、参加したい活動などを書きましょう。"
              className="field-input"
            />
          </Field>

          <Field label="スキル・得意なこと" hint="カンマ区切りで入力してください">
            <Input
              name="skills"
              defaultValue={(profile.skills ?? []).join(", ")}
              placeholder="例: 写真, 動画編集, 英語"
            />
          </Field>
        </>
      ) : (
        <Field label="氏名">
          <Input name="name" required maxLength={50} defaultValue={profile.name} />
        </Field>
      )}

      <div className="flex gap-2">
        <SubmitButton pendingLabel="保存中…">保存する</SubmitButton>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="btn-ghost w-full"
        >
          やめる
        </button>
      </div>
    </form>
  );
}
