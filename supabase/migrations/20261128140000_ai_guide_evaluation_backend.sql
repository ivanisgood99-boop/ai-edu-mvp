-- Server-owned guide-answer rubrics and trusted AI evaluation persistence.
-- This migration is staged only. It must be applied after the idempotent answer
-- submission migration and the active-student RPC guard migration.

ALTER TABLE public.learning_answer_logs
  ADD COLUMN IF NOT EXISTS ai_evaluation jsonb;

CREATE TABLE IF NOT EXISTS private.learning_guide_rubrics (
  level_id text PRIMARY KEY REFERENCES private.learning_level_requirements(level_id) ON DELETE CASCADE,
  chapter_id text NOT NULL,
  guide_question_id text NOT NULL,
  guide_prompt text NOT NULL,
  concepts text[] NOT NULL DEFAULT ARRAY[]::text[],
  reference_definition text NOT NULL,
  reference_derivation text NOT NULL,
  conditions text NOT NULL,
  rubric_version integer NOT NULL DEFAULT 1 CHECK (rubric_version > 0),
  is_active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (level_id, guide_question_id)
);

ALTER TABLE private.learning_guide_rubrics ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.learning_guide_rubrics FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE private.learning_guide_rubrics TO service_role;

INSERT INTO private.learning_guide_rubrics
  (level_id, chapter_id, guide_question_id, guide_prompt, concepts,
   reference_definition, reference_derivation, conditions, rubric_version, is_active)
