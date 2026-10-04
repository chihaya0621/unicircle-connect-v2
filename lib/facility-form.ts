/**
 * 施設使用許可願の、大学ごとに変えられる部分（0038）。
 *
 * 基本の項目（団体名・目的・利用人員・日時・使用用具・備考）はどの大学でも
 * 共通。大学ごとに違う注意事項・学外者についての確認・追加の項目だけを、
 * 職員が変えられる。DB には universities.facility_use_form に1つの JSON で
 * 持ち、null のときはここの既定を使う。
 *
 * 職員の編集画面（クライアント）とサーバーの両方から使うので、
 * server-only にしない。
 */

export type FormQuestionKind = "choice" | "check" | "text";

export type FormQuestion = {
  id: string;
  label: string;
  kind: FormQuestionKind;
  /** 選択式の選択肢（2〜6個） */
  options: string[];
  /** 項目の下に添える補足 */
  hint: string;
  required: boolean;
  /** 尋ねる施設。空ならすべての施設 */
  facility_ids: string[];
};

export type FacilityUseFormConfig = {
  /** 注意事項。1行ずつ */
  notes: string[];
  /** 学外者がいるときに求める確認の文。空なら求めない */
  outside_rule: string;
  questions: FormQuestion[];
};

export const DEFAULT_FACILITY_USE_FORM: FacilityUseFormConfig = {
  notes: ["使用後は必ず清掃してください。", "火気には注意してください。"],
  outside_rule: "キャンパス内は全面禁煙であることを学外の方に伝え、守ってもらいます",
  questions: [],
};

export const QUESTION_KIND_LABEL: Record<FormQuestionKind, string> = {
  choice: "選択式",
  check: "確認のチェック",
  text: "自由記述",
};

/** 上限。DB の update_facility_use_form と同じ値 */
export const FORM_LIMITS = {
  notes: 10,
  noteLength: 200,
  outsideRuleLength: 200,
  questions: 10,
  labelLength: 40,
  optionsMin: 2,
  optionsMax: 6,
  optionLength: 20,
  hintLength: 200,
} as const;

function isQuestion(value: unknown): value is FormQuestion {
  if (!value || typeof value !== "object") return false;
  const q = value as Record<string, unknown>;
  return (
    typeof q.id === "string" &&
    typeof q.label === "string" &&
    (q.kind === "choice" || q.kind === "check" || q.kind === "text") &&
    Array.isArray(q.options) &&
    Array.isArray(q.facility_ids)
  );
}

/** DB の値（null なら既定）を、欠けのない形にそろえる */
export function resolveFacilityUseForm(raw: unknown): FacilityUseFormConfig {
  if (!raw || typeof raw !== "object") return DEFAULT_FACILITY_USE_FORM;
  const form = raw as Record<string, unknown>;
  return {
    notes: Array.isArray(form.notes)
      ? form.notes.filter((n): n is string => typeof n === "string")
      : [],
    outside_rule: typeof form.outside_rule === "string" ? form.outside_rule : "",
    questions: Array.isArray(form.questions)
      ? form.questions.filter(isQuestion).map((q) => ({
          ...q,
          hint: typeof q.hint === "string" ? q.hint : "",
          required: q.required === true,
        }))
      : [],
  };
}

/** その施設の願いで尋ねる項目 */
export function questionsFor(
  form: FacilityUseFormConfig,
  facilityId: string,
): FormQuestion[] {
  return form.questions.filter(
    (q) => q.facility_ids.length === 0 || q.facility_ids.includes(facilityId),
  );
}
