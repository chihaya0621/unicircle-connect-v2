"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { NavBadge, type NavItem } from "@/components/NavBadge";

/**
 * 狭い画面向けの開閉メニュー。
 *
 * 項目はサーバー側で組み立てたものを受け取るだけにして、
 * 「誰に何を見せるか」の判断をクライアントに持ち込まないようにしている。
 *
 * ページを移ったら必ず閉じる。クライアント遷移では再マウントされないので、
 * そのままだと開いた状態が次の画面に残る。開いた時点のパスを覚えておき、
 * 「いまのパスと一致するときだけ開いている」と導出することで、
 * 効果（useEffect）で状態を追いかけずに済ませている。
 */
export function MobileNav({
  items,
  children,
}: {
  items: NavItem[];
  /** メニュー末尾に置く要素。ユーザー名やログアウトなど */
  children?: ReactNode;
}) {
  const pathname = usePathname();
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const panelId = useId();

  const open = openedAt === pathname;
  const close = () => setOpenedAt(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpenedAt(open ? null : pathname)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? "メニューを閉じる" : "メニューを開く"}
        className="btn-ghost-sm px-2.5 py-2"
      >
        {/* 3本線と×を、線を動かして入れ替える */}
        <span aria-hidden className="relative block h-3.5 w-4">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="absolute left-0 block h-0.5 w-full rounded-full bg-current transition-all duration-300 ease-out"
              style={{
                top: open ? "0.375rem" : `${i * 0.375}rem`,
                transform: open
                  ? `rotate(${i === 0 ? 45 : i === 2 ? -45 : 0}deg)`
                  : undefined,
                opacity: open && i === 1 ? 0 : 1,
              }}
            />
          ))}
        </span>
      </button>

      {open && (
        <>
          {/* メニューの外を触ったら閉じる */}
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={close}
            className="fixed inset-0 top-14 z-30 cursor-default bg-black/10"
          />

          <div
            id={panelId}
            className="glass absolute inset-x-2 top-full z-40 mt-2 animate-[rise-in_240ms_cubic-bezier(0.22,1,0.36,1)_both] p-2 shadow-xl"
          >
            <ul className="grid gap-0.5">
              {items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm transition-colors duration-200 hover:bg-black/[0.06] dark:hover:bg-white/10"
                  >
                    {item.label}
                    <NavBadge count={item.badge ?? 0} />
                  </Link>
                </li>
              ))}
            </ul>

            {children && (
              <div className="mt-2 flex items-center justify-between gap-3 border-t border-black/10 px-3 pt-3 dark:border-white/10">
                {children}
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
