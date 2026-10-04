-- =============================================================================
-- 0038: 施設使用許可願の項目を、大学ごとに職員が調整できるようにする
-- =============================================================================
-- 使用許可願（0037）の基本の項目はどの大学でも共通にし、大学ごとに違う
-- 部分だけを職員が変えられるようにする。
--   ・注意事項（1行ずつ）
--   ・学外者がいるときに求める確認の文（空にすると求めない）
--   ・追加の項目（選択式・確認のチェック・自由記述）。対象の施設を絞れる
--     例: 講義棟の部屋だけに「電気錠設定（不要・必要）」を出す
--
-- 様式は universities.facility_use_form に1つの JSON で持つ。null のときは
-- アプリの既定（清掃と火気の注意、禁煙の確認、追加の項目なし）を使う。
-- 答えは、出したときの項目名と一緒に予約の answers へ写し取る。あとで
-- 職員が項目を変えても、出された願いの中身は変わらない。
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. 列を足す
-- -----------------------------------------------------------------------------

ALTER TABLE universities
  ADD COLUMN IF NOT EXISTS facility_use_form JSONB;

-- [{"label": "電気錠設定", "answer": "必要"}, …]
ALTER TABLE facility_reservations
  ADD COLUMN IF NOT EXISTS answers JSONB;


-- -----------------------------------------------------------------------------
-- 2. 様式を変える（その大学の職員のみ）
-- -----------------------------------------------------------------------------
-- p_form が null なら既定に戻す。項目は形を確かめてから、知らないキーを
-- 落として組み直して保存する。

