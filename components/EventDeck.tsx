"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";

import type { UpcomingEvent } from "@/lib/calendar";
import { imageUrl } from "@/lib/images";

/**
 * 直近の参加予定を横スライドで送る。
 *
 * 並べているのは参加予定だけなので、他と区別するための色付けはしていない。
 * 日付の大きさだけで階層をつけている。
 *
 * 送りはネイティブのスクロールスナップに任せる。スマホでは指でなぞれば動き、
 * 矢印は scrollTo を呼ぶだけなので、押した向きと見た目の動きが必ず揃う。
 * 端では矢印を無効にする。回り込ませると、押した向きと逆に滑って混乱するため。
 */

/** 自動送りの間隔 */
const ADVANCE_MS = 5500;
/** 手で触ったあと、自動送りを再開するまでの猶予 */
const RESUME_MS = 8000;

/** タイムゾーンを固定しているので、サーバーとクライアントで同じ文字列になる */
const dayFormatter = new Intl.DateTimeFormat("ja-JP", {
  month: "numeric",
  day: "numeric",
  timeZone: "Asia/Tokyo",
});
const weekdayFormatter = new Intl.DateTimeFormat("ja-JP", {
  weekday: "short",
  timeZone: "Asia/Tokyo",
});
const timeFormatter = new Intl.DateTimeFormat("ja-JP", {
  timeStyle: "short",
  timeZone: "Asia/Tokyo",
});

export function EventDeck({ events }: { events: UpcomingEvent[] }) {
  const total = events.length;
  const trackRef = useRef<HTMLUListElement>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  // 現在地はスクロール位置から求めるので、自動送りからは ref 経由で読む
  const indexRef = useRef(0);
  const touchedAt = useRef(0);

  const goTo = useCallback((target: number, smooth = true) => {
    const track = trackRef.current;
    const slide = track?.children[target] as HTMLElement | undefined;
    if (!track || !slide) return;
    track.scrollTo({
      left: slide.offsetLeft,
      behavior: smooth ? "smooth" : "auto",
    });
  }, []);

  /** スクロール位置から、いま中央に来ているカードを割り出す */
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        let nearest = 0;
        let shortest = Infinity;
        Array.from(track.children).forEach((child, i) => {
          const distance = Math.abs(
            (child as HTMLElement).offsetLeft - track.scrollLeft,
          );
          if (distance < shortest) {
            shortest = distance;
            nearest = i;
          }
        });
        indexRef.current = nearest;
        setIndex(nearest);
      });
    };

    track.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      track.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  /** 自動送り。最後まで行ったら先頭へ戻すが、そこだけは滑らせない
      （逆向きに大きく滑ると、押した矢印と動きが食い違って見えるため） */
  useEffect(() => {
    if (total < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const timer = setInterval(() => {
      if (paused) return;
      if (Date.now() - touchedAt.current < RESUME_MS) return;
      const next = (indexRef.current + 1) % total;
      goTo(next, next !== 0);
    }, ADVANCE_MS);

    return () => clearInterval(timer);
  }, [total, paused, goTo]);

  if (total === 0) return null;

  const touched = () => {
    touchedAt.current = Date.now();
  };

  const step = (delta: number) => {
    touched();
    goTo(Math.min(Math.max(index + delta, 0), total - 1));
  };

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">参加予定</h2>

        {total > 1 && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => step(-1)}
              disabled={index === 0}
              className="btn-ghost-sm px-2.5"
              aria-label="前の予定"
            >
              ←
            </button>
            <span
              className="w-12 text-center text-xs tabular-nums text-gray-500 dark:text-gray-400"
              /* 自動送りの最中は読み上げない。操作して止めている間だけ知らせる */
              aria-live={paused ? "polite" : "off"}
            >
              {index + 1} / {total}
            </span>
            <button
              type="button"
              onClick={() => step(1)}
              disabled={index === total - 1}
              className="btn-ghost-sm px-2.5"
              aria-label="次の予定"
            >
              →
            </button>
          </div>
        )}
      </div>

      <ul
        ref={trackRef}
        className="deck-track"
        onPointerDown={touched}
        onWheel={touched}
        onKeyDown={touched}
      >
        {events.map((event) => {
          const date = new Date(event.event_date);
          const image = imageUrl(event.image_path);

          return (
            <li key={event.id} className="deck-slide">
              <Link
                href={`/events/${event.id}`}
                className="glass-card flex h-full items-center gap-3 p-4 sm:gap-4 sm:p-5"
              >
                {/* 日付を主役にする。何日の予定かが最初に読めてほしい */}
                <div className="shrink-0 text-center">
                  <p
                    className="text-2xl font-extrabold leading-none tracking-tight tabular-nums sm:text-3xl"
                    style={{ color: "rgb(var(--accent))" }}
                  >
                    {dayFormatter.format(date)}
                  </p>
                  <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400 sm:text-xs">
                    {weekdayFormatter.format(date)}・{timeFormatter.format(date)}
                  </p>
                </div>

                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 font-semibold leading-snug">
                    {event.title}
                  </p>
                  <p className="mt-1 truncate text-xs text-gray-500 dark:text-gray-400">
                    {event.host_kind === "university"
                      ? "大学主催"
                      : "サークル主催"}
                    {" ／ "}
                    {event.host_name}
                  </p>
                </div>

                {image && (
                  <div className="relative size-14 shrink-0 overflow-hidden rounded-2xl border border-white/60 dark:border-white/15 sm:size-20">
                    <Image
                      src={image}
                      alt=""
                      fill
                      sizes="(min-width: 640px) 80px, 56px"
                      className="object-cover"
                    />
                  </div>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
