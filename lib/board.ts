import "server-only";

import { createClient } from "@/lib/supabase-server";

export type CirclePost = {
  id: string;
  circle_id: string;
  body: string;
  is_pinned: boolean;
  created_at: string;
  author: { name: string } | null;
};

export type CircleBoard = {
  circle: { id: string; name: string };
  isAdmin: boolean;
  posts: CirclePost[];
  /** posts に載せた件数より多い場合の総数 */
  total: number;
};

const POST_SELECT = `
  id, circle_id, body, is_pinned, created_at,
  author:users!circle_posts_author_id_fkey(name)
` as const;

/**
 * 所属サークルごとの掲示板。
 *
 * 所属が増えるほどブロックが増える構成にしたいので、
 * サークル単位でまとめた配列を返す。
 *
 * RLS により非メンバーの投稿はそもそも取得できない。
 * ここでの絞り込みは表示順とブロック分けのためのもの。
 */
export async function listMyBoards(
  userId: string,
  postsPerCircle = 5,
): Promise<CircleBoard[]> {
  const supabase = await createClient();

  const { data: memberships } = await supabase
    .from("circle_members")
    .select(
      `role,
       circle:circles!circle_members_circle_id_fkey(id, name, status)`,
    )
    .eq("user_id", userId)
    .eq("status", "active")
    .returns<
      {
        role: "admin" | "member";
        circle: { id: string; name: string; status: string } | null;
      }[]
    >();

  const circles = (memberships ?? [])
    .filter((m) => m.circle !== null && m.circle.status === "approved")
    .map((m) => ({ ...m.circle!, isAdmin: m.role === "admin" }));

  if (circles.length === 0) return [];

  const { data: posts } = await supabase
    .from("circle_posts")
    .select(POST_SELECT)
    .in(
      "circle_id",
      circles.map((c) => c.id),
    )
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .returns<CirclePost[]>();

  const byCircle = new Map<string, CirclePost[]>();
  for (const p of posts ?? []) {
    const list = byCircle.get(p.circle_id) ?? [];
    list.push(p);
    byCircle.set(p.circle_id, list);
  }

  return circles
    .map((c) => {
      const all = byCircle.get(c.id) ?? [];
      return {
        circle: { id: c.id, name: c.name },
        isAdmin: c.isAdmin,
        posts: all.slice(0, postsPerCircle),
        total: all.length,
      };
    })
    // 投稿がある順に並べる。動きのあるサークルを上に出したいため。
    .sort((a, b) => b.total - a.total || a.circle.name.localeCompare(b.circle.name));
}

/** 1サークルぶんの全投稿（サークル詳細ページ用） */
export async function listCirclePosts(circleId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("circle_posts")
    .select(POST_SELECT)
    .eq("circle_id", circleId)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100)
    .returns<CirclePost[]>();
  return data ?? [];
}
