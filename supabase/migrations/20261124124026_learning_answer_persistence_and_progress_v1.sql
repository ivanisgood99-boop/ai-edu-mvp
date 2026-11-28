
-- Learning answer persistence and server-side progress recomputation.
CREATE SCHEMA IF NOT EXISTS private AUTHORIZATION postgres;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS private.learning_level_requirements (
  level_id text PRIMARY KEY,
  chapter_id text NOT NULL,
  guide_question_id text NOT NULL,
  check_question_ids text[] NOT NULL CHECK (cardinality(check_question_ids) > 0),
  practice_question_ids text[] NOT NULL CHECK (cardinality(practice_question_ids) > 0),
  min_star_questions integer NOT NULL DEFAULT 2 CHECK (min_star_questions > 0),
  mastery_ratio numeric NOT NULL DEFAULT 0.75 CHECK (mastery_ratio BETWEEN 0 AND 1),
  progress_ratio numeric NOT NULL DEFAULT 0.45 CHECK (progress_ratio BETWEEN 0 AND 1)
);
REVOKE ALL ON TABLE private.learning_level_requirements FROM PUBLIC, anon, authenticated;

INSERT INTO private.learning_level_requirements
  (level_id, chapter_id, guide_question_id, check_question_ids, practice_question_ids, min_star_questions, mastery_ratio, progress_ratio)
VALUES
('CH1-L1','CH-1','CH1-L1-G',ARRAY['CH1-L1-C1','CH1-L1-C2' ]::text[],ARRAY['QB-CH1-L1-1','QB-CH1-L1-2' ]::text[],2,0.75,0.45),
('CH1-L2','CH-1','CH1-L2-G',ARRAY['CH1-L2-C1','CH1-L2-C2' ]::text[],ARRAY['QB-CH1-L2-1','QB-CH1-L2-2' ]::text[],2,0.75,0.45),
('CH2-L1','CH-2','CH2-L1-G',ARRAY['CH2-L1-C1','CH2-L1-C2' ]::text[],ARRAY['QB-CH2-L1-1','QB-CH2-L1-2' ]::text[],2,0.75,0.45),
('CH2-L2','CH-2','CH2-L2-G',ARRAY['CH2-L2-C1','CH2-L2-C2' ]::text[],ARRAY['QB-CH2-L2-1','QB-CH2-L2-2' ]::text[],2,0.75,0.45),
('CH2-L3','CH-2','CH2-L3-G',ARRAY['CH2-L3-C1','CH2-L3-C2' ]::text[],ARRAY['QB-CH2-L3-1','QB-CH2-L3-2' ]::text[],2,0.75,0.45),
('CH2-L4','CH-2','CH2-L4-G',ARRAY['CH2-L4-C1','CH2-L4-C2' ]::text[],ARRAY['QB-CH2-L4-1','QB-CH2-L4-2' ]::text[],2,0.75,0.45),
('CH2-L5','CH-2','CH2-L5-G',ARRAY['CH2-L5-C1','CH2-L5-C2' ]::text[],ARRAY['QB-CH2-L5-1','QB-CH2-L5-2' ]::text[],2,0.75,0.45),
('CH2-L6','CH-2','CH2-L6-G',ARRAY['CH2-L6-C1','CH2-L6-C2' ]::text[],ARRAY['QB-CH2-L6-1','QB-CH2-L6-2' ]::text[],2,0.75,0.45),
('CH3-L1','CH-3','CH3-L1-G',ARRAY['CH3-L1-C1' ]::text[],ARRAY['QB-CH3-L1-1','QB-CH3-L1-2' ]::text[],2,0.75,0.45),
('CH3-L2','CH-3','CH3-L2-G',ARRAY['CH3-L2-C1' ]::text[],ARRAY['QB-CH3-L2-1','QB-CH3-L2-2' ]::text[],2,0.75,0.45)
ON CONFLICT (level_id) DO UPDATE SET
  chapter_id = EXCLUDED.chapter_id,
  guide_question_id = EXCLUDED.guide_question_id,
  check_question_ids = EXCLUDED.check_question_ids,
  practice_question_ids = EXCLUDED.practice_question_ids,
  min_star_questions = EXCLUDED.min_star_questions,
  mastery_ratio = EXCLUDED.mastery_ratio,
  progress_ratio = EXCLUDED.progress_ratio;

ALTER TABLE public.learning_answer_logs
  ADD COLUMN IF NOT EXISTS question_type text NOT NULL DEFAULT 'practice',
  ADD COLUMN IF NOT EXISTS attempt_no integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_first_attempt boolean NOT NULL DEFAULT true;

ALTER TABLE public.learning_answer_logs
  ADD CONSTRAINT learning_answer_logs_question_type_check
    CHECK (question_type = ANY (ARRAY['guide','check','practice','remedial']::text[])),
  ADD CONSTRAINT learning_answer_logs_attempt_no_check CHECK (attempt_no > 0),
  ADD CONSTRAINT learning_answer_logs_student_level_question_attempt_key
    UNIQUE (student_id, level_id, question_id, attempt_no);

