"use client";

import { useActionState } from "react";

import { updatePreferences, type ActionState } from "@/app/actions/notifications";
import { FormMessage } from "@/components/Field";
import { SubmitButton } from "@/components/SubmitButton";
import {
  NOTIFICATION_TYPES,
  TYPE_DESCRIPTION,
  TYPE_LABEL,
  type NotificationPreferences,
} from "@/lib/notification-types";

export function NotificationSettings({
  preferences,
}: {
  preferences: NotificationPreferences;
}) {
  const [state, action] = useActionState<ActionState, FormData>(
    updatePreferences,
    null,
  );

  return (
    <form action={action} className="space-y-4">
      {state?.error && <FormMessage tone="error">{state.error}</FormMessage>}
      {state?.notice && <FormMessage tone="notice">{state.notice}</FormMessage>}

      <ul className="space-y-3">
        {NOTIFICATION_TYPES.map((type) => (
          <li key={type}>
            <label className="flex gap-3">
              <input
                type="checkbox"
                name={type}
                defaultChecked={preferences[type]}
                className="mt-1 rounded border-black/20 text-indigo-600 focus:ring-indigo-500"
              />
              <span>
                <span className="block text-sm font-medium">
                  {TYPE_LABEL[type]}
                </span>
                <span className="block text-xs text-gray-500 dark:text-gray-400">
                  {TYPE_DESCRIPTION[type]}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>

      <SubmitButton pendingLabel="保存中…">通知設定を保存</SubmitButton>
    </form>
  );
}
