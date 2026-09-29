"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useFormStatus } from "react-dom";

import { devQuickLogin } from "@/app/actions/auth";

/**
 * 公開デモの案内帯。申請から承認までを、立場を切り替えながら試せる。
 *
 * 展示や LT で QR を読んだ人は、数分しか触らない。ログイン画面に戻って
 * アカウントを選び直すと、その間に「何を試していたか」が抜けてしまう。
 * 手順を順に並べ、どれも1回押せばその立場で入り直せるようにする。
 *
 * 手順の途中では、帯を畳んで「次の手順」のボタンだけを出す。開いたままだと、
 * スマホでは画面の4割ほどを手順の一覧が占め、肝心の画面が下に押し出される。
 * 広い画面では、畳んだ帯に、いまの立場でやることを1行だけ残す。立場を
 * 切り替えた直後に目に入るのが「次へ」のボタンだけだと、その立場ですることを
 * 飛ばしてしまう。始める前は、代わりにデータが架空であることを出しておく。
 * スマホでは出さない。ボタンの下に行を足すと、文をたたいたつもりでも、
 * 近くのボタンに寄せる補正（10〜16px ほど）でボタンが押され、立場が
 * 切り替わってしまう。広い画面でも、右の「次：」とのあいだはそれ以上あける。
 *
 * 切り替えはクイックログイン（Server Action）をそのまま使う。
 * 新しい権限は増えない。ログイン画面でも、誰でも職員として入れる。
 * 青空大学は設立に「職員2人の承認」が要るので、職員は2人使う。
 */
const STEPS = [
  {
    email: "student1@aozora.test",
    name: "佐藤太郎",
    role: "学生",
    title: "学生で申請する",
    short: "学生で申請",
    hint: "サークルの設立を申請します",
    next: "/circles/new",
  },
  {
    email: "staff1@aozora.test",
    name: "青空職員太郎",
    role: "職員1",
    title: "職員1が判子を押す",
    short: "職員1で押す",
    hint: "対応待ちから申請書を開いて押します",
    next: "/staff",
  },
  {
    email: "staff2@aozora.test",
    name: "青空職員次郎",
    role: "職員2",
    title: "職員2が判子を押す",
    short: "職員2で押す",
    hint: "同じ申請書に2人目の判子を押すと、成立します",
    next: "/staff",
  },
  {
    email: "student1@aozora.test",
    name: "佐藤太郎",
    role: "学生",
    title: "学生に戻って確かめる",
    short: "学生で確かめる",
    hint: "届いた通知と、印影の並んだ申請書を見ます",
    next: "/notifications",
  },
] as const;

const ROLE_LABEL = { student: "学生", staff: "職員", general: "一般" } as const;

// 帯の中の、枠だけのボタン
const OUTLINE =
  "border-amber-400 bg-white text-amber-950 hover:bg-amber-100 dark:border-amber-600 dark:bg-transparent dark:text-amber-50 dark:hover:bg-amber-900/60";

// 開いているか・どの手順まで進んだかは、この端末に覚えておく。
// 立場を切り替えると画面が移るので、覚えておかないと毎回最初に戻る
const OPEN_KEY = "uc-demo-guide";
const STEP_KEY = "uc-demo-step";
const ARRIVE_KEY = "uc-demo-arrive";
const EVENT = "uc-demo-guide-change";

// localStorage を使えない環境（保存を止めたブラウザなど）での置き場所。
// そこでは、読み込み直すまでのあいだだけ覚えておく
const memory = new Map<string, string>();

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return memory.get(key) ?? null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // 覚えておけない環境でも、いまの画面では開け閉めできるようにする
    if (value === null) memory.delete(key);
    else memory.set(key, value);
  }
}

