
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
SECURITY DEFINER
SET search_path = pg_catalog, public, private
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_req private.learning_level_requirements%ROWTYPE;
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
  IF p_hint_count < 0 OR p_hint_count > 4 THEN
    RAISE EXCEPTION 'Hint count must be between 0 and 4';
  END IF;
  IF length(COALESCE(p_raw_answer,'')) > 4000 OR length(COALESCE(p_ai_reason,'')) > 500 THEN
    RAISE EXCEPTION 'Answer or reason is too long';
  END IF;
  IF COALESCE(trim(p_level_id), '') = '' OR COALESCE(trim(p_question_id), '') = '' THEN
    RAISE EXCEPTION 'Level and question identifiers are required';
  END IF;

  SELECT * INTO v_req
  FROM private.learning_level_requirements
  WHERE level_id = p_level_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown learning level: %', p_level_id;
  END IF;
  IF p_chapter_id IS DISTINCT FROM v_req.chapter_id THEN
    RAISE EXCEPTION 'Chapter does not match learning level';
  END IF;

  IF p_question_type = 'guide' AND p_question_id <> v_req.guide_question_id THEN
    RAISE EXCEPTION 'Question does not belong to this guide stage';
  ELSIF p_question_type = 'check' AND NOT (p_question_id = ANY(v_req.check_question_ids)) THEN
    RAISE EXCEPTION 'Question does not belong to this check stage';
  ELSIF p_question_type = 'practice' AND NOT (p_question_id = ANY(v_req.practice_question_ids)) THEN
    RAISE EXCEPTION 'Question does not belong to this practice stage';
  ELSIF p_question_type = 'remedial' AND p_question_id NOT LIKE (p_level_id || '-REM-%') THEN
    RAISE EXCEPTION 'Question does not belong to this remedial stage';
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
    v_uid, v_req.chapter_id, p_level_id, v_stage_id, p_sub_step, p_concept_id,
    p_question_id, p_question_type, COALESCE(p_raw_answer, ''),
    CASE WHEN p_is_correct THEN 'correct' ELSE 'incorrect' END,
    p_ai_reason, p_hint_count, true, v_attempt, (v_attempt = 1)
  )
  RETURNING * INTO v_row;

  v_stats := public.save_summary_and_recompute_level(
    p_level_id, v_req.chapter_id, v_stage_id, true
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

REVOKE INSERT, UPDATE, DELETE ON TABLE public.learning_answer_logs FROM anon, authenticated, PUBLIC;
GRANT SELECT ON TABLE public.learning_answer_logs TO authenticated;
REVOKE ALL ON SEQUENCE public.learning_answer_logs_id_seq FROM anon, authenticated, PUBLIC;

COMMENT ON FUNCTION public.record_learning_answer(text,text,text,text,text,boolean,text,integer,integer,text)
  IS 'Authenticated server-owned answer insert with allowlisted curriculum question IDs and server-assigned attempt order.';
