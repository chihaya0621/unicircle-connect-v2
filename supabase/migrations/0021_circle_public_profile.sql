-- =============================================================================
-- サークルの公開プロフィール
-- =============================================================================
-- 一般ユーザー（高校生・企業）に「どんなサークルなのか」を伝えたい。
--
-- これまで一般ユーザーに見えるのは scope='public'（インカレ）だけだった。
-- しかし scope は「誰が参加できるか」の軸であって、「外部に紹介してよいか」
-- とは別の話。自大学のみの募集でも、活動内容は知ってもらいたい。
-- そこで掲載可否を独立した列として持たせる。
--
-- 既定は掲載する（TRUE）。大学のサークルは名前と活動内容を知ってもらう
-- ことに意味があるため。名簿・掲示板・活動記録はこれまでどおり
-- メンバー以外には見えない。掲載したくないサークルは管理者が下ろせる。
-- =============================================================================

ALTER TABLE circles
  ADD COLUMN IF NOT EXISTS public_listed   BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS public_intro    TEXT,
  ADD COLUMN IF NOT EXISTS public_schedule TEXT,
  ADD COLUMN IF NOT EXISTS public_contact  TEXT;

COMMENT ON COLUMN circles.public_listed IS
  '一般ユーザー・未ログインの一覧に載せるか。scope（参加できる範囲）とは別の軸。';
COMMENT ON COLUMN circles.public_intro IS    '公開用の活動紹介';
COMMENT ON COLUMN circles.public_schedule IS '公開用の活動日・場所';
COMMENT ON COLUMN circles.public_contact IS  '公開用の連絡先・SNS';


-- -----------------------------------------------------------------------------
-- 可視範囲を scope から public_listed に付け替える
-- -----------------------------------------------------------------------------
-- 0019 では scope='public' を条件にしていたが、上記のとおり軸が違う。
-- インカレでも掲載を下ろしたサークルは載せない。管理者の判断を優先する。

DROP POLICY IF EXISTS circles_select ON circles;

CREATE POLICY circles_select ON circles
  FOR SELECT USING (
    public.app_is_circle_member(id)
    OR public.app_is_staff_of(university_id)
    OR (
      status = 'approved'
      AND (
        public.app_role() IN ('student', 'staff')
        OR public_listed
      )
    )
  );

COMMENT ON POLICY circles_select ON circles IS
  '学生・職員は承認済みを全て。一般と未ログインは public_listed のものだけ。'
  'メンバーと主管大学の職員は承認前でも読める。';


-- -----------------------------------------------------------------------------
-- 編集口
-- -----------------------------------------------------------------------------

/**
 * 公開プロフィールの更新。サークル管理者のみ。
 *
 * circles には UPDATE ポリシーが無いので、書き込めるのはこの関数だけ。
 * 更新する列も4つに限っているため、名前や scope、承認状態が
 * この経路から書き換わることはない。
 */
CREATE OR REPLACE FUNCTION public.update_circle_public_profile(
  p_circle_id UUID,
  p_listed    BOOLEAN,
  p_intro     TEXT DEFAULT NULL,
  p_schedule  TEXT DEFAULT NULL,
  p_contact   TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'ログインが必要です';
  END IF;

  IF NOT public.app_is_circle_admin(p_circle_id) THEN
    RAISE EXCEPTION 'このサークルの管理者のみ編集できます';
  END IF;

  IF char_length(coalesce(p_intro, '')) > 1000 THEN
    RAISE EXCEPTION '活動紹介は1000文字までです';
  END IF;
  IF char_length(coalesce(p_schedule, '')) > 200 THEN
    RAISE EXCEPTION '活動日・場所は200文字までです';
  END IF;
  IF char_length(coalesce(p_contact, '')) > 200 THEN
    RAISE EXCEPTION '連絡先は200文字までです';
  END IF;

  UPDATE circles
     SET public_listed   = coalesce(p_listed, TRUE),
         -- 空欄は NULL に寄せる。空文字と未入力を画面側で区別したくない
         public_intro    = nullif(btrim(coalesce(p_intro, '')), ''),
         public_schedule = nullif(btrim(coalesce(p_schedule, '')), ''),
         public_contact  = nullif(btrim(coalesce(p_contact, '')), '')
   WHERE id = p_circle_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_circle_public_profile(UUID, BOOLEAN, TEXT, TEXT, TEXT)
  FROM public, anon;
GRANT EXECUTE ON FUNCTION public.update_circle_public_profile(UUID, BOOLEAN, TEXT, TEXT, TEXT)
  TO authenticated;
