import { deletePost, togglePin } from "@/app/actions/board";
import type { CirclePost } from "@/lib/board";

const formatter = new Intl.DateTimeFormat("ja-JP", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Tokyo",
});

export function PostList({
  posts,
  isAdmin,
  currentUserName,
  emptyLabel = "まだ投稿がありません。",
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
      <p className="rounded-lg border border-dashed border-black/15 px-4 py-6 text-center text-sm text-gray-500 dark:border-white/15 dark:text-gray-400">
        {emptyLabel}
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {posts.map((post) => {
        const isMine = post.author?.name === currentUserName;
        const canDelete = isMine || isAdmin;

        return (
          <li
            key={post.id}
            className={`rounded-lg border p-3 ${
              post.is_pinned
                ? "border-amber-300 bg-amber-50/60 dark:border-amber-900/60 dark:bg-amber-950/20"
                : "border-black/10 bg-white dark:border-white/10 dark:bg-white/5"
            }`}
          >
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              {post.is_pinned && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-800 dark:bg-amber-900/60 dark:text-amber-200">
                  お知らせ
                </span>
              )}
              <span className="font-medium text-gray-700 dark:text-gray-300">
                {post.author?.name ?? "退会したメンバー"}
              </span>
              <time dateTime={post.created_at}>
                {formatter.format(new Date(post.created_at))}
              </time>
            </div>

            <p className="mt-2 whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200">
              {post.body}
            </p>

            {(canDelete || isAdmin) && (
              <div className="mt-2 flex flex-wrap gap-2">
                {isAdmin && (
                  <form action={togglePin}>
                    <input type="hidden" name="post_id" value={post.id} />
                    <input type="hidden" name="circle_id" value={post.circle_id} />
                    <input
                      type="hidden"
                      name="pinned"
                      value={String(!post.is_pinned)}
                    />
                    <button
                      type="submit"
                      className="rounded border border-black/15 px-2 py-1 text-xs transition hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
                    >
                      {post.is_pinned ? "固定を解除" : "お知らせにする"}
                    </button>
                  </form>
                )}
                {canDelete && (
                  <form action={deletePost}>
                    <input type="hidden" name="post_id" value={post.id} />
                    <input type="hidden" name="circle_id" value={post.circle_id} />
                    <button
                      type="submit"
                      className="rounded border border-red-200 px-2 py-1 text-xs text-red-700 transition hover:bg-red-50 dark:border-red-900/50 dark:text-red-300 dark:hover:bg-red-950/40"
                    >
                      削除
                    </button>
                  </form>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
