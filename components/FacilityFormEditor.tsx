"use client";

import { startTransition, useActionState, useState } from "react";

import { updateFacilityUseForm, type ActionState } from "@/app/actions/facilities";
import { Field, FormMessage, Input, Select } from "@/components/Field";
import {
  FORM_LIMITS,
  QUESTION_KIND_LABEL,
  type FacilityUseFormConfig,
  type FormQuestionKind,
} from "@/lib/facility-form";

type Draft = {
  /** 画面の中だけで使う並びの目印 */
  key: number;
  /** 保存済みの項目の id。新しい項目には無い（サーバーで付ける） */
  id?: string;
  label: string;
  kind: FormQuestionKind;
  /** 選択肢。1行に1つ */
  optionsText: string;
  hint: string;
  required: boolean;
  /** 対象の施設を絞るか */
  scoped: boolean;
  facilityIds: string[];
};

const KIND_HINT: Record<FormQuestionKind, string> = {
  choice: "学生は選択肢から1つを選びます",
  check: "学生がチェックを付けます。項目の名前が、チェックの横に出る文になります",
  text: "学生が短い文で答えます（200文字まで）",
};

/**
 * 施設使用許可願の、大学ごとの部分の編集欄。
 *
 * 保存すると、ページが新しい様式で描き直される。欄は version が変わる
 * たびに作り直して、保存した中身（新しい項目に付いた id など）にそろえる。
 * 保存の結果の知らせは、作り直しても消えないよう外側に持つ。
 */
export function FacilityFormEditor({
  initial,
  facilities,
  version,
}: {
  initial: FacilityUseFormConfig;
  /** 対象に選べる施設（備品は除く） */
  facilities: { id: string; name: string }[];
  version: string;
}) {
  const [state, dispatch, pending] = useActionState<ActionState, FormData>(
    updateFacilityUseForm,
    null,
  );
  const submit = (formData: FormData) => startTransition(() => dispatch(formData));

  return (
    <div className="space-y-4">
      {state?.error && <FormMessage tone="error">{state.error}</FormMessage>}
      {state?.notice && <FormMessage tone="notice">{state.notice}</FormMessage>}
      <EditorFields
        key={version}
        initial={initial}
        facilities={facilities}
        pending={pending}
        submit={submit}
      />
    </div>
  );
}

function toDrafts(form: FacilityUseFormConfig): Draft[] {
  return form.questions.map((q, i) => ({
    key: i + 1,
    id: q.id,
    label: q.label,
    kind: q.kind,
    optionsText: q.options.join("\n"),
    hint: q.hint,
    required: q.required,
    scoped: q.facility_ids.length > 0,
    facilityIds: q.facility_ids,
  }));
}

