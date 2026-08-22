"use client";

import { useActionState } from "react";

import {
  updateCirclePublicProfile,
  type ActionState,
} from "@/app/actions/circles";
import { FormMessage } from "@/components/Field";
import { SubmitButton } from "@/components/SubmitButton";
import type { CirclePublicProfile } from "@/lib/circles";
import type { Campus } from "@/lib/discovery";

/**
 * 公開プロフィールの編集。サークル管理者にのみ出す。
 *
 * ここに書いたものだけが、一般ユーザー（高校生・企業）や未ログインの人に
 * 見える。逆に言えば、書かなければ名前と大学しか伝わらない。
 * 何が外に出るのかが分かるよう、入力欄のすぐ横に説明を置いている。
 */
export function CirclePublicProfileForm({
  circleId,
  profile,
  campuses,
}: {
  circleId: string;
  profile: CirclePublicProfile;
  /** そのサークルの大学のキャンパス。1つも無ければ欄を出さない */
  campuses: Campus[];
}) {
  const [state, action] = useActionState<ActionState, FormData>(
    updateCirclePublicProfile,
    null,
  );

  return (
    <form action={action} className="space-y-4">
      {state?.error && <FormMessage tone="error">{state.error}</FormMessage>}
      {state?.notice && <FormMessage tone="notice">{state.notice}</FormMessage>}

      <input type="hidden" name="circle_id" value={circleId} />

      <label className="flex items-start gap-2.5 text-sm">
        <input
          type="checkbox"
          name="public_listed"
          defaultChecked={profile.public_listed}
          className="field-check mt-0.5"
        />
        <span>
          一般の方にも掲載する
          <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
            外すと、高校生・企業の方や未ログインの一覧から外れます。
            学内の学生・職員からはこれまでどおり見えます。
          </span>
        </span>
      </label>

      <div>
        <label
          htmlFor="public_intro"
          className="mb-1 block text-sm font-medium"
        >
          活動紹介
        </label>
        <textarea
          id="public_intro"
          name="public_intro"
          rows={5}
          maxLength={1000}
          defaultValue={profile.public_intro ?? ""}
          placeholder="どんな活動をしているか、どんな人が集まっているかを書いてください。"
          className="field-input"
        />
      </div>

      {campuses.length > 0 && (
        <div>
          <label htmlFor="campus_id" className="mb-1 block text-sm font-medium">
            主な活動拠点
          </label>
          <select
            id="campus_id"
            name="campus_id"
            defaultValue={profile.campus_id ?? ""}
            className="field-input"
          >
            <option value="">指定しない</option>
            {campuses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            キャンパスが複数ある大学では、どこで活動しているかが
            名前だけでは伝わりません。
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="public_schedule"
            className="mb-1 block text-sm font-medium"
          >
            活動日・場所
          </label>
          <input
            id="public_schedule"
            name="public_schedule"
            maxLength={200}
            defaultValue={profile.public_schedule ?? ""}
            placeholder="毎週火曜 18:00 / 第2部室"
            className="field-input"
          />
        </div>
        <div>
          <label
            htmlFor="public_contact"
            className="mb-1 block text-sm font-medium"
          >
            連絡先・SNS
          </label>
          <input
            id="public_contact"
            name="public_contact"
            maxLength={200}
            defaultValue={profile.public_contact ?? ""}
            placeholder="X: @example / mail@example.ac.jp"
            className="field-input"
          />
        </div>
      </div>

      <SubmitButton pendingLabel="保存中…">公開プロフィールを保存</SubmitButton>
    </form>
  );
}