function notify() {
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** useSyncExternalStore は同じ値なら同じものを返す必要があるので、文字列で持つ */
function snapshot() {
  return `${read(OPEN_KEY) === "open" ? 1 : 0}:${read(STEP_KEY) ?? "-"}`;
}

export function DemoGuide({
  email,
  name,
  role,
}: {
  email: string | null;
  name: string | null;
  role: keyof typeof ROLE_LABEL | null;
}) {
  const state = useSyncExternalStore(subscribe, snapshot, () => "0:-");
  const open = state.startsWith("1");
  const saved = Number(state.split(":")[1]);
  // 覚えている手順が、いまの立場と合っているときだけ「途中」とみなす。
  // 別の画面からログインし直した人に、関係の無い手順を出さない
  const step =
    Number.isInteger(saved) && STEPS[saved]?.email === email ? saved : null;

  // 手順のボタンで入り直したら、帯を畳む。押した時点で畳むと、送信中の
  // フォームごと消えてしまうので、新しい立場で描き直されてから畳む
  useEffect(() => {
    // 印が無いときに Number(null) の 0 を手順1と読むと、学生で読み込むたびに畳まれる
    const raw = read(ARRIVE_KEY);
    if (raw === null) return;
    const arriving = Number(raw);
    if (!Number.isInteger(arriving) || STEPS[arriving]?.email !== email) return;
    write(ARRIVE_KEY, null);
    write(OPEN_KEY, null);
    notify();
  }, [email]);

  const now = role
    ? `${ROLE_LABEL[role]}（${name ?? "名前未設定"}）`
    : "未ログイン（見るだけ）";
  const upcoming = step === null ? null : step < STEPS.length - 1 ? step + 1 : 0;
  // 手順に付ける印。始める前は手順1に「ここから」、ほかは、いまの立場に
  // 当たる最初の手順にだけ付ける。学生は手順1と手順4の両方に当たるが、
  // 2つに付くとどこにいるのか迷う。途中なら、押した手順に付ける
  const mine = STEPS.findIndex((s) => s.email === email);
  const markAt = (i: number): "start" | "here" | null => {
    if (step !== null) return step === i ? "here" : null;
    if (i === 0) return "start";
    return i === mine ? "here" : null;
  };

  return (
    <section
      aria-label="デモの案内"
      className="border-b border-amber-300/70 bg-amber-50/90 text-amber-950 print:hidden dark:border-amber-800/60 dark:bg-amber-950/50 dark:text-amber-50"
    >
      <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-1.5 text-sm">
        <p className="min-w-0 flex-1 truncate">
          <span className="mr-2 rounded-full bg-amber-700 px-2 py-0.5 text-xs font-bold text-white">
            デモ
          </span>
          {step !== null && (
            <span className="mr-2 text-xs font-bold">
              手順 {step + 1}/{STEPS.length}
            </span>
          )}
          {/* スマホでは幅が足りないので、立場の名前を優先して見せる */}
          <span className="hidden sm:inline">いま：</span>
          <b>{now}</b>
        </p>

        {!open && (
          <p className="hidden text-xs text-amber-900 lg:mr-4 lg:block dark:text-amber-200">
            {step === null ? (
              "架空のデータです。書き込みは、ほかの人にも見えます"
            ) : (
              <>
                <span className="font-bold">やること：</span>
                {STEPS[step].hint}
              </>
            )}
          </p>
        )}

        {upcoming !== null && !open && (
          <StepForm index={upcoming}>
            <NextButton
              label={upcoming === 0 ? "最初からもう一度" : `次：${STEPS[upcoming].short}`}
            />
          </StepForm>
        )}

        <button
          type="button"
          onClick={() => {
            write(OPEN_KEY, open ? null : "open");
            notify();
          }}
          aria-expanded={open}
          aria-controls="demo-guide-steps"
          className={`tap-target shrink-0 rounded-full border px-3 py-1 text-xs font-bold transition-colors ${OUTLINE}`}
        >
          {open ? "閉じる" : step === null ? "承認の流れを試す" : "手順"}
        </button>
      </div>

      {open && (
        <div id="demo-guide-steps" className="mx-auto max-w-5xl px-4 pb-4">
          <p className="text-sm font-bold">申請から承認まで、4つの手順で試せます</p>
          <p className="mt-0.5 text-xs text-amber-900 dark:text-amber-200">
            青空大学では、サークルの設立に職員2人の承認が要ります。押すと、その立場で入り直します。
          </p>
          <ol className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={i}>
                <StepForm index={i}>
                  <StepButton
                    number={i + 1}
                    step={s}
                    mark={markAt(i)}
                  />
                </StepForm>
              </li>
            ))}
          </ol>
          <p className="mt-2 text-xs text-amber-900 dark:text-amber-200">
            デモ用の架空のデータです。書き込んだ内容は、ほかの人にも見えます。
          </p>
        </div>
      )}
    </section>
  );
}

/** 手順の立場で入り直すフォーム。押した手順を覚えてから送る */
function StepForm({
  index,
  children,
}: {
  index: number;
  children: React.ReactNode;
}) {
  const s = STEPS[index];
  return (
    <form
      action={devQuickLogin}
      onSubmit={() => {
        write(STEP_KEY, String(index));
        write(ARRIVE_KEY, String(index));
      }}
      className="shrink-0"
    >
      <input type="hidden" name="email" value={s.email} />
      <input type="hidden" name="next" value={s.next} />
      {children}
    </form>
  );
}

/**
 * 次の手順へ進むボタン。枠だけにしておく。塗りだと、立場を切り替えた直後に、
 * その画面でやること（申請書を開く、判子を押す）より先に目に入って押される
 */
function NextButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`tap-target rounded-full border px-3 py-1 text-xs font-bold transition-colors disabled:opacity-60 ${OUTLINE}`}
    >
      {pending ? "切り替えています…" : label}
    </button>
  );
}

function StepButton({
  number,
  step,
  mark,
}: {
  number: number;
  step: (typeof STEPS)[number];
  /** start: 始める前に「ここから」と示す。here: いまの立場 */
  mark: "start" | "here" | null;
}) {
  // 押したフォームだけが「切り替えています」になる。帯は画面を移っても
  // 作り直されないので、自前の状態で持つと、押した表示が残り続ける
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-describedby={`demo-step-${number}-hint`}
      className={`flex h-full min-h-11 w-full items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors disabled:opacity-60 ${
        mark
          ? "border-amber-600 bg-amber-100 dark:border-amber-500 dark:bg-amber-900/60"
          : "border-amber-300 bg-white hover:bg-amber-100/70 dark:border-amber-700 dark:bg-white/5 dark:hover:bg-amber-900/40"
      }`}
    >
      <span
        aria-hidden
        className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-amber-700 text-xs font-bold text-white"
      >
        {number}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-bold">
          {pending ? "切り替えています…" : step.title}
        </span>
        <span
          id={`demo-step-${number}-hint`}
          className="mt-0.5 block text-xs text-amber-900 dark:text-amber-200"
        >
          {step.name}（{step.role}）・{step.hint}
        </span>
        {mark && (
          <span className="mt-1 inline-block rounded-full bg-amber-700 px-2 py-0.5 text-[11px] font-bold text-white">
            {mark === "start" ? "ここから" : "いまの立場"}
          </span>
        )}
      </span>
    </button>
  );
}
