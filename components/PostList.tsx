import type { CSSProperties } from "react";

import { deletePost, togglePin } from "@/app/actions/board";
import type { CirclePost } from "@/lib/board";

const formatter = new Intl.DateTimeFormat("ja-JP", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Tokyo",
});

/**
 * 紙の傾き。
 *
 * 人が貼った紙は少しずつ曲がっているので、全部まっすぐだと嘘になる。
 * ただし乱数だと再描画のたびに傾きが変わってちらつくうえ、
 * サーバーとクライアントで値が食い違う。投稿 ID から決定的に求める。
 */
function tilt(id: string) {
  // FNV-1a
  let hash = 2166136261;
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  // 最後に撹拌する（murmur3 の fmix32）。
  // 投稿 ID は末尾しか違わない連番なので、単純な積和だけだと
  // 結果も連番になり、どの紙もほぼ同じ角度になってしまう。
  hash ^= hash >>> 15;
  hash = Math.imul(hash, 2246822507);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 3266489909);
  hash ^= hash >>> 16;

  const ratio = (hash >>> 0) / 4294967296;
  return ((ratio - 0.5) * 5).toFixed(2);
}

/**
 * コルクボードに貼られた連絡。
 *
 * 並べ方はグリッド。段組み（columns）だと、break-inside: avoid で
 * 割れない紙と列の釣り合わせがぶつかり、収まりきらない紙が
 * コルクの外へはみ出す。列ごとに高さをずらして、
 * 揃いすぎて見えないようにしている。
 */
export function PostList({
  posts,
  isAdmin,
  currentUserName,
  emptyLabel = "まだ何も貼られていません。",
}: {
  posts: CirclePost[];
  isAdmin: boolean;
  /**
   * 自分の投稿かの判定に使う。
   * 削除の可否は DB 側が最終判定するので、ここは表示の出し分けだけ。
   */
  currentUserName: string;
  emptyLabel?: string;
}) {
  if (posts.length === 0) {
    return (
      <p className="px-4 py-6 text-center text-sm text-white/85 [text-shadow:0_1px_3px_rgb(40_26_12/0.6)]">
        {emptyLabel}
      </p>
    );
  }

  return (
    <ul className="note-wall">
      {posts.map((post) => {
        const isMine = post.author?.name === currentUserName;
        const canDelete = isMine || isAdmin;

        return (
          <li
            key={post.id}
            className={post.is_pinned ? "note note-pinned" : "note"}
            style={{ "--tilt": `${tilt(post.id)}deg` } as CSSProperties}
          >
            {post.is_pinned && (
              <p className="mb-1.5 text-xs font-bold tracking-wide text-rose-700">
                お知らせ
              </p>
            )}

            <p className="whitespace-pre-wrap text-sm leading-relaxed">
              {post.body}
            </p>

            {/* 署名。紙の右下に書く */}
            <p
              className="mt-3 text-right text-xs"
              style={{ color: "rgb(var(--note-meta))" }}
            >
              {post.author?.name ?? "退会したメンバー"}
              {" ・ "}
              <time dateTime={post.created_at}>
                {formatter.format(new Date(post.created_at))}
              </time>
            </p>

            {canDelete && (
              <div className="mt-1 flex flex-wrap items-center gap-x-3 border-t border-black/[0.08] pt-1.5">
                {isAdmin && (
                  <form action={togglePin}>
                    <input type="hidden" name="post_id" value={post.id} />
                    <input
                      type="hidden"
                      name="circle_id"
                      value={post.circle_id}
                    />
                    <input
                      type="hidden"
                      name="pinned"
                      value={String(!post.is_pinned)}
                    />
                    <button type="submit" className="note-action">
                      {post.is_pinned ? "固定を解除" : "お知らせにする"}
                    </button>
                  </form>
                )}
                <form action={deletePost}>
                  <input type="hidden" name="post_id" value={post.id} />
                  <input type="hidden" name="circle_id" value={post.circle_id} />
                  <button
                    type="submit"
                    className="note-action note-action-danger"
                  >
                    はがす
                  </button>
                </form>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
