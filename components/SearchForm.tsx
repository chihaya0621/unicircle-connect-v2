import Link from "next/link";

/**
 * 一覧の検索欄。
 *
 * JS を使わない素の GET フォームにしている。検索語が URL に残るので、
 * 結果をそのまま共有・ブックマークでき、戻るボタンも期待どおりに動く。
 *
 * いま見ている範囲（大学やキャンパス）は hidden で持ち回る。
 * 検索するたびに一覧の先頭へ戻されるのを避けるため。
 * ページ番号だけは持ち回らない。条件が変われば件数も変わるので、
 * 3ページ目のまま別の結果を見せても意味が無い。
 */
export function SearchForm({
  action,
  placeholder,
  value,
  hidden = {},
}: {
  action: string;
  placeholder: string;
  value: string;
  /** 一緒に持ち回るクエリ。値が無いものは出さない */
  hidden?: Record<string, string | undefined>;
}) {
  const cleared = Object.entries(hidden).filter(([, v]) => v);
  const clearHref = cleared.length
    ? `${action}?${new URLSearchParams(cleared as [string, string][])}`
    : action;

  return (
    <form action={action} method="get" className="mb-6 flex flex-wrap gap-2">
      {cleared.map(([key, v]) => (
        <input key={key} type="hidden" name={key} value={v} />
      ))}

      <input
        type="search"
        name="q"
        defaultValue={value}
        placeholder={placeholder}
        aria-label={placeholder}
        className="field-input min-w-0 flex-1"
      />
      <button type="submit" className="shrink-0 btn-primary">
        検索
      </button>
      {value && (
        <Link href={clearHref} className="shrink-0 btn-ghost-sm py-2">
          クリア
        </Link>
      )}
    </form>
  );
}
