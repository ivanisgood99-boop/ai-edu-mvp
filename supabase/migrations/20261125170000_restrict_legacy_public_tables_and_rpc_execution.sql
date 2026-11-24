-- Close legacy tables that still have permissive PUBLIC/anon ALL policies.
-- This migration intentionally preserves every row. It removes browser API access
-- because these legacy schemas do not contain a trustworthy auth.uid()-owned key.
-- Apply only after confirming the legacy UI is no longer in use.
DO $migration$
DECLARE
  v_table text;
  v_policy record;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'answer_logs',
    'audit_logs',
    'student_progress',
    'teacher_applications'
  ]
  LOOP
    FOR v_policy IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = v_table
    LOOP
      EXECUTE format(
        'DROP POLICY IF EXISTS %I ON public.%I',
        v_policy.policyname,
        v_table
      );
    END LOOP;

    EXECUTE format(
      'REVOKE ALL PRIVILEGES ON TABLE public.%I FROM PUBLIC, anon, authenticated',
      v_table
    );
  END LOOP;
END;
$migration$;

-- Legacy serial sequences must not remain directly readable/usable by browser roles.
DO $sequences$
DECLARE
  v_sequence text;
BEGIN
  FOREACH v_sequence IN ARRAY ARRAY[
    pg_get_serial_sequence('public.answer_logs', 'id'),
    pg_get_serial_sequence('public.audit_logs', 'id'),
    pg_get_serial_sequence('public.teacher_applications', 'id')
  ]
  LOOP
    IF v_sequence IS NOT NULL THEN
      EXECUTE format(
        'REVOKE ALL PRIVILEGES ON SEQUENCE %s FROM PUBLIC, anon, authenticated',
        v_sequence
      );
    END IF;
  END LOOP;
END;
$sequences$;

-- Browser-callable SECURITY DEFINER RPCs are limited to authenticated users.
REVOKE ALL ON FUNCTION public.apply_learning_action_reward(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_learning_action_reward(text, text) TO authenticated;

REVOKE ALL ON FUNCTION public.sync_student_stamina_and_rockets(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_student_stamina_and_rockets(text) TO authenticated;

REVOKE ALL ON FUNCTION public.use_rocket_supply() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.use_rocket_supply() TO authenticated;

-- Trigger functions are not browser RPC endpoints. Remove PUBLIC/anon EXECUTE;
-- existing triggers remain attached and can continue to run.
REVOKE ALL ON FUNCTION public.guard_profile_update() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.handle_new_user_profile() FROM PUBLIC, anon;

-- Keep the learning RPCs explicitly authenticated-only as a defensive invariant.
REVOKE ALL ON FUNCTION public.record_learning_answer(
  text, text, text, text, text, boolean, text, integer, integer, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_learning_answer(
  text, text, text, text, text, boolean, text, integer, integer, text
) TO authenticated;

REVOKE ALL ON FUNCTION public.save_summary_and_recompute_level(text, text, text, boolean)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_summary_and_recompute_level(text, text, text, boolean)
  TO authenticated;
