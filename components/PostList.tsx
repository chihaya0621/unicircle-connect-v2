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
      <p className="glass-empty py-6">
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
            className={`glass-card p-3.5 ${
              post.is_pinned
                ? "border-amber-300/70 bg-amber-50/55 dark:border-amber-800/60 dark:bg-amber-950/25"
                : ""
            }`}
          >
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              {post.is_pinned && (
                <span className="badge bg-amber-500/20 font-medium text-amber-800 dark:text-amber-200">
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
                      className="btn-ghost-sm px-2 py-1"
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
                      className="btn-danger-sm px-2 py-1"
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