function EditorFields({
  initial,
  facilities,
  pending,
  submit,
}: {
  initial: FacilityUseFormConfig;
  facilities: { id: string; name: string }[];
  pending: boolean;
  submit: (formData: FormData) => void;
}) {
  const [notes, setNotes] = useState(initial.notes.join("\n"));
  const [outsideRule, setOutsideRule] = useState(initial.outside_rule);
  const [drafts, setDrafts] = useState<Draft[]>(() => toDrafts(initial));
  const [nextKey, setNextKey] = useState(initial.questions.length + 1);
  const [confirmingReset, setConfirmingReset] = useState(false);

  const update = (key: number, patch: Partial<Draft>) =>
    setDrafts((list) => list.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  const remove = (key: number) => setDrafts((list) => list.filter((d) => d.key !== key));
  const move = (index: number, by: -1 | 1) =>
    setDrafts((list) => {
      const next = [...list];
      const [item] = next.splice(index, 1);
      next.splice(index + by, 0, item);
      return next;
    });
  const add = () => {
    setDrafts((list) => [
      ...list,
      {
        key: nextKey,
        label: "",
        kind: "choice",
        optionsText: "",
        hint: "",
        required: true,
        scoped: false,
        facilityIds: [],
      },
    ]);
    setNextKey((k) => k + 1);
  };

  const save = () => {
    const formData = new FormData();
    formData.set(
      "form_json",
      JSON.stringify({
        notes: notes.split("\n"),
        outside_rule: outsideRule,
        questions: drafts.map((d) => ({
          id: d.id,
          label: d.label,
          kind: d.kind,
          options: d.optionsText.split("\n"),
          hint: d.hint,
          required: d.required,
          facility_ids: d.scoped ? d.facilityIds : [],
        })),
      }),
    );
    submit(formData);
  };

  const reset = () => {
    const formData = new FormData();
    formData.set("reset", "1");
    setConfirmingReset(false);
    submit(formData);
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      className="space-y-6"
    >
      <Field
        label="注意事項"
        hint={`1行に1つずつ。${FORM_LIMITS.notes}行まで。空にすると注意事項の枠を出しません`}
      >
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          className="field-input w-full"
        />
      </Field>

      <Field
        label="学外者がいるときの確認"
        hint="学外者の利用が「有」のときに、学生がチェックを付ける文です。空にすると求めません"
      >
        <Input
          value={outsideRule}
          onChange={(e) => setOutsideRule(e.target.value)}
          maxLength={FORM_LIMITS.outsideRuleLength}
        />
      </Field>

      <fieldset className="space-y-3">
        <legend className="mb-1 text-sm font-medium text-gray-800 dark:text-gray-200">
          追加の項目
        </legend>
        <p className="text-xs text-gray-600 dark:text-gray-400">
          {`大学の様式にだけある欄を足します（${FORM_LIMITS.questions}個まで）。例: 講義棟の部屋だけに「電気錠設定」（不要・必要）を出す。`}
        </p>

        {drafts.length === 0 && (
          <p className="glass-empty py-6 text-sm">追加の項目はありません。</p>
        )}

        <ol className="space-y-3">
          {drafts.map((d, i) => (
            <li key={d.key}>
              <fieldset className="space-y-3 rounded-xl border border-black/10 p-3.5 dark:border-white/15">
                <legend className="sr-only">追加の項目 {i + 1}</legend>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span
                    aria-hidden
                    className="text-xs font-semibold text-gray-600 tabular-nums dark:text-gray-400"
                  >
                    {i + 1}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => move(i, -1)}
                      disabled={i === 0}
                      className="btn-ghost-sm"
                    >
                      上へ
                    </button>
                    <button
                      type="button"
                      onClick={() => move(i, 1)}
                      disabled={i === drafts.length - 1}
                      className="btn-ghost-sm"
                    >
                      下へ
                    </button>
                    <button type="button" onClick={() => remove(d.key)} className="btn-ghost-sm">
                      この項目を消す
                    </button>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
                  <Field label="項目の名前">
                    <Input
                      value={d.label}
                      onChange={(e) => update(d.key, { label: e.target.value })}
                      required
                      maxLength={FORM_LIMITS.labelLength}
                      placeholder="例: 電気錠設定"
                    />
                  </Field>
                  <Field label="答え方">
                    <Select
                      value={d.kind}
                      onChange={(e) =>
                        update(d.key, { kind: e.target.value as FormQuestionKind })
                      }
                    >
                      {(Object.keys(QUESTION_KIND_LABEL) as FormQuestionKind[]).map((k) => (
                        <option key={k} value={k}>
                          {QUESTION_KIND_LABEL[k]}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400">{KIND_HINT[d.kind]}</p>

                {d.kind === "choice" && (
                  <Field
                    label="選択肢"
                    hint={`1行に1つずつ。${FORM_LIMITS.optionsMin}〜${FORM_LIMITS.optionsMax}個`}
                  >
                    <textarea
                      value={d.optionsText}
                      onChange={(e) => update(d.key, { optionsText: e.target.value })}
                      rows={3}
                      required
                      placeholder={"不要\n必要"}
                      className="field-input w-full"
                    />
                  </Field>
                )}

                <Field label="補足（任意）" hint="項目の下に小さく出ます">
                  <Input
                    value={d.hint}
                    onChange={(e) => update(d.key, { hint: e.target.value })}
                    maxLength={FORM_LIMITS.hintLength}
                    placeholder="例: 講義棟2階以上を20時以降に使うときは、電気錠開閉申請書も出してください"
                  />
                </Field>

                <label className="flex items-center gap-2.5 text-sm">
                  <input
                    type="checkbox"
                    checked={d.required}
                    onChange={(e) => update(d.key, { required: e.target.checked })}
                    className="field-check size-5 shrink-0"
                  />
                  必ず答えてもらう
                </label>

                <div className="space-y-2">
                  <label className="flex items-center gap-2.5 text-sm">
                    <input
                      type="checkbox"
                      checked={d.scoped}
                      onChange={(e) => update(d.key, { scoped: e.target.checked })}
                      className="field-check size-5 shrink-0"
                    />
                    一部の施設だけで尋ねる
                  </label>
                  {d.scoped && (
                    <fieldset className="max-h-48 overflow-y-auto rounded-lg border border-black/10 p-2.5 dark:border-white/15">
                      <legend className="sr-only">尋ねる施設</legend>
                      <div className="grid gap-1.5 sm:grid-cols-2">
                        {facilities.map((f) => (
                          <label key={f.id} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={d.facilityIds.includes(f.id)}
                              onChange={(e) =>
                                update(d.key, {
                                  facilityIds: e.target.checked
                                    ? [...d.facilityIds, f.id]
                                    : d.facilityIds.filter((id) => id !== f.id),
                                })
                              }
                              className="field-check size-4 shrink-0"
                            />
                            {f.name}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  )}
                </div>
              </fieldset>
            </li>
          ))}
        </ol>

        {drafts.length < FORM_LIMITS.questions && (
          <button type="button" onClick={add} className="btn-ghost-sm">
            項目を足す
          </button>
        )}
      </fieldset>

      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "保存しています…" : "保存する"}
      </button>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        {confirmingReset ? (
          <>
            <span className="text-gray-700 dark:text-gray-300">
              注意事項・確認・追加の項目を、最初の状態に戻しますか？
            </span>
            <button type="button" onClick={reset} disabled={pending} className="btn-ghost-sm">
              既定に戻す
            </button>
            <button
              type="button"
              onClick={() => setConfirmingReset(false)}
              className="btn-ghost-sm"
            >
              やめる
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingReset(true)}
            className="btn-ghost-sm"
          >
            既定に戻す…
          </button>
        )}
      </div>
    </form>
  );
}
