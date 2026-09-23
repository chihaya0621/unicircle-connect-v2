/**
 * 日本時間の暦。
 *
 * サーバー（Vercel）は UTC で動くので、Date のローカル系メソッド
 * （getDate / getHours / new Date(年, 月, 日) / 時差の無い日時文字列）は
 * UTC として解釈される。画面の日付や入力された日時は日本時間なので、
 * そのまま使うと 0時〜9時のものが前日に落ち、入力した 13:00 は 22:00 になる。
 * 日付と時刻を扱うところは、必ずここを通す。
 *
 * 日本には夏時間が無いので、時差は +9 時間の固定で足りる。
 */

const OFFSET_MS = 9 * 60 * 60 * 1000;

export type JstParts = {
  year: number;
  /** 0 始まり（Date と同じ） */
  month: number;
  day: number;
  /** 0 = 日曜 */
  weekday: number;
  hour: number;
  minute: number;
};

/** ある瞬間を、日本時間の年月日・時刻に分ける */
export function jstParts(at: Date): JstParts {
  const j = new Date(at.getTime() + OFFSET_MS);
  return {
    year: j.getUTCFullYear(),
    month: j.getUTCMonth(),
    day: j.getUTCDate(),
    weekday: j.getUTCDay(),
    hour: j.getUTCHours(),
    minute: j.getUTCMinutes(),
  };
}

/** 日本時間の年月日・時刻にあたる瞬間。月や日のはみ出しは Date と同じく繰り上がる */
export function jstDate(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
): Date {
  return new Date(Date.UTC(year, month, day, hour, minute) - OFFSET_MS);
}

/** 日付の同一判定に使うキー（日本時間） */
export function jstDayKey(at: Date): string {
  const p = jstParts(at);
  return `${p.year}-${p.month}-${p.day}`;
}

/**
 * フォームの日付・時刻（"2026-09-24" と "13:00"、または
 * datetime-local の "2026-09-24T13:00"）を、日本時間として読む。
 * 形式が崩れていれば Invalid Date を返す。
 */
export function parseJstInput(date: string, time?: string): Date {
  const local = time === undefined ? date : `${date}T${time}`;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(local)) {
    return new Date(NaN);
  }
  const withSeconds = local.length === 16 ? `${local}:00` : local;
  return new Date(`${withSeconds}+09:00`);
}

/** datetime-local の初期値（日本時間の "YYYY-MM-DDTHH:mm"） */
export function toJstInput(at: Date): string {
  return new Date(at.getTime() + OFFSET_MS).toISOString().slice(0, 16);
}
