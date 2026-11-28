-- Require an active student profile for all learning write/recompute RPCs.
-- This prevents suspended accounts and non-student roles from bypassing the
-- frontend and continuing to submit or recompute learning progress.

CREATE OR REPLACE FUNCTION public.save_summary_and_recompute_level(p_level_id text, p_chapter_id text DEFAULT NULL::text, p_stage_id text DEFAULT 'X-2'::text, p_mark_stage_completed boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
DECLARE
 v_uid uuid:=auth.uid();v_req private.learning_level_requirements%ROWTYPE;
 v_total integer:=0;v_correct integer:=0;v_avg numeric:=0;v_high boolean:=false;v_acc numeric:=NULL;
 v_star text:='UNRATED';v_prev_star text:='UNRATED';v_mastery text:='尚未評定';v_prev_rank integer:=0;v_new_rank integer:=0;
 v_x1 boolean:=false;v_x2 boolean:=false;v_check boolean:=false;v_practice boolean:=false;v_remedial boolean:=false;
 v_done boolean:=false;v_status text:='not_started';v_row public.learning_statistics%ROWTYPE;
BEGIN
 IF v_uid IS NULL OR NOT EXISTS (
  SELECT 1 FROM public.profiles p
  WHERE p.id = v_uid AND p.role = 'student' AND p.account_status = 'active'
) THEN
  RAISE EXCEPTION 'Forbidden: an active student account is required';
END IF;
 SELECT * INTO v_req FROM private.learning_level_requirements WHERE level_id=p_level_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Unknown learning level'; END IF;
 IF p_chapter_id IS NOT NULL AND trim(p_chapter_id)<>v_req.chapter_id THEN RAISE EXCEPTION 'Chapter mismatch'; END IF;
 SELECT star_rating INTO v_prev_star FROM public.learning_statistics WHERE student_id=v_uid AND level_id=p_level_id;
 SELECT
  COUNT(DISTINCT (question_type,question_id,COALESCE(concept_id,''))) FILTER(WHERE is_first_attempt AND question_type IN ('check','practice','remedial') AND ai_verdict IN ('correct','incorrect')),
  COUNT(DISTINCT (question_type,question_id,COALESCE(concept_id,''))) FILTER(WHERE is_first_attempt AND question_type IN ('check','practice','remedial') AND ai_verdict='correct'),
  COALESCE(AVG(hint_count) FILTER(WHERE is_first_attempt AND question_type IN ('check','practice','remedial')),0),
  COALESCE(BOOL_OR(hint_count>=3 AND is_first_attempt AND question_type IN ('check','practice','remedial')),false),
  COALESCE(BOOL_OR(question_type='check' AND ai_verdict='correct'),false),
  COALESCE(BOOL_OR(question_type='practice' AND ai_verdict='correct'),false),
  COALESCE(BOOL_OR(question_type='remedial' AND ai_verdict='correct'),false)
 INTO v_total,v_correct,v_avg,v_high,v_check,v_practice,v_remedial
 FROM public.learning_answer_logs WHERE student_id=v_uid AND level_id=p_level_id;
 SELECT EXISTS(SELECT 1 FROM public.learning_answer_logs l WHERE l.student_id=v_uid AND l.level_id=p_level_id AND l.question_type='guide' AND l.question_id=v_req.guide_question_id AND l.ai_verdict='submitted')
 AND NOT EXISTS(SELECT 1 FROM unnest(v_req.check_question_ids) r(qid) WHERE NOT EXISTS(
  SELECT 1 FROM public.learning_answer_logs l WHERE l.student_id=v_uid AND l.level_id=p_level_id AND l.question_type='check' AND l.question_id=r.qid AND l.ai_verdict='correct'))
 INTO v_x1;
 SELECT v_x1 AND (EXISTS(SELECT 1 FROM public.learning_answer_logs l WHERE l.student_id=v_uid AND l.level_id=p_level_id AND l.question_type='practice' AND l.question_id=ANY(v_req.practice_question_ids) AND l.ai_verdict='correct') OR v_remedial) INTO v_x2;
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
 IF v_done THEN v_status:='completed'; ELSIF v_x1 OR EXISTS(SELECT 1 FROM public.learning_answer_logs WHERE student_id=v_uid AND level_id=p_level_id) THEN v_status:='in_progress'; END IF;
 INSERT INTO public.learning_statistics(student_id,chapter_id,level_id,stage_x1_completed,stage_x2_completed,level_completed,chapter_completed,star_rating,mastery_level,completion_status,accuracy_rate,recalculated_at,updated_at)
 VALUES(v_uid,v_req.chapter_id,p_level_id,v_x1,v_x2,v_done,false,v_star,v_mastery,v_status,v_acc,now(),now())
 ON CONFLICT(student_id,level_id) DO UPDATE SET chapter_id=EXCLUDED.chapter_id,stage_x1_completed=EXCLUDED.stage_x1_completed,stage_x2_completed=EXCLUDED.stage_x2_completed,level_completed=EXCLUDED.level_completed,star_rating=EXCLUDED.star_rating,mastery_level=EXCLUDED.mastery_level,completion_status=EXCLUDED.completion_status,accuracy_rate=EXCLUDED.accuracy_rate,recalculated_at=now(),updated_at=now()
 RETURNING * INTO v_row;
 RETURN to_jsonb(v_row);
END;$function$


CREATE OR REPLACE FUNCTION public.record_learning_answer(p_chapter_id text, p_level_id text, p_question_type text, p_question_id text, p_raw_answer text, p_is_correct boolean, p_concept_id text DEFAULT NULL::text, p_sub_step integer DEFAULT NULL::integer, p_hint_count integer DEFAULT 0, p_ai_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
DECLARE
 v_uid uuid:=auth.uid();v_req private.learning_level_requirements%ROWTYPE;v_key private.learning_answer_keys%ROWTYPE;
 v_stage text;v_attempt integer;v_row public.learning_answer_logs%ROWTYPE;v_stats jsonb;v_correct boolean:=false;
 v_answer text:=upper(regexp_replace(regexp_replace(btrim(COALESCE(p_raw_answer,'')),'[[:space:]]+','','g'),'^\+',''));
 v_key_concept text:=CASE WHEN p_question_type='remedial' THEN COALESCE(p_concept_id,'') ELSE '' END;
BEGIN
 IF v_uid IS NULL OR NOT EXISTS (
  SELECT 1 FROM public.profiles p
  WHERE p.id = v_uid AND p.role = 'student' AND p.account_status = 'active'
) THEN
  RAISE EXCEPTION 'Forbidden: an active student account is required';
END IF;
 IF p_question_type NOT IN ('guide','check','practice','remedial') THEN RAISE EXCEPTION 'Invalid question type'; END IF;
 IF p_hint_count<0 OR p_hint_count>4 THEN RAISE EXCEPTION 'Hint count must be between 0 and 4'; END IF;
 IF length(COALESCE(p_raw_answer,''))>4000 OR length(COALESCE(p_ai_reason,''))>500 THEN RAISE EXCEPTION 'Answer or reason too long'; END IF;
 IF COALESCE(trim(p_level_id),'')='' OR COALESCE(trim(p_question_id),'')='' THEN RAISE EXCEPTION 'Level and question required'; END IF;
 SELECT * INTO v_req FROM private.learning_level_requirements WHERE level_id=p_level_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Unknown learning level'; END IF;
 IF p_chapter_id IS DISTINCT FROM v_req.chapter_id THEN RAISE EXCEPTION 'Chapter mismatch'; END IF;
 IF p_question_type='guide' THEN
  IF p_question_id<>v_req.guide_question_id THEN RAISE EXCEPTION 'Invalid guide question'; END IF;
  IF length(btrim(COALESCE(p_raw_answer,'')))<8 THEN RAISE EXCEPTION 'Please provide a more complete explanation'; END IF;
 ELSE
  SELECT * INTO v_key FROM private.learning_answer_keys
  WHERE level_id=p_level_id AND question_id=p_question_id AND question_type=p_question_type AND concept_id=v_key_concept;
  IF NOT FOUND THEN RAISE EXCEPTION 'Question is not in server answer key'; END IF;
  v_correct:=v_answer=ANY(ARRAY(SELECT upper(regexp_replace(regexp_replace(btrim(a),'[[:space:]]+','','g'),'^\+','')) FROM unnest(v_key.accepted_answers) a));
 END IF;
 v_stage:=CASE WHEN p_question_type IN ('guide','check') THEN 'X-1' ELSE 'X-2' END;
 PERFORM pg_advisory_xact_lock(hashtextextended(v_uid::text||'|'||p_level_id||'|'||p_question_id||'|'||v_key_concept,0));
 SELECT COUNT(*)+1 INTO v_attempt FROM public.learning_answer_logs
 WHERE student_id=v_uid AND level_id=p_level_id AND question_id=p_question_id
 AND (p_question_type<>'remedial' OR concept_id IS NOT DISTINCT FROM p_concept_id);
 INSERT INTO public.learning_answer_logs(student_id,chapter_id,level_id,stage_id,sub_step,concept_id,question_id,question_type,raw_answer,ai_verdict,ai_reason,hint_count,is_completed,attempt_no,is_first_attempt)
 VALUES(v_uid,v_req.chapter_id,p_level_id,v_stage,p_sub_step,p_concept_id,p_question_id,p_question_type,COALESCE(p_raw_answer,''),
 CASE WHEN p_question_type='guide' THEN 'submitted' WHEN v_correct THEN 'correct' ELSE 'incorrect' END,p_ai_reason,p_hint_count,true,v_attempt,v_attempt=1)
 RETURNING * INTO v_row;
 v_stats:=public.save_summary_and_recompute_level(p_level_id,v_req.chapter_id,v_stage,true);
 RETURN jsonb_build_object('ok',true,'attempt_no',v_attempt,'is_first_attempt',v_attempt=1,'server_is_correct',v_correct,'answer_log',to_jsonb(v_row),'statistics',v_stats);
END;$function$


REVOKE ALL ON FUNCTION public.save_summary_and_recompute_level(text,text,text,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_summary_and_recompute_level(text,text,text,boolean) TO authenticated;

REVOKE ALL ON FUNCTION public.record_learning_answer(text,text,text,text,text,boolean,text,integer,integer,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_learning_answer(text,text,text,text,text,boolean,text,integer,integer,text) TO authenticated;