CREATE INDEX IF NOT EXISTS learning_answer_logs_student_level_first_idx
  ON public.learning_answer_logs (student_id, level_id, is_first_attempt);

ALTER TABLE public.learning_answer_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_statistics ENABLE ROW LEVEL SECURITY;

-- The browser may read permitted rows and append its own answer evidence only.
REVOKE ALL ON TABLE public.learning_answer_logs FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.learning_answer_logs TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.learning_answer_logs_id_seq TO authenticated;

-- Statistics are read-only from the browser; the hardened RPC owns all writes.
REVOKE ALL ON TABLE public.learning_statistics FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.learning_statistics TO authenticated;

CREATE OR REPLACE FUNCTION public.save_summary_and_recompute_level(
  p_level_id text,
  p_chapter_id text DEFAULT NULL,
  p_stage_id text DEFAULT 'X-2',
  p_mark_stage_completed boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_req private.learning_level_requirements%ROWTYPE;
  v_total_graded integer := 0;
  v_correct_cnt integer := 0;
  v_avg_hints numeric := 0;
  v_high_hint boolean := false;
  v_acc numeric := NULL;
  v_star text := 'UNRATED';
  v_mastery text := '尚未評定';
  v_has_x1 boolean := false;
  v_has_x2 boolean := false;
  v_has_check boolean := false;
  v_has_practice boolean := false;
  v_remedial_passed boolean := false;
  v_level_done boolean := false;
  v_comp_status text := 'not_started';
  v_row public.learning_statistics%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: user not signed in';
  END IF;

  SELECT * INTO v_req
  FROM private.learning_level_requirements
  WHERE level_id = p_level_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown learning level: %', p_level_id;
  END IF;

  IF p_chapter_id IS NOT NULL AND trim(p_chapter_id) <> v_req.chapter_id THEN
    RAISE EXCEPTION 'Chapter does not match learning level';
  END IF;

  SELECT
    COUNT(DISTINCT question_id) FILTER (
      WHERE is_first_attempt = true AND ai_verdict IN ('correct','incorrect','true','false')
    ),
    COUNT(DISTINCT question_id) FILTER (
      WHERE is_first_attempt = true AND ai_verdict IN ('correct','true')
    ),
    COALESCE(AVG(hint_count) FILTER (WHERE is_first_attempt = true), 0),
    COALESCE(BOOL_OR(hint_count >= 3), false),
    COALESCE(BOOL_OR(question_type = 'check'), false),
    COALESCE(BOOL_OR(question_type IN ('practice','remedial')), false),
    COALESCE(BOOL_OR(question_type = 'remedial' AND ai_verdict IN ('correct','true')), false)
  INTO
    v_total_graded, v_correct_cnt, v_avg_hints, v_high_hint,
    v_has_check, v_has_practice, v_remedial_passed
  FROM public.learning_answer_logs
  WHERE student_id = v_uid AND level_id = p_level_id;

  SELECT
    EXISTS (
      SELECT 1
      FROM public.learning_answer_logs l
      WHERE l.student_id = v_uid
        AND l.level_id = p_level_id
        AND l.question_type = 'guide'
        AND l.question_id = v_req.guide_question_id
        AND l.ai_verdict IN ('correct','true')
    )
    AND NOT EXISTS (
      SELECT 1
      FROM unnest(v_req.check_question_ids) AS required(question_id)
      WHERE NOT EXISTS (
        SELECT 1
        FROM public.learning_answer_logs l
        WHERE l.student_id = v_uid
          AND l.level_id = p_level_id
          AND l.question_type = 'check'
          AND l.question_id = required.question_id
          AND l.ai_verdict IN ('correct','true')
      )
    )
  INTO v_has_x1;

  SELECT
    v_has_x1 AND EXISTS (
      SELECT 1
      FROM public.learning_answer_logs l
      WHERE l.student_id = v_uid
        AND l.level_id = p_level_id
        AND l.ai_verdict IN ('correct','true')
        AND (
          (l.question_type = 'practice' AND l.question_id = ANY(v_req.practice_question_ids))
          OR
          (l.question_type = 'remedial' AND l.question_id LIKE (p_level_id || '-REM-%'))
        )
    )
  INTO v_has_x2;

  IF v_total_graded >= v_req.min_star_questions
     AND v_has_check AND v_has_practice THEN
    v_acc := ROUND(v_correct_cnt::numeric / NULLIF(v_total_graded, 0), 4);
    IF v_acc >= v_req.mastery_ratio AND NOT v_high_hint AND v_remedial_passed THEN
      v_star := 'THREE_STARS';
      v_mastery := '★★★ 精熟';
    ELSIF v_acc >= v_req.progress_ratio OR v_remedial_passed THEN
      v_star := 'TWO_STARS';
      v_mastery := '★★☆ 穩定進步';
    ELSE
      v_star := 'ONE_STAR';
      v_mastery := '★☆☆ 需要加強';
    END IF;
  END IF;

  v_level_done := v_has_x1 AND v_has_x2;
  IF v_level_done THEN
    v_comp_status := 'completed';
  ELSIF v_has_x1 OR EXISTS (
    SELECT 1 FROM public.learning_answer_logs
    WHERE student_id = v_uid AND level_id = p_level_id
  ) THEN
    v_comp_status := 'in_progress';
  END IF;

  INSERT INTO public.learning_statistics (
    student_id, chapter_id, level_id,
    stage_x1_completed, stage_x2_completed, level_completed, chapter_completed,
    star_rating, mastery_level, completion_status, accuracy_rate,
    recalculated_at, updated_at
  )
  VALUES (
    v_uid, v_req.chapter_id, p_level_id,
    v_has_x1, v_has_x2, v_level_done, false,
    v_star, v_mastery, v_comp_status, v_acc,
    now(), now()
  )
  ON CONFLICT (student_id, level_id) DO UPDATE SET
    chapter_id = EXCLUDED.chapter_id,
    stage_x1_completed = EXCLUDED.stage_x1_completed,
    stage_x2_completed = EXCLUDED.stage_x2_completed,
    level_completed = EXCLUDED.level_completed,
    star_rating = EXCLUDED.star_rating,
    mastery_level = EXCLUDED.mastery_level,
    completion_status = EXCLUDED.completion_status,
    accuracy_rate = EXCLUDED.accuracy_rate,
    recalculated_at = now(),
    updated_at = now()
  RETURNING * INTO v_row;

  RETURN to_jsonb(v_row);
END;
$function$;

REVOKE ALL ON FUNCTION public.save_summary_and_recompute_level(text,text,text,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_summary_and_recompute_level(text,text,text,boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.record_learning_answer(
  p_chapter_id text,
  p_level_id text,
  p_question_type text,
  p_question_id text,
  p_raw_answer text,
  p_is_correct boolean,
  p_concept_id text DEFAULT NULL,
  p_sub_step integer DEFAULT NULL,
  p_hint_count integer DEFAULT 0,
  p_ai_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_stage_id text;
  v_attempt integer;
  v_row public.learning_answer_logs%ROWTYPE;
  v_stats jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: user not signed in';
  END IF;
  IF p_question_type NOT IN ('guide','check','practice','remedial') THEN
    RAISE EXCEPTION 'Invalid question type';
  END IF;
  IF p_is_correct IS NULL THEN
    RAISE EXCEPTION 'Missing answer verdict';
  END IF;
  IF p_hint_count < 0 THEN
    RAISE EXCEPTION 'Hint count cannot be negative';
  END IF;
  IF COALESCE(trim(p_level_id), '') = '' OR COALESCE(trim(p_question_id), '') = '' THEN
    RAISE EXCEPTION 'Level and question identifiers are required';
  END IF;

  v_stage_id := CASE WHEN p_question_type IN ('guide','check') THEN 'X-1' ELSE 'X-2' END;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(v_uid::text || '|' || p_level_id || '|' || p_question_id, 0)
  );

  SELECT COUNT(*) + 1 INTO v_attempt
  FROM public.learning_answer_logs
  WHERE student_id = v_uid
    AND level_id = p_level_id
    AND question_id = p_question_id;

  INSERT INTO public.learning_answer_logs (
    student_id, chapter_id, level_id, stage_id, sub_step, concept_id,
    question_id, question_type, raw_answer, ai_verdict, ai_reason,
    hint_count, is_completed, attempt_no, is_first_attempt
  )
  VALUES (
    v_uid, p_chapter_id, p_level_id, v_stage_id, p_sub_step, p_concept_id,
    p_question_id, p_question_type, COALESCE(p_raw_answer, ''),
    CASE WHEN p_is_correct THEN 'correct' ELSE 'incorrect' END,
    p_ai_reason, p_hint_count, true, v_attempt, (v_attempt = 1)
  )
  RETURNING * INTO v_row;

  v_stats := public.save_summary_and_recompute_level(
    p_level_id, p_chapter_id, v_stage_id, true
  );

  RETURN jsonb_build_object(
    'ok', true,
    'attempt_no', v_attempt,
    'is_first_attempt', (v_attempt = 1),
    'answer_log', to_jsonb(v_row),
    'statistics', v_stats
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.record_learning_answer(text,text,text,text,text,boolean,text,integer,integer,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_learning_answer(text,text,text,text,text,boolean,text,integer,integer,text) TO authenticated;

COMMENT ON FUNCTION public.record_learning_answer(text,text,text,text,text,boolean,text,integer,integer,text)
  IS 'Stores an authenticated student answer, assigns a server-side attempt number, and recomputes durable level progress.';
COMMENT ON FUNCTION public.save_summary_and_recompute_level(text,text,text,boolean)
  IS 'Recomputes durable stage completion and mastery only from the authenticated student answer evidence; legacy stage flags are ignored.';
