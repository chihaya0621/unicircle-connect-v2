"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/dal";
import { createClient } from "@/lib/supabase-server";

export type ActionState = { error?: string; notice?: string } | null;

/**
 * サークル協賛（0036）。
 *
 * 誰が何をできるかの判断は、すべて RPC 側にある。ここで確かめるのは
 * 入力の形だけで、往復する前に気づけるようにするためのもの。
 */

/** 金額の入力を数にする。「30,000」「３００００」も受ける */
function parseAmount(raw: FormDataEntryValue | null): number | null {
  const s = String(raw ?? "")
    .normalize("NFKC")
    .replace(/[,，円\s]/g, "");
  if (!s) return null;
  if (!/^\d+$/.test(s)) return Number.NaN;
  return Number(s);
}

function refresh(circleId: string, requestId?: string) {
  revalidatePath(`/circles/${circleId}`);
  revalidatePath("/sponsorships");
  if (requestId) revalidatePath(`/sponsorships/${requestId}`);
}

/** 協賛を募集する。サークルの管理者のみ */
export async function requestSponsorship(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("student");

  const circleId = String(formData.get("circle_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const purpose = String(formData.get("purpose") ?? "").trim();
  const returns = String(formData.get("returns") ?? "").trim();
  const deadline = String(formData.get("deadline") ?? "");
  const goal = parseAmount(formData.get("amount_goal"));

  if (!circleId) return { error: "サークルが指定されていません。" };
  if (!title || title.length > 60) {
    return { error: "題名は60文字以内で入力してください。" };
  }
  if (!purpose || purpose.length > 1000) {
    return { error: "使い道は1000文字以内で入力してください。" };
  }
  if (returns.length > 500) {
    return { error: "お返しは500文字以内で入力してください。" };
  }
  if (goal !== null && (Number.isNaN(goal) || goal < 1000 || goal > 10_000_000)) {
    return { error: "目標額は1,000円から1,000万円のあいだで入力してください。" };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(deadline)) {
    return { error: "締め切りの日付を選んでください。" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("request_sponsorship", {
    p_circle_id: circleId,
    p_title: title,
    p_purpose: purpose,
    p_amount_goal: goal,
    p_returns: returns || null,
    p_deadline: deadline,
  });
  if (error) return { error: error.message };

  refresh(circleId);
  revalidatePath("/staff");
  return {
    notice:
      "募集を出しました。大学の職員が中身を確かめると、企業から見えるようになります。",
  };
}

/** 協賛の募集を確かめる（判子）。その大学の職員のみ */
export async function decideSponsorship(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("staff");

  const requestId = String(formData.get("request_id") ?? "");
  const circleId = String(formData.get("circle_id") ?? "");
  const approve = formData.get("approve") === "true";
  if (!requestId) return { error: "募集が指定されていません。" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("decide_sponsorship", {
    p_request_id: requestId,
    p_approve: approve,
    p_comment: String(formData.get("comment") ?? "").trim() || null,
  });

  // 失敗しても引き直す。ほかの職員が先に決めていれば、それが見える
  revalidatePath("/staff");
  if (circleId) refresh(circleId, requestId);

  if (error) {
    return {
      error: `${approve ? "承認" : "見送り"}できませんでした（${error.message}）。`,
    };
  }
  return null;
}

/** 協賛を申し込む。企業・一般のアカウントのみ */
export async function offerSponsorship(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("general");

  const requestId = String(formData.get("request_id") ?? "");
  const circleId = String(formData.get("circle_id") ?? "");
  const sponsorName = String(formData.get("sponsor_name") ?? "").trim();
  const sponsorUrl = String(formData.get("sponsor_url") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();
  const amount = parseAmount(formData.get("amount"));

  if (!requestId) return { error: "募集が指定されていません。" };
  if (!sponsorName || sponsorName.length > 60) {
    return { error: "会社名・団体名は60文字以内で入力してください。" };
  }
  if (sponsorUrl && !/^https?:\/\//.test(sponsorUrl)) {
    return {
      error: "Web サイトは http:// か https:// で始まる URL で入力してください。",
    };
  }
  if (amount === null || Number.isNaN(amount) || amount < 1000 || amount > 10_000_000) {
    return { error: "金額は1,000円から1,000万円のあいだで入力してください。" };
  }
  if (message.length > 1000) {
    return { error: "メッセージは1000文字以内で入力してください。" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("offer_sponsorship", {
    p_request_id: requestId,
    p_sponsor_name: sponsorName,
    p_sponsor_url: sponsorUrl || null,
    p_amount: amount,
    p_message: message || null,
  });
  if (error) return { error: error.message };

  if (circleId) refresh(circleId, requestId);
  revalidatePath("/mypage");
  return {
    notice: "申し込みました。サークルが受けると成立し、通知でお知らせします。",
  };
}

/** 申し込みに答える。サークルの管理者のみ */
export async function respondSponsorshipOffer(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("student");

  const offerId = String(formData.get("offer_id") ?? "");
  const circleId = String(formData.get("circle_id") ?? "");
  const requestId = String(formData.get("request_id") ?? "");
  const accept = formData.get("accept") === "true";
  if (!offerId) return { error: "申し込みが見つかりません。" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("respond_sponsorship_offer", {
    p_offer_id: offerId,
    p_accept: accept,
  });
  if (error) return { error: error.message };

  refresh(circleId, requestId);
  return {
    notice: accept
      ? "協賛を受けました。サークルのページに企業の名前が出ます。"
      : "申し込みを見送りました。",
  };
}

/** 申し込みを取り下げる。申し込んだ本人のみ */
export async function withdrawSponsorshipOffer(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("general");

  const offerId = String(formData.get("offer_id") ?? "");
  const circleId = String(formData.get("circle_id") ?? "");
  const requestId = String(formData.get("request_id") ?? "");
  if (!offerId) return { error: "申し込みが見つかりません。" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("withdraw_sponsorship_offer", {
    p_offer_id: offerId,
  });
  if (error) return { error: error.message };

  if (circleId) refresh(circleId, requestId);
  revalidatePath("/mypage");
  return { notice: "申し込みを取り下げました。" };
}

/** 募集を締め切る。サークルの管理者のみ */
export async function closeSponsorship(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("student");

  const requestId = String(formData.get("request_id") ?? "");
  const circleId = String(formData.get("circle_id") ?? "");
  if (!requestId) return { error: "募集が指定されていません。" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("close_sponsorship", {
    p_request_id: requestId,
  });
  if (error) return { error: error.message };

  refresh(circleId, requestId);
  return { notice: "募集を締め切りました。返事待ちの申し込みには、続けて答えられます。" };
}
