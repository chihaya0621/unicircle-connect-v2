-- =============================================================================
-- 0037: 施設の予約を「施設使用許可願」の様式に合わせる
-- =============================================================================
-- 紙の施設使用許可願にある項目のうち、次を予約に足す。
--   ・利用人員（学生・教職員・その他）と、そのうち学外者の人数
--   ・使用用具・器具等、備考
--   ・1枚の願いで複数の日時を出す（同じ願いの日時を request_id でまとめる）
--
-- 学生番号・所属・学年・氏名・連絡先は、ログインしたアカウントから分かるので
-- 持たない。受付欄は、職員の承認と記録（0027・0028）が受け持つ。
-- 電気錠の設定は特定の建物だけの手続きなので扱わない。
--
-- 備品の貸し出しは様式が別なので、これまでどおり create_reservation を使う。
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. 予約に項目を足す
-- -----------------------------------------------------------------------------
-- どれも任意の列にする。これまでの予約と、備品の貸し出しには値が無い。

ALTER TABLE facility_reservations
  ADD COLUMN IF NOT EXISTS request_id     UUID,
  ADD COLUMN IF NOT EXISTS student_count  INT,
  ADD COLUMN IF NOT EXISTS staff_count    INT,
  ADD COLUMN IF NOT EXISTS other_count    INT,
  ADD COLUMN IF NOT EXISTS outside_count  INT,
  ADD COLUMN IF NOT EXISTS equipment_note TEXT,
  ADD COLUMN IF NOT EXISTS remarks        TEXT;

-- 学外者は利用人員の内数（「上記のうち学外者」）
ALTER TABLE facility_reservations DROP CONSTRAINT IF EXISTS reservations_people_check;
ALTER TABLE facility_reservations ADD CONSTRAINT reservations_people_check CHECK (
  (student_count IS NULL OR student_count BETWEEN 0 AND 9999)
  AND (staff_count IS NULL OR staff_count BETWEEN 0 AND 9999)
  AND (other_count IS NULL OR other_count BETWEEN 0 AND 9999)
  AND (outside_count IS NULL OR (
        outside_count >= 0
        AND outside_count <= coalesce(student_count, 0) + coalesce(staff_count, 0)
                             + coalesce(other_count, 0)))
);

ALTER TABLE facility_reservations DROP CONSTRAINT IF EXISTS reservations_notes_check;
ALTER TABLE facility_reservations ADD CONSTRAINT reservations_notes_check CHECK (
  (equipment_note IS NULL OR char_length(equipment_note) <= 200)
  AND (remarks IS NULL OR char_length(remarks) <= 500)
);

CREATE INDEX IF NOT EXISTS idx_reservations_request
  ON facility_reservations (request_id) WHERE request_id IS NOT NULL;


-- -----------------------------------------------------------------------------
-- 2. 申請の通知を、願い1枚につき1回にする
-- -----------------------------------------------------------------------------
-- 予約は1行ずつ作られ、行ごとに職員へ通知が飛ぶ。複数の日時をまとめて
-- 出すと日数分の通知が届くので、まとめて出すあいだ（app.reservation_batch）は
-- 行ごとの通知を止め、request_facility_use が最後に1回だけ送る。
-- 承認・却下の通知はこれまでどおり行ごとに送る。

CREATE OR REPLACE FUNCTION public.notify_reservation_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_facility TEXT;
  v_univ     UUID;
  target     UUID;
BEGIN
  SELECT name, university_id INTO v_facility, v_univ
  FROM public.facilities WHERE id = NEW.facility_id;

  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    IF current_setting('app.reservation_batch', true) = 'on' THEN
      RETURN NULL;
    END IF;
    FOR target IN
      SELECT sp.user_id FROM public.staff_profiles sp
      JOIN public.users u ON u.id = sp.user_id
      WHERE sp.university_id = v_univ AND u.role = 'staff'
    LOOP
      PERFORM public.app_notify(
        target, 'request_received',
        '施設の予約申請が届きました',
        coalesce(v_facility, '施設'), '/reservations'
      );
    END LOOP;

  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status <> 'pending' THEN
    -- 予約主体の排他的関連に合わせて宛先を決める
    IF NEW.booked_by_user_id IS NOT NULL THEN
      PERFORM public.app_notify(
        NEW.booked_by_user_id, 'approval_result',
        coalesce(v_facility, '施設') || ' の予約が' ||
          CASE WHEN NEW.status = 'approved' THEN '承認されました' ELSE '見送られました' END,
        NULL, '/reservations'
      );
    ELSE
      FOR target IN
        SELECT user_id FROM public.circle_members
        WHERE circle_id = NEW.group_circle_id AND status = 'active'
      LOOP
        PERFORM public.app_notify(
          target, 'approval_result',
          coalesce(v_facility, '施設') || ' の予約が' ||
            CASE WHEN NEW.status = 'approved' THEN '承認されました' ELSE '見送られました' END,
          NULL, '/reservations'
        );
      END LOOP;
    END IF;
  END IF;

  RETURN NULL;
END;
$$;


-- -----------------------------------------------------------------------------
-- 3. 使用許可願を出す
-- -----------------------------------------------------------------------------
-- p_slots は [{"start": "…", "end": "…"}, …]（日本時間の日時を ISO で）。
-- 日時ごとの確認（学生か、所属大学の施設か、時間帯の重なり、過去の日時）は
-- create_reservation に任せる。1つでも通らなければ、願い全体を取り下げる
-- （一部の日だけ出せた状態にしない）。どの日時で止まったかを文に添える。

CREATE OR REPLACE FUNCTION public.request_facility_use(
  p_facility_id    UUID,
  p_slots          JSONB,
  p_purpose        TEXT,
  p_circle_id      UUID DEFAULT NULL,
  p_student_count  INT  DEFAULT 0,
  p_staff_count    INT  DEFAULT 0,
  p_other_count    INT  DEFAULT 0,
  p_outside_count  INT  DEFAULT 0,
  p_equipment_note TEXT DEFAULT NULL,
  p_remarks        TEXT DEFAULT NULL
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
           remarks        = nullif(btrim(coalesce(p_remarks, '')), '')
     WHERE id = v_id;
    v_count := v_count + 1;
  END LOOP;

  PERFORM set_config('app.reservation_batch', 'off', true);

  SELECT name, university_id INTO v_facility, v_univ
  FROM public.facilities WHERE id = p_facility_id;

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
  UUID, JSONB, TEXT, UUID, INT, INT, INT, INT, TEXT, TEXT) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.request_facility_use(
  UUID, JSONB, TEXT, UUID, INT, INT, INT, INT, TEXT, TEXT) TO authenticated;


-- -----------------------------------------------------------------------------
-- 確認
-- -----------------------------------------------------------------------------

SELECT
  (SELECT count(*) FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'facility_reservations'
      AND column_name IN ('request_id', 'student_count', 'staff_count', 'other_count',
                          'outside_count', 'equipment_note', 'remarks')) AS 足した列（7なら正しい）,
  to_regprocedure(
    'public.request_facility_use(uuid,jsonb,text,uuid,integer,integer,integer,integer,text,text)'
  ) IS NOT NULL AS 申請の関数がある;
