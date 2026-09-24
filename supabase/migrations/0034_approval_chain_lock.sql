-- =============================================================================
-- 0034: 承認のハッシュチェーンと人数判定を、同時押しでも壊れないようにする
-- =============================================================================
-- 2人の職員が同じ案件にほぼ同時に押すと、BEFORE INSERT トリガーが2つとも
-- 「前のハッシュ」を NULL（同じ値）で読み、鎖が枝分かれする。verify も落ちる。
-- あわせて app_record_approval の count(*) も、互いの未コミット行が
-- MVCC で見えず、両方 pending を返して「2件承認済みなのに status が pending の
-- まま」になる。
--
-- 直し方: 案件（target_type, target_id）単位のトランザクション advisory lock を
-- 挿入トリガーの先頭で取る。同じ案件への挿入は直列化され、後から来た側は
-- 先の COMMIT まで待ってから「前のハッシュ」と件数を読む。別案件は待たない。
-- =============================================================================

CREATE OR REPLACE FUNCTION public.app_approvals_chain()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_prev    TEXT;
  v_prev_at TIMESTAMPTZ;
BEGIN
  -- 案件ごとに直列化する。2つのキーに割るのは、target_id(uuid) 全体を
  -- 1つの bigint に潰すより衝突が起きにくいから（片方は type、片方は id）。
  PERFORM pg_advisory_xact_lock(
    hashtext(NEW.target_type), hashtext(NEW.target_id::text));

  SELECT row_hash, created_at INTO v_prev, v_prev_at
    FROM public.approvals
   WHERE target_type = NEW.target_type
     AND target_id   = NEW.target_id
   ORDER BY created_at DESC, id DESC
   LIMIT 1;

  -- created_at はトランザクションの開始時刻。鍵を待つあいだに、あとから
  -- 始まった側が先に書くと、鎖の順と時刻の順が逆になる。検証は時刻の順に
  -- たどるので、そのままだと正しい記録を「改ざん」と判定してしまう。
  -- 直前の記録より、必ずあとに置く。
  IF v_prev_at IS NOT NULL AND NEW.created_at <= v_prev_at THEN
    NEW.created_at := v_prev_at + interval '1 microsecond';
  END IF;

  NEW.prev_hash := v_prev;
  NEW.row_hash  := public.app_approval_hash(
    v_prev, NEW.target_type, NEW.target_id, NEW.approver_id,
    NEW.approver_name, NEW.decision, NEW.comment, NEW.created_at
  );
  RETURN NEW;
END;
$$;
