import type { Metadata } from "next";
import Link from "next/link";

import { PageHero } from "@/components/PageHero";
import { PostComposer } from "@/components/PostComposer";
import { PostList } from "@/components/PostList";
import { BOARD_VISIBLE_DAYS, listMyBoards } from "@/lib/board";
import { requireRole } from "@/lib/dal";

export const metadata: Metadata = { title: "掲示板 | UniCircle Connect" };

export default async function BoardPage() {
  // 職員はサークルに所属しないため、掲示板の対象外
  const user = await requireRole("student");
  const boards = await listMyBoards(user.id);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <PageHero
        variant="blobs"
        eyebrow="BOARD"
        title="掲示板"
        description={`所属しているサークルごとの連絡です。メンバー以外には見えません。貼られた紙は${BOARD_VISIBLE_DAYS}日で下がりますが、お知らせに固定したものは残ります。`}
      />

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
            <section key={board.circle.id}>
              {/* 見出しは板の外に置く。木枠の上に文字を載せると読みづらい */}
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
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

              <div className="cork-frame">
                <div className="cork p-4 sm:p-5">
                  <div className="mb-5">
                    <PostComposer
                      circleId={board.circle.id}
                      canPin={board.isAdmin}
                    />
                  </div>

                  <PostList
                    posts={board.posts}
                    isAdmin={board.isAdmin}
                    currentUserName={user.name}
                    emptyLabel="まだ何も貼られていません。最初の連絡を貼ってみましょう。"
                  />
                </div>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