CREATE OR REPLACE FUNCTION public.update_facility_use_form(p_form JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_university UUID := public.app_university_id();
  v_notes      JSONB;
  v_questions  JSONB;
  v_clean      JSONB := '[]'::jsonb;
  q            JSONB;
  v_kind       TEXT;
BEGIN
  IF public.app_role() IS DISTINCT FROM 'staff' OR v_university IS NULL THEN
    RAISE EXCEPTION '変えられるのは大学職員のみです';
  END IF;

  IF p_form IS NULL THEN
    UPDATE public.universities SET facility_use_form = NULL WHERE id = v_university;
    RETURN;
  END IF;
  IF jsonb_typeof(p_form) <> 'object' THEN
    RAISE EXCEPTION '様式の形が正しくありません';
  END IF;

  -- 注意事項
  v_notes := coalesce(p_form -> 'notes', '[]'::jsonb);
  IF jsonb_typeof(v_notes) <> 'array' OR jsonb_array_length(v_notes) > 10 THEN
    RAISE EXCEPTION '注意事項は10行までです';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_notes) n
     WHERE jsonb_typeof(n) <> 'string'
        OR char_length(btrim(n #>> '{}')) NOT BETWEEN 1 AND 200
  ) THEN
    RAISE EXCEPTION '注意事項は1行200文字までです';
  END IF;

  -- 学外者がいるときの確認
  IF char_length(coalesce(p_form ->> 'outside_rule', '')) > 200 THEN
    RAISE EXCEPTION '学外者についての確認は200文字までです';
  END IF;

  -- 追加の項目
  v_questions := coalesce(p_form -> 'questions', '[]'::jsonb);
  IF jsonb_typeof(v_questions) <> 'array' OR jsonb_array_length(v_questions) > 10 THEN
    RAISE EXCEPTION '追加の項目は10個までです';
  END IF;

  FOR q IN SELECT value FROM jsonb_array_elements(v_questions) LOOP
    v_kind := q ->> 'kind';
    IF coalesce(q ->> 'id', '') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      RAISE EXCEPTION '項目の識別子が正しくありません';
    END IF;
    IF char_length(btrim(coalesce(q ->> 'label', ''))) NOT BETWEEN 1 AND 40 THEN
      RAISE EXCEPTION '項目の名前は1〜40文字で入力してください';
    END IF;
    IF v_kind IS NULL OR v_kind NOT IN ('choice', 'check', 'text') THEN
      RAISE EXCEPTION '項目の種類が正しくありません';
    END IF;
    IF v_kind = 'choice' AND (
         jsonb_typeof(q -> 'options') IS DISTINCT FROM 'array'
         OR jsonb_array_length(q -> 'options') NOT BETWEEN 2 AND 6
         OR EXISTS (SELECT 1 FROM jsonb_array_elements(q -> 'options') o
                     WHERE jsonb_typeof(o) <> 'string'
                        OR char_length(btrim(o #>> '{}')) NOT BETWEEN 1 AND 20)
       ) THEN
      RAISE EXCEPTION '「%」の選択肢は2〜6個、それぞれ20文字までで入力してください', q ->> 'label';
    END IF;
    IF char_length(coalesce(q ->> 'hint', '')) > 200 THEN
      RAISE EXCEPTION '「%」の補足は200文字までです', q ->> 'label';
    END IF;
    IF jsonb_typeof(coalesce(q -> 'facility_ids', '[]'::jsonb)) <> 'array' THEN
      RAISE EXCEPTION '対象の施設の形が正しくありません';
    END IF;
    -- 対象にできるのは、自分の大学の施設だけ
    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(coalesce(q -> 'facility_ids', '[]'::jsonb)) f
       WHERE NOT EXISTS (
         SELECT 1 FROM public.facilities
          WHERE id::text = f AND university_id = v_university)
    ) THEN
      RAISE EXCEPTION '「%」の対象に、ほかの大学の施設は選べません', q ->> 'label';
    END IF;

    v_clean := v_clean || jsonb_build_array(jsonb_build_object(
      'id',           q ->> 'id',
      'label',        btrim(q ->> 'label'),
      'kind',         v_kind,
      'options',      CASE WHEN v_kind = 'choice'
                           THEN (SELECT jsonb_agg(btrim(o)) FROM jsonb_array_elements_text(q -> 'options') o)
                           ELSE '[]'::jsonb END,
      'hint',         btrim(coalesce(q ->> 'hint', '')),
      'required',     coalesce((q ->> 'required')::boolean, false),
      'facility_ids', coalesce(q -> 'facility_ids', '[]'::jsonb)
    ));
  END LOOP;

  IF (SELECT count(DISTINCT value ->> 'id') FROM jsonb_array_elements(v_clean))
     <> jsonb_array_length(v_clean) THEN
    RAISE EXCEPTION '項目の識別子が重なっています';
  END IF;

  UPDATE public.universities
     SET facility_use_form = jsonb_build_object(
           'notes',        (SELECT coalesce(jsonb_agg(btrim(n)), '[]'::jsonb)
                              FROM jsonb_array_elements_text(v_notes) n),
           'outside_rule', btrim(coalesce(p_form ->> 'outside_rule', '')),
           'questions',    v_clean)
   WHERE id = v_university;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_facility_use_form(JSONB) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.update_facility_use_form(JSONB) TO authenticated;


-- -----------------------------------------------------------------------------
-- 3. 使用許可願に、追加の項目への答えを足す
-- -----------------------------------------------------------------------------
-- 引数を足すので、0037 の関数を作り直す。p_answers は {項目の id: 答え}。
-- その施設が対象の項目だけを見て、必須の答え漏れと、選択肢に無い答えを断る。
-- 確認のチェックは、付いていれば「はい」、付いていなければ「いいえ」と残す。

DROP FUNCTION IF EXISTS public.request_facility_use(
  UUID, JSONB, TEXT, UUID, INT, INT, INT, INT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.request_facility_use(
  p_facility_id    UUID,
  p_slots          JSONB,
  p_purpose        TEXT,
  p_circle_id      UUID  DEFAULT NULL,
  p_student_count  INT   DEFAULT 0,
  p_staff_count    INT   DEFAULT 0,
  p_other_count    INT   DEFAULT 0,
  p_outside_count  INT   DEFAULT 0,
  p_equipment_note TEXT  DEFAULT NULL,
  p_remarks        TEXT  DEFAULT NULL,
  p_answers        JSONB DEFAULT NULL
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_request  UUID := gen_random_uuid();
  v_slot     JSONB;
  v_start    TIMESTAMPTZ;
  v_end      TIMESTAMPTZ;
  v_id       UUID;
  v_count    INT := 0;
  v_total    INT;
  v_facility TEXT;
  v_univ     UUID;
  v_answers  JSONB := '[]'::jsonb;
  v_answer   TEXT;
  q          JSONB;
  target     UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'ログインが必要です';
  END IF;
  IF p_slots IS NULL OR jsonb_typeof(p_slots) <> 'array'
     OR jsonb_array_length(p_slots) = 0 THEN
    RAISE EXCEPTION '日時を1つ以上入力してください';
  END IF;
  IF jsonb_array_length(p_slots) > 16 THEN
    RAISE EXCEPTION '日時は1回の申請で16件までです';
  END IF;
  IF nullif(btrim(coalesce(p_purpose, '')), '') IS NULL THEN
    RAISE EXCEPTION '目的を入力してください';
  END IF;
  IF char_length(p_purpose) > 200 THEN
    RAISE EXCEPTION '目的は200文字以内で入力してください';
  END IF;
  IF coalesce(p_student_count, 0) < 0 OR coalesce(p_staff_count, 0) < 0
     OR coalesce(p_other_count, 0) < 0 OR coalesce(p_outside_count, 0) < 0 THEN
    RAISE EXCEPTION '人数は0以上で入力してください';
  END IF;
  v_total := coalesce(p_student_count, 0) + coalesce(p_staff_count, 0)
           + coalesce(p_other_count, 0);
  IF v_total < 1 THEN
    RAISE EXCEPTION '利用人員を入力してください';
  END IF;
  IF coalesce(p_outside_count, 0) > v_total THEN
    RAISE EXCEPTION '学外者の人数は、利用人員の合計以下にしてください';
  END IF;

  SELECT name, university_id INTO v_facility, v_univ
  FROM public.facilities WHERE id = p_facility_id;

  -- 大学が足した項目への答え
  FOR q IN
    SELECT value FROM jsonb_array_elements(coalesce(
      (SELECT facility_use_form -> 'questions' FROM public.universities WHERE id = v_univ),
      '[]'::jsonb))
  LOOP
    -- 対象の施設が決まっている項目は、その施設のときだけ尋ねる
    IF jsonb_array_length(coalesce(q -> 'facility_ids', '[]'::jsonb)) > 0
       AND NOT (q -> 'facility_ids') ? p_facility_id::text THEN
      CONTINUE;
    END IF;

    v_answer := nullif(btrim(coalesce(p_answers ->> (q ->> 'id'), '')), '');
    IF q ->> 'kind' = 'check' THEN
      IF v_answer IS DISTINCT FROM 'yes' AND coalesce((q ->> 'required')::boolean, false) THEN
        RAISE EXCEPTION '「%」を確かめてください', q ->> 'label';
      END IF;
      v_answer := CASE WHEN v_answer = 'yes' THEN 'はい' ELSE 'いいえ' END;
    ELSIF v_answer IS NULL THEN
      IF coalesce((q ->> 'required')::boolean, false) THEN
        RAISE EXCEPTION '「%」に答えてください', q ->> 'label';
      END IF;
      CONTINUE;
    ELSIF q ->> 'kind' = 'choice' AND NOT (q -> 'options') ? v_answer THEN
      RAISE EXCEPTION '「%」の答えが選択肢にありません', q ->> 'label';
    ELSIF char_length(v_answer) > 200 THEN
      RAISE EXCEPTION '「%」の答えは200文字以内で入力してください', q ->> 'label';
    END IF;

    v_answers := v_answers || jsonb_build_array(
      jsonb_build_object('label', q ->> 'label', 'answer', v_answer));
  END LOOP;

  -- 行ごとの通知を止める（このトランザクションの中だけ）
  PERFORM set_config('app.reservation_batch', 'on', true);

  FOR v_slot IN SELECT value FROM jsonb_array_elements(p_slots) LOOP
    BEGIN
      v_start := (v_slot ->> 'start')::timestamptz;
      v_end   := (v_slot ->> 'end')::timestamptz;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION '日時の形式が正しくありません';
    END;

    BEGIN
      v_id := public.create_reservation(
        p_facility_id, v_start, v_end, p_purpose, p_circle_id);
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION '%（%）', SQLERRM,
        to_char(v_start AT TIME ZONE 'Asia/Tokyo', 'FMMM月FMDD日 HH24:MI');
    END;

    UPDATE public.facility_reservations
       SET request_id     = v_request,
           student_count  = coalesce(p_student_count, 0),
           staff_count    = coalesce(p_staff_count, 0),
           other_count    = coalesce(p_other_count, 0),
           outside_count  = coalesce(p_outside_count, 0),
           equipment_note = nullif(btrim(coalesce(p_equipment_note, '')), ''),
           remarks        = nullif(btrim(coalesce(p_remarks, '')), ''),
           answers        = nullif(v_answers, '[]'::jsonb)
     WHERE id = v_id;
    v_count := v_count + 1;
  END LOOP;

  PERFORM set_config('app.reservation_batch', 'off', true);

  FOR target IN
    SELECT sp.user_id FROM public.staff_profiles sp
    JOIN public.users u ON u.id = sp.user_id
    WHERE sp.university_id = v_univ AND u.role = 'staff'
  LOOP
    PERFORM public.app_notify(
      target, 'request_received',
      '施設の使用許可願が届きました',
      coalesce(v_facility, '施設')
        || CASE WHEN v_count > 1 THEN '（' || v_count || '日分）' ELSE '' END,
      '/reservations'
    );
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.request_facility_use(
  UUID, JSONB, TEXT, UUID, INT, INT, INT, INT, TEXT, TEXT, JSONB) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.request_facility_use(
  UUID, JSONB, TEXT, UUID, INT, INT, INT, INT, TEXT, TEXT, JSONB) TO authenticated;


-- -----------------------------------------------------------------------------
-- 確認
-- -----------------------------------------------------------------------------

SELECT
  (SELECT count(*) FROM information_schema.columns
    WHERE table_schema = 'public'
      AND ((table_name = 'universities' AND column_name = 'facility_use_form')
        OR (table_name = 'facility_reservations' AND column_name = 'answers'))) AS 足した列（2なら正しい）,
  to_regprocedure('public.update_facility_use_form(jsonb)') IS NOT NULL AS 様式を変える関数がある,
  to_regprocedure(
    'public.request_facility_use(uuid,jsonb,text,uuid,integer,integer,integer,integer,text,text,jsonb)'
  ) IS NOT NULL AS 申請の関数が新しい;
