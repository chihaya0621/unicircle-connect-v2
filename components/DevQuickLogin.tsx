"use client";

import { useState } from "react";

import { devQuickLogin } from "@/app/actions/auth";
import { DEV_USERS, type DevUser } from "@/lib/dev-users";

const ROLE_STYLE: Record<DevUser["role"], string> = {
  student: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
  staff: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  general: "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-400",
};

const ROLE_LABEL: Record<DevUser["role"], string> = {
  student: "学生",
  staff: "職員",
  general: "一般",
};

/**
 * ユーザー切り替えパネル。
 *
 * 開発中の動作確認と、公開しているデモ環境の「その場で触ってもらう」
 * 導線を兼ねる。表示可否の判断は呼び出し側（Server Component）が行い、
 * 実際のサインインは Server Action 側でも環境を再チェックしている。
 */
export function DevQuickLogin({
  next,
  isDemo = false,
}: {
  next?: string;
  /** 公開しているデモ環境か。見出しと注意書きが変わる */
  isDemo?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<string | null>(null);

  const grouped = DEV_USERS.reduce<Record<string, DevUser[]>>((acc, u) => {
    (acc[u.university] ??= []).push(u);
    return acc;
  }, {});

  return (
    <section className="mt-6 rounded-xl border border-dashed border-amber-300 bg-amber-50/50 p-4 dark:border-amber-900/60 dark:bg-amber-950/20">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-left"
      >
        <span className="text-sm font-semibold text-amber-900 dark:text-amber-200">
          {isDemo ? "デモ用アカウントで試す" : "開発用クイックログイン"}
        </span>
        <span className="text-xs text-amber-700 dark:text-amber-400">
          {open ? "閉じる" : "開く"}
        </span>
      </button>

      {open && (
        <div className="mt-4 space-y-4">
          {Object.entries(grouped).map(([university, users]) => (
            <div key={university}>
              <p className="mb-1.5 text-xs font-medium text-amber-800 dark:text-amber-300">
                {university}
              </p>
              <ul className="space-y-1.5">
                {users.map((u) => (
                  <li key={u.email}>
                    <form
                      action={devQuickLogin}
                      onSubmit={() => setPending(u.email)}
                    >
                      <input type="hidden" name="email" value={u.email} />
                      {next && <input type="hidden" name="next" value={next} />}
                      <button
                        type="submit"
                        disabled={pending !== null}
                        className="flex w-full items-center gap-2 rounded-lg border border-black/10 bg-white px-3 py-2 text-left text-sm transition hover:bg-black/5 disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                      >
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs ${ROLE_STYLE[u.role]}`}
                        >
                          {ROLE_LABEL[u.role]}
                        </span>
                        <span className="font-medium">{u.name}</span>
                        <span className="ml-auto truncate text-xs text-gray-500 dark:text-gray-400">
                          {pending === u.email ? "ログイン中…" : u.email}
                        </span>
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {isDemo ? (
            <p className="text-xs text-amber-800 dark:text-amber-300">
              これは公開デモです。載っている大学名・サークル名・氏名は
              すべて動作確認用に生成した架空のものです。
              誰でも同じアカウントに入れるので、書き込んだ内容は
              他の人からも見えます。実在の情報は入力しないでください。
            </p>
          ) : (
            <p className="text-xs text-amber-800 dark:text-amber-300">
              アカウントが無い場合は <code>npm run db:users</code> を実行してください。
              職員は <code>supabase/promote_staff.sql</code> の実行も必要です。
            </p>
          )}
        </div>
      )}
    </section>
  );
}
