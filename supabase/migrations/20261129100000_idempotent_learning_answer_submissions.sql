-- Durable, idempotent answer submission for browser retries.
-- The existing 10-argument RPC remains available during rollout; the new
-- overload is used by updated clients and is safe to retry with the same UUID.

ALTER TABLE public.learning_answer_logs
  ADD COLUMN IF NOT EXISTS client_submission_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS learning_answer_logs_student_submission_uidx
  ON public.learning_answer_logs (student_id, client_submission_id)
  WHERE client_submission_id IS NOT NULL;

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

  -- Serialize retries of the same client submission, including concurrent tabs.
  PERFORM pg_advisory_xact_lock(
    hashtextextended(v_uid::text || '|submission|' || p_client_submission_id::text, 0)
  );

  SELECT * INTO v_existing
  FROM public.learning_answer_logs
  WHERE student_id = v_uid
    AND client_submission_id = p_client_submission_id;

  IF FOUND THEN
    -- A submission ID must never be reused for a different answer payload.
    IF v_existing.chapter_id IS DISTINCT FROM p_chapter_id
       OR v_existing.level_id IS DISTINCT FROM p_level_id
       OR v_existing.question_type IS DISTINCT FROM p_question_type
       OR v_existing.question_id IS DISTINCT FROM p_question_id
       OR v_existing.raw_answer IS DISTINCT FROM COALESCE(p_raw_answer, '')
       OR v_existing.concept_id IS DISTINCT FROM p_concept_id
       OR v_existing.hint_count IS DISTINCT FROM p_hint_count THEN
      RAISE EXCEPTION 'Client submission ID was reused with a different payload';
    END IF;

    SELECT to_jsonb(s) INTO v_stats
    FROM public.learning_statistics s
    WHERE s.student_id = v_uid AND s.level_id = p_level_id;

    RETURN jsonb_build_object(
      'ok', true,
      'duplicate', true,
      'attempt_no', v_existing.attempt_no,
      'is_first_attempt', v_existing.is_first_attempt,
      'server_is_correct', v_existing.ai_verdict = 'correct',
      'answer_log', to_jsonb(v_existing),
      'statistics', v_stats,
      'client_submission_id', p_client_submission_id
    );
  END IF;

  -- Delegate curriculum validation, server-side answer-key checking, attempt
  -- numbering and mastery recomputation to the already hardened RPC.
  v_result := public.record_learning_answer_idempotent(
    p_chapter_id,
    p_level_id,
    p_question_type,
    p_question_id,
    p_raw_answer,
    p_is_correct,
    p_concept_id,
    p_sub_step,
    p_hint_count,
    p_ai_reason
  );

  v_answer_log_id := NULLIF(v_result #>> '{answer_log,id}', '')::bigint;
  IF v_answer_log_id IS NULL THEN
    RAISE EXCEPTION 'Answer RPC did not return a persisted answer log ID';
  END IF;

  UPDATE public.learning_answer_logs
  SET client_submission_id = p_client_submission_id
  WHERE id = v_answer_log_id
    AND student_id = v_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Could not attach client submission ID to persisted answer';
  END IF;

  RETURN jsonb_set(
    v_result,
    '{client_submission_id}',
    to_jsonb(p_client_submission_id),
    true
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.record_learning_answer_idempotent(uuid,text,text,text,text,text,boolean,text,integer,integer,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_learning_answer_idempotent(uuid,text,text,text,text,text,boolean,text,integer,integer,text) TO authenticated;

COMMENT ON COLUMN public.learning_answer_logs.client_submission_id
  IS 'Client-generated UUID used to make browser answer retries idempotent per student.';
COMMENT ON FUNCTION public.record_learning_answer_idempotent(uuid,text,text,text,text,text,boolean,text,integer,integer,text)
  IS 'Idempotent authenticated answer submission. Repeating the same client UUID returns the original row without incrementing attempts.';
