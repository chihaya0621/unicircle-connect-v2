-- =============================================================================
-- 公開情報の閲覧（一般ユーザー向け）
-- =============================================================================
-- 高校生や企業の人が、志望校・取引先の大学で何が起きているかを
-- 見に来られるようにする。見せるのは公開設定のものだけ。
--
-- 追加するのは2つ。
--   watched_universities … 気にしている大学。一覧の既定の絞り込みに使う
--   circle_favorites     … 気になるサークル
--
-- どちらも「自分の行だけ読める」。書き込みポリシーは作らず、
-- SECURITY DEFINER の関数だけを書き込み口にする方針は既存と揃える。
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. サークルの可視範囲を scope に従わせる
-- -----------------------------------------------------------------------------
-- これまでは status='approved' でありさえすれば誰でも読めた。
-- サークル画面を学生・職員に限定していたので表には出ていなかったが、
-- 一般ユーザーに開くとそのまま非公開サークルまで見えてしまう。
--
-- 学生・職員の見え方は変えない。合同・インカレを探す動きを
-- 妨げたくないので、これまでどおり承認済みなら全部見える。
-- 変わるのは一般ユーザーと未ログインで、公開サークルだけになる。

DROP POLICY IF EXISTS circles_select ON circles;

CREATE POLICY circles_select ON circles
  FOR SELECT USING (
    public.app_is_circle_member(id)
    OR public.app_is_staff_of(university_id)
    OR (
      status = 'approved'
      AND (
        public.app_role() IN ('student', 'staff')
        OR scope = 'public'
      )
    )
  );

COMMENT ON POLICY circles_select ON circles IS
  '学生・職員は承認済みを全て。一般と未ログインは scope=public のみ。'
  'メンバーと主管大学の職員は承認前でも読める。';


-- -----------------------------------------------------------------------------
-- 2. 気にしている大学
-- -----------------------------------------------------------------------------
-- 一般ユーザーは所属大学を持たないので、何を既定で見せるかの手がかりがない。
-- 本人に選んでもらい、それを一覧の既定の絞り込みに使う。
-- 学生・職員が他大学を追いかける用途にも使えるよう、ロールは問わない。

CREATE TABLE IF NOT EXISTS watched_universities (
  user_id       UUID NOT NULL REFERENCES users(id)        ON DELETE CASCADE,
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, university_id)
);

COMMENT ON TABLE watched_universities IS
  '閲覧者が指定した、気にしている大学。表示の既定値にのみ使い、認可には使わない。';

ALTER TABLE watched_universities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS watched_universities_select ON watched_universities;
CREATE POLICY watched_universities_select ON watched_universities
  FOR SELECT TO authenticated USING (user_id = auth.uid());


-- -----------------------------------------------------------------------------
-- 3. 気になるサークル
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS circle_favorites (
  user_id    UUID NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  circle_id  UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, circle_id)
);

CREATE INDEX IF NOT EXISTS idx_circle_favorites_circle
  ON circle_favorites(circle_id);

COMMENT ON TABLE circle_favorites IS
  '閲覧者が気になったサークル。誰が入れたかは本人以外に見せない。';

ALTER TABLE circle_favorites ENABLE ROW LEVEL SECURITY;

-- 誰が何を気にしているかは行動履歴なので、他人からは読めない。
-- サークル側から「何人が気にしているか」も出さない。
-- 少人数のサークルでは人数の増減から個人が割れるため。
DROP POLICY IF EXISTS circle_favorites_select ON circle_favorites;
CREATE POLICY circle_favorites_select ON circle_favorites
  FOR SELECT TO authenticated USING (user_id = auth.uid());


-- -----------------------------------------------------------------------------
-- 4. 書き込み口
-- -----------------------------------------------------------------------------

/**
 * 気にしている大学を置き換える。
 *
 * 差分ではなく総入れ替えにしているのは、画面が「チェックした集合」を
 * そのまま送る形になるため。途中で失敗して片側だけ反映されることがない。
 */
CREATE OR REPLACE FUNCTION public.set_watched_universities(
  p_university_ids UUID[]
)
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count INT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'ログインが必要です';
  END IF;

  IF coalesce(array_length(p_university_ids, 1), 0) > 20 THEN
    RAISE EXCEPTION '指定できる大学は20校までです';
  END IF;

  DELETE FROM watched_universities WHERE user_id = auth.uid();

  -- universities と突き合わせるので、存在しない ID は黙って落ちる
  INSERT INTO watched_universities (user_id, university_id)
  SELECT auth.uid(), u.id
    FROM universities u
   WHERE u.id = ANY(p_university_ids);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

/**
 * 気になるサークルの登録・解除。
 *
 * 戻り値は登録後の状態（true=気になる）。
 *
 * SECURITY DEFINER なので RLS を通らない。見えないサークルを
 * 登録できてしまうと、ID を総当たりすることで非公開サークルの
 * 存在を確かめられるので、可視かどうかをここで自分で確認する。
 */
CREATE OR REPLACE FUNCTION public.toggle_circle_favorite(
  p_circle_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_removed INT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'ログインが必要です';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM circles c
     WHERE c.id = p_circle_id
       AND c.status = 'approved'
       AND (
         public.app_role() IN ('student', 'staff')
         OR c.scope = 'public'
       )
  ) THEN
    RAISE EXCEPTION 'このサークルは参照できません';
  END IF;

  DELETE FROM circle_favorites
   WHERE user_id = auth.uid() AND circle_id = p_circle_id;
  GET DIAGNOSTICS v_removed = ROW_COUNT;

  IF v_removed > 0 THEN
    RETURN FALSE;
  END IF;

  INSERT INTO circle_favorites (user_id, circle_id)
  VALUES (auth.uid(), p_circle_id);

  RETURN TRUE;
END;
$$;


-- -----------------------------------------------------------------------------
-- 5. 権限
-- -----------------------------------------------------------------------------

-- Supabase は public スキーマの新規テーブルを既定で anon にも GRANT する。
-- ポリシーを TO authenticated にしてあるので anon は1行も読めないが、
-- 権限の側でも閉じておく。
REVOKE ALL ON watched_universities FROM anon;
REVOKE ALL ON circle_favorites     FROM anon;

GRANT SELECT ON watched_universities TO authenticated;
GRANT SELECT ON circle_favorites     TO authenticated;

REVOKE EXECUTE ON FUNCTION public.set_watched_universities(UUID[]) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.toggle_circle_favorite(UUID)     FROM public, anon;

GRANT EXECUTE ON FUNCTION public.set_watched_universities(UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_circle_favorite(UUID)     TO authenticated;
