import type { Metadata } from "next";
import Link from "next/link";

import { PostComposer } from "@/components/PostComposer";
import { PostList } from "@/components/PostList";
import { listMyBoards } from "@/lib/board";
import { requireRole } from "@/lib/dal";

export const metadata: Metadata = { title: "掲示板 | UniCircle Connect" };

export default async function BoardPage() {
  // 職員はサークルに所属しないため、掲示板の対象外
  const user = await requireRole("student");
  const boards = await listMyBoards(user.id);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">掲示板</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          所属しているサークルごとの連絡です。メンバー以外には見えません。
        </p>
      </header>

      {boards.length === 0 ? (
        <p className="glass-empty py-12">
          参加中のサークルがありません。
          <Link
            href="/circles"
            className="ml-1 font-medium text-indigo-600 hover:underline dark:text-indigo-400"
          >
            サークルを探す
          </Link>
        </p>
      ) : (
        <div className="space-y-8">
          {boards.map((board) => (
            <section
              key={board.circle.id}
              className="glass-panel"
            >
              <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-semibold">
                  <Link
                    href={`/circles/${board.circle.id}`}
                    className="hover:underline"
                  >
                    {board.circle.name}
                  </Link>
                  {board.isAdmin && (
                    <span className="ml-2 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-normal text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                      管理者
                    </span>
                  )}
                </h2>
                {board.total > board.posts.length && (
                  <Link
                    href={`/circles/${board.circle.id}`}
                    className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                  >
                    すべて見る（{board.total}件）
                  </Link>
                )}
              </div>

              <div className="mb-4">
                <PostComposer circleId={board.circle.id} canPin={board.isAdmin} />
              </div>

              <PostList
                posts={board.posts}
                isAdmin={board.isAdmin}
                currentUserName={user.name}
                emptyLabel="まだ投稿がありません。最初の連絡を書いてみましょう。"
              />
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
