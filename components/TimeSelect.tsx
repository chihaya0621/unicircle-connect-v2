import { Select } from "@/components/Field";

/** 30分刻みの時刻（00:00〜23:30） */
const HALF_HOURS = Array.from({ length: 48 }, (_, i) => {
  const hour = String(Math.floor(i / 2)).padStart(2, "0");
  return `${hour}:${i % 2 === 0 ? "00" : "30"}`;
});

/**
 * 時刻の選択欄。午前と午後に分けて、30分刻みで並べる。
 *
 * input[type=time] は step を付けても、Chrome の選択欄には1分ずつの分が
 * 並ぶ（15:12 のような半端な時刻を選べてしまう）。予約は30分単位で足りる
 * ので、選択肢を30分刻みに絞る。サーバー側でも30分単位かを確かめる。
 */
export function TimeSelect({ name }: { name: string }) {
  return (
    <Select name={name} required defaultValue="">
      <option value="" disabled>
        選んでください
      </option>
      <optgroup label="午前">
        {HALF_HOURS.slice(0, 24).map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </optgroup>
      <optgroup label="午後">
        {HALF_HOURS.slice(24).map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </optgroup>
    </Select>
  );
}