VALUES
('CH1-L1', 'CH-1', 'CH1-L1-G', '請用自己的話說明：為什麼 (-2)^3 與 (-2)^4 的正負號不同？', ARRAY['正整數次方連乘定義', '負數奇偶次方正負號與括號']::text[], '當 n 為正整數、a 為實數時，a^n 表示 a 連續相乘 n 次。', '由乘法結合律，n 個 a 相乘記為 a^n；當 a < 0 時，偶數個負數相乘為正，奇數個負數相乘為負。', '次方指數 n 為正整數（n = 1, 2, 3, ...）。', 1, true),
('CH1-L2', 'CH-1', 'CH1-L2-G', '請說明：為什麼非零數的 0 次方會規定為 1 而不是 0？並說明底數有什麼限制。', ARRAY['零次方規定 a^0 = 1（a ≠ 0）', '底數不可為 0 的限制']::text[], '當實數 a ≠ 0 時，規定 a^0 = 1。', '對於 a ≠ 0 與正整數 n，a^n / a^n = 1，若依指數相減規則 a^(n - n) = a^0，故規定 a^0 = 1。', '底數必須不為 0（a ≠ 0）。', 1, true),
('CH2-L1', 'CH-2', 'CH2-L1-G', '請說明：為什麼兩點距離公式中把 x 坐標差與 y 坐標差平方後，結果不會是負數？', ARRAY['水平與鉛直坐標差', '平面兩點距離公式']::text[], '平面上兩點 A(x_1, y_1)、B(x_2, y_2) 的距離為 AB = sqrt((x_2 - x_1)^2 + (y_2 - y_1)^2)。', '水平差為 |x_2 - x_1|、鉛直差為 |y_2 - y_1|，兩股互相垂直，依畢氏定理開根號即得距離公式。', '適用於平面直角坐標系中任意兩實數坐標點。', 1, true),
('CH2-L2', 'CH-2', 'CH2-L2-G', '請依序說明：為什麼鉛直線沒有斜率？（請提到變化量比值、代入例子、除以零沒有定義與分母為零）', ARRAY['斜率定義與兩點公式', '鉛直線因分母為 0 故無斜率']::text[], '相異兩點 A(x_1, y_1)、B(x_2, y_2)（x_1 ≠ x_2）的連線斜率為 m = (y_2 - y_1)/(x_2 - x_1)。', '第一步：斜率代表鉛直變化量 (y_2 - y_1) 與水平變化量 (x_2 - x_1) 的比值。
第二步：公式為 m = (y_2 - y_1)/(x_2 - x_1)。
第三步：鉛直線取 A(2, 1)、B(2, 5)。
第四步：代入得 (5 - 1)/(2 - 2) = 4/0。
第五步：數學上除以零沒有定義。
第六步：一般鉛直線任意兩點 x 坐標相同，分母必為 0，故斜率不存在。', 'x_1 ≠ x_2 時斜率存在；水平線斜率為 0；鉛直線斜率不存在。', 1, true),
('CH2-L3', 'CH-2', 'CH2-L3-G', '請說明：如何判斷一個已知點 (a, b) 是否在某條直線方程式上？', ARRAY['點斜式與直線關係', '點坐標代入檢驗']::text[], '過點 (x_0, y_0) 且斜率為 m 的直線，點斜式為 y - y_0 = m(x - x_0)。', '由 (y - y_0)/(x - x_0) = m 兩邊同乘 (x - x_0) 得 y - y_0 = m(x - x_0)。', '點斜式適用於斜率 m 存在的直線；鉛直線另寫為 x = x_0。', 1, true),
('CH2-L4', 'CH-2', 'CH2-L4-G', '請說明：為什麼圓的標準式右邊是 r^2 且 r 必須大於 0？', ARRAY['圓心與半徑幾何意義', '圓的標準式 (x - h)^2 + (y - k)^2 = r^2']::text[], '圓心 (h, k)、半徑 r（r > 0）的圓標準式為 (x - h)^2 + (y - k)^2 = r^2。', '由兩點距離公式 sqrt((x - h)^2 + (y - k)^2) = r 兩邊平方即得 (x - h)^2 + (y - k)^2 = r^2。', 'r > 0；右邊常數為 r^2 而非 r。', 1, true),
('CH2-L5', 'CH-2', 'CH2-L5-G', '請說明：當圓心到直線的距離 d 大於半徑 r 時，為什麼直線與圓沒有交點？', ARRAY['圓心到直線距離 d 與半徑 r 比較', '相交、相切與不相交判準']::text[], 'd < r 相交兩點；d = r 相切一點；d > r 不相交。', '圓心到直線距離 d 為最短距離，與半徑 r 比較即可確定直線與圓的相對位置。', 'r > 0，d ≥ 0，單位一致。', 1, true),
('CH2-L6', 'CH-2', 'CH2-L6-G', '請說明：要判斷一個點在圓內、圓上或圓外，應該比較哪兩個量？', ARRAY['點與圓位置判讀', '坐標與圓綜合解題']::text[], '綜合運用平面坐標、直線與圓性質進行幾何推論與計算。', '先求關鍵幾何量（如距離或半徑），再依定義作答。', '各公式與性質須符合其適用條件。', 1, true),
('CH3-L1', 'CH-3', 'CH3-L1-G', '請說明：在多項式加減運算中，為什麼只有同次方項才能合併？', ARRAY['多項式項次與係數', '多項式代入求值']::text[], '由常數與 x 的非負整數次方透過加減乘組合而成的式子稱為 x 的多項式。', '將指定 x 值代入多項式各次方項計算後合併。', '次方須為非負整數。', 1, true),
('CH3-L2', 'CH-3', 'CH3-L2-G', '請說明：為什麼多項式 f(x) 除以 (x - a) 的餘式會等於 f(a)？', ARRAY['餘式定理 f(a)', '因式定理判別']::text[], '多項式 f(x) 除以 (x - a) 的餘式等於 f(a)；當 f(a) = 0 時，(x - a) 為 f(x) 的因式。', '由除法原理 f(x) = (x - a)q(x) + r，代入 x = a 得 r = f(a)。', '除式為一次式 x - a。', 1, true)
ON CONFLICT (level_id) DO UPDATE SET
  chapter_id = EXCLUDED.chapter_id,
  guide_question_id = EXCLUDED.guide_question_id,
  guide_prompt = EXCLUDED.guide_prompt,
  concepts = EXCLUDED.concepts,
  reference_definition = EXCLUDED.reference_definition,
  reference_derivation = EXCLUDED.reference_derivation,
  conditions = EXCLUDED.conditions,
  rubric_version = EXCLUDED.rubric_version,
  is_active = EXCLUDED.is_active,
  updated_at = now();

-- Only the authenticated Edge Function's service-role client can persist an AI
-- evaluation. Browser clients cannot mark their own guide answers as evaluated.
CREATE OR REPLACE FUNCTION public.record_learning_guide_evaluation(
  p_student_id uuid,
  p_client_submission_id uuid,
  p_level_id text,
  p_question_id text,
  p_raw_answer text,
  p_verdict text,
  p_score integer,
  p_feedback text,
  p_missing_concepts text[],
  p_next_prompt text,
  p_hint_count integer,
  p_model text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, private
AS $function$
DECLARE
  v_existing public.learning_answer_logs%ROWTYPE;
  v_rubric private.learning_guide_rubrics%ROWTYPE;
  v_attempt integer;
  v_row public.learning_answer_logs%ROWTYPE;
  v_evaluation jsonb;
BEGIN
  IF current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Forbidden: service role required';
  END IF;
  IF p_student_id IS NULL OR p_client_submission_id IS NULL THEN
    RAISE EXCEPTION 'Student and client submission IDs are required';
  END IF;
  IF p_verdict NOT IN ('pass', 'partial', 'incorrect', 'unclear')
     OR p_score < 0 OR p_score > 4
     OR ((p_verdict = 'pass') IS DISTINCT FROM (p_score >= 3)) THEN
    RAISE EXCEPTION 'Invalid guide evaluation result';
  END IF;
  IF length(COALESCE(p_raw_answer, '')) < 8 OR length(p_raw_answer) > 4000
     OR length(COALESCE(p_feedback, '')) > 500
     OR length(COALESCE(p_next_prompt, '')) > 500
     OR p_hint_count < 0 OR p_hint_count > 4 THEN
    RAISE EXCEPTION 'Guide evaluation input is outside allowed limits';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = p_student_id AND p.role = 'student' AND p.account_status = 'active'
  ) THEN
    RAISE EXCEPTION 'Forbidden: an active student account is required';
  END IF;

  SELECT * INTO v_rubric
  FROM private.learning_guide_rubrics
  WHERE level_id = p_level_id
    AND guide_question_id = p_question_id
    AND is_active = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown or inactive guide question';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_student_id::text || '|guide|' || p_client_submission_id::text, 0)
  );

  SELECT * INTO v_existing
  FROM public.learning_answer_logs
  WHERE student_id = p_student_id
    AND client_submission_id = p_client_submission_id;
  IF FOUND THEN
    IF v_existing.question_type <> 'guide'
       OR v_existing.level_id IS DISTINCT FROM p_level_id
       OR v_existing.question_id IS DISTINCT FROM p_question_id
       OR v_existing.raw_answer IS DISTINCT FROM p_raw_answer THEN
      RAISE EXCEPTION 'Client submission ID was reused with a different payload';
    END IF;
    RETURN jsonb_build_object(
      'ok', true,
      'duplicate', true,
      'client_submission_id', p_client_submission_id,
      'answer_log', to_jsonb(v_existing),
      'evaluation', COALESCE(v_existing.ai_evaluation, '{}'::jsonb)
    );
  END IF;

  SELECT COUNT(*) + 1 INTO v_attempt
  FROM public.learning_answer_logs
  WHERE student_id = p_student_id
    AND level_id = p_level_id
    AND question_id = p_question_id
    AND question_type = 'guide';

  v_evaluation := jsonb_build_object(
    'verdict', p_verdict,
    'score', p_score,
    'feedback', p_feedback,
    'missingConcepts', COALESCE(to_jsonb(p_missing_concepts), '[]'::jsonb),
    'nextPrompt', p_next_prompt,
    'model', p_model,
    'rubricVersion', v_rubric.rubric_version
  );

  INSERT INTO public.learning_answer_logs (
    student_id, chapter_id, level_id, stage_id, question_id, question_type,
    raw_answer, ai_verdict, ai_reason, ai_evaluation, hint_count,
    is_completed, attempt_no, is_first_attempt, client_submission_id
  ) VALUES (
    p_student_id, v_rubric.chapter_id, p_level_id, 'X-1', p_question_id, 'guide',
    p_raw_answer, 'submitted', p_feedback, v_evaluation, p_hint_count,
    true, v_attempt, v_attempt = 1, p_client_submission_id
  )
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'ok', true,
    'duplicate', false,
    'client_submission_id', p_client_submission_id,
    'answer_log', to_jsonb(v_row),
    'evaluation', v_evaluation
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.record_learning_guide_evaluation(uuid,uuid,text,text,text,text,integer,text,text[],text,integer,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_learning_guide_evaluation(uuid,uuid,text,text,text,text,integer,text,text[],text,integer,text)
  TO service_role;

-- Prevent browser clients from bypassing the Edge Function via the legacy RPC.
REVOKE ALL ON FUNCTION public.record_learning_answer(text,text,text,text,text,boolean,text,integer,integer,text)
  FROM PUBLIC, anon, authenticated;

-- The idempotent browser RPC handles check/practice/remedial only. Guide answers
-- must be evaluated and persisted through the server-only RPC above.
CREATE OR REPLACE FUNCTION public.record_learning_answer_idempotent(
  p_client_submission_id uuid,
  p_chapter_id text,
  p_level_id text,
  p_question_type text,
  p_question_id text,
  p_raw_answer text,
  p_is_correct boolean,
  p_concept_id text,
  p_sub_step integer,
  p_hint_count integer,
  p_ai_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, private
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_existing public.learning_answer_logs%ROWTYPE;
  v_result jsonb;
  v_stats jsonb;
  v_answer_log_id bigint;
BEGIN
  IF v_uid IS NULL OR p_client_submission_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized or missing client submission ID';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = v_uid AND p.role = 'student' AND p.account_status = 'active'
  ) THEN
    RAISE EXCEPTION 'Forbidden: an active student account is required';
  END IF;
  IF p_question_type = 'guide' THEN
    RAISE EXCEPTION 'Guide answers must be evaluated by the server AI service';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(v_uid::text || '|submission|' || p_client_submission_id::text, 0)
  );

  SELECT * INTO v_existing
  FROM public.learning_answer_logs
  WHERE student_id = v_uid AND client_submission_id = p_client_submission_id;

  IF FOUND THEN
    IF v_existing.chapter_id IS DISTINCT FROM p_chapter_id
       OR v_existing.level_id IS DISTINCT FROM p_level_id
       OR v_existing.question_type IS DISTINCT FROM p_question_type
       OR v_existing.question_id IS DISTINCT FROM p_question_id
       OR v_existing.raw_answer IS DISTINCT FROM COALESCE(p_raw_answer, '')
       OR v_existing.concept_id IS DISTINCT FROM p_concept_id
       OR v_existing.sub_step IS DISTINCT FROM p_sub_step
       OR v_existing.hint_count IS DISTINCT FROM p_hint_count
       OR v_existing.ai_reason IS DISTINCT FROM p_ai_reason THEN
      RAISE EXCEPTION 'Client submission ID was reused with a different payload';
    END IF;
    SELECT to_jsonb(s) INTO v_stats
    FROM public.learning_statistics s
    WHERE s.student_id = v_uid AND s.level_id = p_level_id;
    RETURN jsonb_build_object(
      'ok', true, 'duplicate', true,
      'attempt_no', v_existing.attempt_no,
      'is_first_attempt', v_existing.is_first_attempt,
      'server_is_correct', v_existing.ai_verdict = 'correct',
      'answer_log', to_jsonb(v_existing),
      'statistics', v_stats,
      'client_submission_id', p_client_submission_id
    );
  END IF;

  v_result := public.record_learning_answer(
    p_chapter_id, p_level_id, p_question_type, p_question_id,
    p_raw_answer, p_is_correct, p_concept_id, p_sub_step, p_hint_count, p_ai_reason
  );
  v_answer_log_id := NULLIF(v_result #>> '{answer_log,id}', '')::bigint;
  IF v_answer_log_id IS NULL THEN
    RAISE EXCEPTION 'Answer RPC did not return a persisted answer log ID';
  END IF;
  UPDATE public.learning_answer_logs
  SET client_submission_id = p_client_submission_id
  WHERE id = v_answer_log_id AND student_id = v_uid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Could not attach client submission ID to persisted answer';
  END IF;
  RETURN jsonb_set(v_result, '{client_submission_id}', to_jsonb(p_client_submission_id), true);
END;
$function$;

REVOKE ALL ON FUNCTION public.record_learning_answer_idempotent(uuid,text,text,text,text,text,boolean,text,integer,integer,text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_learning_answer_idempotent(uuid,text,text,text,text,text,boolean,text,integer,integer,text)
  TO authenticated;

-- A new AI evaluation is required for a guide answer to satisfy X-1.
-- Historical guide submissions with no ai_evaluation remain compatible.
CREATE OR REPLACE FUNCTION public.save_summary_and_recompute_level(
  p_level_id text,
  p_chapter_id text DEFAULT NULL,
  p_stage_id text DEFAULT 'X-2',
  p_mark_stage_completed boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, private
AS $function$
DECLARE
 v_uid uuid := auth.uid();
 v_req private.learning_level_requirements%ROWTYPE;
 v_total integer := 0;
 v_correct integer := 0;
 v_avg numeric := 0;
 v_high boolean := false;
 v_acc numeric := NULL;
 v_star text := 'UNRATED';
 v_prev_star text := 'UNRATED';
 v_mastery text := '尚未評定';
 v_prev_rank integer := 0;
 v_new_rank integer := 0;
 v_x1 boolean := false;
 v_x2 boolean := false;
 v_check boolean := false;
 v_practice boolean := false;
 v_remedial boolean := false;
 v_done boolean := false;
 v_status text := 'not_started';
 v_row public.learning_statistics%ROWTYPE;
BEGIN
 IF v_uid IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
 IF NOT EXISTS (
   SELECT 1 FROM public.profiles p
   WHERE p.id = v_uid AND p.role = 'student' AND p.account_status = 'active'
 ) THEN RAISE EXCEPTION 'Forbidden: an active student account is required'; END IF;
 SELECT * INTO v_req FROM private.learning_level_requirements WHERE level_id = p_level_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Unknown learning level'; END IF;
 IF p_chapter_id IS NOT NULL AND trim(p_chapter_id) <> v_req.chapter_id THEN RAISE EXCEPTION 'Chapter mismatch'; END IF;

 SELECT star_rating INTO v_prev_star FROM public.learning_statistics
 WHERE student_id = v_uid AND level_id = p_level_id;

 SELECT
  COUNT(DISTINCT (question_type,question_id,COALESCE(concept_id,''))) FILTER (WHERE is_first_attempt AND question_type IN ('check','practice','remedial') AND ai_verdict IN ('correct','incorrect')),
  COUNT(DISTINCT (question_type,question_id,COALESCE(concept_id,''))) FILTER (WHERE is_first_attempt AND question_type IN ('check','practice','remedial') AND ai_verdict='correct'),
  COALESCE(AVG(hint_count) FILTER (WHERE is_first_attempt AND question_type IN ('check','practice','remedial')),0),
  COALESCE(BOOL_OR(hint_count>=3 AND is_first_attempt AND question_type IN ('check','practice','remedial')),false),
  COALESCE(BOOL_OR(question_type='check' AND ai_verdict='correct'),false),
  COALESCE(BOOL_OR(question_type='practice' AND ai_verdict='correct'),false),
  COALESCE(BOOL_OR(question_type='remedial' AND ai_verdict='correct'),false)
 INTO v_total,v_correct,v_avg,v_high,v_check,v_practice,v_remedial
 FROM public.learning_answer_logs WHERE student_id=v_uid AND level_id=p_level_id;

 SELECT EXISTS (
   SELECT 1 FROM public.learning_answer_logs l
   WHERE l.student_id=v_uid AND l.level_id=p_level_id
     AND l.question_type='guide' AND l.question_id=v_req.guide_question_id
     AND l.ai_verdict='submitted'
     AND (l.ai_evaluation IS NULL OR l.ai_evaluation->>'verdict'='pass')
 ) AND NOT EXISTS (
   SELECT 1 FROM unnest(v_req.check_question_ids) r(qid)
   WHERE NOT EXISTS (
     SELECT 1 FROM public.learning_answer_logs l
     WHERE l.student_id=v_uid AND l.level_id=p_level_id
       AND l.question_type='check' AND l.question_id=r.qid AND l.ai_verdict='correct'
   )
 ) INTO v_x1;

 SELECT v_x1 AND (
   EXISTS (
     SELECT 1 FROM public.learning_answer_logs l
     WHERE l.student_id=v_uid AND l.level_id=p_level_id
       AND l.question_type='practice'
       AND l.question_id=ANY(v_req.practice_question_ids)
       AND l.ai_verdict='correct'
   ) OR v_remedial
 ) INTO v_x2;

 IF v_total>=v_req.min_star_questions AND v_check AND (v_practice OR v_remedial) THEN
  v_acc:=ROUND(v_correct::numeric/NULLIF(v_total,0),4);
  IF v_acc>=v_req.mastery_ratio AND NOT v_high AND v_remedial THEN v_star:='THREE_STARS';
  ELSIF v_acc>=v_req.progress_ratio OR v_remedial THEN v_star:='TWO_STARS';
  ELSE v_star:='ONE_STAR'; END IF;
  IF v_acc>=0.5 THEN
   v_prev_rank:=CASE COALESCE(v_prev_star,'UNRATED') WHEN 'THREE_STARS' THEN 3 WHEN 'TWO_STARS' THEN 2 WHEN 'ONE_STAR' THEN 1 ELSE 0 END;
   v_new_rank:=CASE v_star WHEN 'THREE_STARS' THEN 3 WHEN 'TWO_STARS' THEN 2 WHEN 'ONE_STAR' THEN 1 ELSE 0 END;
   IF v_prev_rank>v_new_rank THEN v_star:=v_prev_star; END IF;
  END IF;
 END IF;

 v_mastery:=CASE v_star WHEN 'THREE_STARS' THEN '★★★ 精熟' WHEN 'TWO_STARS' THEN '★★☆ 穩定進步' WHEN 'ONE_STAR' THEN '★☆☆ 需要加強' ELSE '尚未評定' END;
 v_done:=v_x1 AND v_x2;
 IF v_done THEN v_status:='completed';
 ELSIF v_x1 OR EXISTS(SELECT 1 FROM public.learning_answer_logs WHERE student_id=v_uid AND level_id=p_level_id) THEN v_status:='in_progress';
 END IF;

 INSERT INTO public.learning_statistics(
  student_id,chapter_id,level_id,stage_x1_completed,stage_x2_completed,
  level_completed,chapter_completed,star_rating,mastery_level,completion_status,
  accuracy_rate,recalculated_at,updated_at
 ) VALUES (
  v_uid,v_req.chapter_id,p_level_id,v_x1,v_x2,v_done,false,v_star,v_mastery,
  v_status,v_acc,now(),now()
 )
 ON CONFLICT(student_id,level_id) DO UPDATE SET
  chapter_id=EXCLUDED.chapter_id,
  stage_x1_completed=EXCLUDED.stage_x1_completed,
  stage_x2_completed=EXCLUDED.stage_x2_completed,
  level_completed=EXCLUDED.level_completed,
  star_rating=EXCLUDED.star_rating,
  mastery_level=EXCLUDED.mastery_level,
  completion_status=EXCLUDED.completion_status,
  accuracy_rate=EXCLUDED.accuracy_rate,
  recalculated_at=now(),updated_at=now()
 RETURNING * INTO v_row;
 RETURN to_jsonb(v_row);
END;
$function$;

REVOKE ALL ON FUNCTION public.save_summary_and_recompute_level(text,text,text,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_summary_and_recompute_level(text,text,text,boolean) TO authenticated;
