import type {
  SealShape,
  SponsorshipOfferStatus,
  SponsorshipStatus,
} from "@/lib/database.types";
import { jstParts } from "@/lib/jst";

/**
 * サークル協賛（0036）の型と、表示に使う小さな関数。
 *
 * 画面の部品（ブラウザ側も含む）から読むので、データベースに触る
 * lib/sponsorship.ts とは分けておく。あちらは server-only で、
 * ブラウザ側の部品から読み込むとビルドが通らない。
 */
export type Sponsorship = {
  id: string;
  circle_id: string;
  title: string;
  purpose: string;
  amount_goal: number | null;
  returns: string | null;
  /** 締め切り日（YYYY-MM-DD） */
  deadline: string;
  status: SponsorshipStatus;
  created_at: string;
  decided_at: string | null;
  closed_at: string | null;
  checked_by_name: string | null;
  checked_seal_text: string | null;
  checked_seal_shape: SealShape | null;
  circle: {
    id: string;
    name: string;
    image_path: string | null;
    university: { name: string } | null;
  } | null;
};

export type SponsorshipOffer = {
  id: string;
  request_id: string;
  sponsor_id: string | null;
  sponsor_name: string;
  sponsor_url: string | null;
  amount: number;
  message: string | null;
  status: SponsorshipOfferStatus;
  created_at: string;
  decided_at: string | null;
};

/** 企業の申し込みの一覧に出す、どの募集への申し込みか */
export type MyOffer = SponsorshipOffer & {
  request: {
    id: string;
    title: string;
    deadline: string;
    status: SponsorshipStatus;
    circle: { id: string; name: string } | null;
  } | null;
};

/** 成立した協賛企業。外に出してよい項目だけ */
export type CircleSponsor = {
  sponsor_name: string;
  sponsor_url: string | null;
  request_title: string;
  accepted_at: string | null;
};

/** 日本時間の今日（YYYY-MM-DD）。締め切りの判定は日本の日付で行う */
export function todayJst(at: Date = new Date()): string {
  const p = jstParts(at);
  const mm = String(p.month + 1).padStart(2, "0");
  const dd = String(p.day).padStart(2, "0");
  return `${p.year}-${mm}-${dd}`;
}

/** 申し込みを受け付けている（募集中で、締め切り日を過ぎていない）か */
export function isAccepting(s: Pick<Sponsorship, "status" | "deadline">): boolean {
  return s.status === "open" && s.deadline >= todayJst();
}

const yen = new Intl.NumberFormat("ja-JP");

/** 金額の表示。「100,000円」 */
export function formatYen(amount: number): string {
  return `${yen.format(amount)}円`;
}

/** 締め切り日の表示。「10月31日（金）まで」 */
export function formatDeadline(deadline: string): string {
  const [y, m, d] = deadline.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const w = "日月火水木金土"[date.getUTCDay()];
  return `${m}月${d}日（${w}）まで`;
}
