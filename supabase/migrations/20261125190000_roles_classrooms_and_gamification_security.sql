-- Role, classroom, and gamification security foundation.
-- Staged for preview/review; do not apply to production until browser compatibility tests pass.

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles p
    WHERE p.id=auth.uid() AND p.role='admin' AND p.account_status='active');
$$;
REVOKE ALL ON FUNCTION public.is_platform_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.is_active_teacher()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles p
    WHERE p.id=auth.uid() AND p.role='teacher' AND p.account_status='active');
$$;
REVOKE ALL ON FUNCTION public.is_active_teacher() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_active_teacher() TO authenticated;

-- Prevent self-promotion; only an active admin changing another profile or
-- trusted service_role automation can change role/account_status.
CREATE OR REPLACE FUNCTION public.guard_profile_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id THEN RAISE EXCEPTION 'Cannot change profile id'; END IF;
  IF COALESCE(auth.role(),'') <> 'service_role'
     AND NOT (OLD.id <> auth.uid() AND public.is_platform_admin()) THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN RAISE EXCEPTION 'Permission denied: cannot modify role'; END IF;
    IF NEW.account_status IS DISTINCT FROM OLD.account_status THEN RAISE EXCEPTION 'Permission denied: cannot modify account_status'; END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.guard_profile_update() FROM PUBLIC, anon;

-- Legacy tables have no trustworthy ownership column. Preserve rows, close
-- browser access and remove permissive policies; new flows use the newer tables.
DO $legacy$
DECLARE t text; p record;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'answer_logs','student_progress','audit_logs',
    'backup_answer_logs_20261124','backup_student_progress_20261124'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I',p.policyname,t);
    END LOOP;
    EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM PUBLIC, anon, authenticated',t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['answer_logs','student_progress','audit_logs','teacher_applications'] LOOP
    IF pg_get_serial_sequence('public.'||t,'id') IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON SEQUENCE %s FROM PUBLIC, anon, authenticated',
        pg_get_serial_sequence('public.'||t,'id'));
    END IF;
  END LOOP;
  FOR p IN SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='teacher_applications'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.teacher_applications',p.policyname);
  END LOOP;
END;
$legacy$;

ALTER TABLE public.teacher_applications
  ADD COLUMN IF NOT EXISTS applicant_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE;
CREATE UNIQUE INDEX IF NOT EXISTS teacher_applications_one_pending_per_applicant
  ON public.teacher_applications(applicant_id)
  WHERE applicant_id IS NOT NULL AND status='pending';

ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS classes_teacher_select ON public.classes;
DROP POLICY IF EXISTS classes_teacher_insert ON public.classes;
DROP POLICY IF EXISTS classes_teacher_update ON public.classes;
DROP POLICY IF EXISTS classes_teacher_delete ON public.classes;
CREATE POLICY classes_teacher_select ON public.classes FOR SELECT TO authenticated
  USING (teacher_id=auth.uid() AND public.is_active_teacher());
-- Class creation is only available through create_teacher_class(); the RPC
-- generates the invite code server-side. Do not grant direct table writes.

DROP POLICY IF EXISTS enrollments_student_or_teacher_select ON public.class_enrollments;
DROP POLICY IF EXISTS enrollments_teacher_delete ON public.class_enrollments;
CREATE POLICY enrollments_student_or_teacher_select ON public.class_enrollments FOR SELECT TO authenticated
  USING (student_id=auth.uid() OR EXISTS (
    SELECT 1 FROM public.classes c WHERE c.id=class_enrollments.class_id
      AND c.teacher_id=auth.uid() AND public.is_active_teacher()));
CREATE POLICY enrollments_teacher_delete ON public.class_enrollments FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.classes c WHERE c.id=class_enrollments.class_id
    AND c.teacher_id=auth.uid() AND public.is_active_teacher()));

DROP POLICY IF EXISTS teacher_apps_owner_select ON public.teacher_applications;
DROP POLICY IF EXISTS teacher_apps_owner_insert ON public.teacher_applications;
DROP POLICY IF EXISTS teacher_apps_admin_select ON public.teacher_applications;
CREATE POLICY teacher_apps_owner_select ON public.teacher_applications FOR SELECT TO authenticated
  USING (applicant_id=auth.uid());
CREATE POLICY teacher_apps_owner_insert ON public.teacher_applications FOR INSERT TO authenticated
  WITH CHECK (applicant_id=auth.uid() AND EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id=auth.uid()
      AND p.role='student' AND p.account_status='active'));
CREATE POLICY teacher_apps_admin_select ON public.teacher_applications FOR SELECT TO authenticated
  USING (public.is_platform_admin());

REVOKE ALL ON TABLE public.classes,public.class_enrollments,public.teacher_applications FROM PUBLIC,anon,authenticated;
GRANT SELECT ON TABLE public.classes TO authenticated;
GRANT SELECT,DELETE ON TABLE public.class_enrollments TO authenticated;
GRANT SELECT ON TABLE public.teacher_applications TO authenticated;
REVOKE ALL ON SEQUENCE public.class_enrollments_id_seq FROM PUBLIC,anon,authenticated;

DROP POLICY IF EXISTS profiles_admin_select ON public.profiles;
CREATE POLICY profiles_admin_select ON public.profiles FOR SELECT TO authenticated
  USING (public.is_platform_admin());
REVOKE ALL ON TABLE public.profiles FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON TABLE public.profiles TO authenticated;

CREATE OR REPLACE FUNCTION public.submit_teacher_application(p_subject text DEFAULT '高中數學')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE v_uid uuid:=auth.uid(); v_name text; v_row public.teacher_applications%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  SELECT display_name INTO v_name FROM public.profiles
    WHERE id=v_uid AND role='student' AND account_status='active';
  IF NOT FOUND THEN RAISE EXCEPTION 'Only active student accounts may apply'; END IF;
  IF length(trim(COALESCE(p_subject,'')))<2 OR length(p_subject)>80 THEN RAISE EXCEPTION 'Invalid subject'; END IF;
  INSERT INTO public.teacher_applications(applicant_id,teacher_name,subject,status)
    VALUES(v_uid,v_name,trim(p_subject),'pending')
    ON CONFLICT (applicant_id) WHERE applicant_id IS NOT NULL AND status='pending'
    DO UPDATE SET subject=EXCLUDED.subject,teacher_name=EXCLUDED.teacher_name
    RETURNING * INTO v_row;
  RETURN jsonb_build_object('id',v_row.id,'status',v_row.status,'subject',v_row.subject);
END;
$function$;
REVOKE ALL ON FUNCTION public.submit_teacher_application(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.submit_teacher_application(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.review_teacher_application(p_application_id bigint,p_decision text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE v_uid uuid:=auth.uid(); v_app public.teacher_applications%ROWTYPE;
BEGIN
  IF v_uid IS NULL OR NOT public.is_platform_admin() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF p_decision NOT IN ('approved','rejected') THEN RAISE EXCEPTION 'Invalid decision'; END IF;
  SELECT * INTO v_app FROM public.teacher_applications WHERE id=p_application_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Application not found'; END IF;
  IF v_app.applicant_id IS NULL THEN RAISE EXCEPTION 'Legacy application requires manual verification'; END IF;
  IF v_app.status<>'pending' THEN RAISE EXCEPTION 'Application is not pending'; END IF;
  UPDATE public.teacher_applications SET status=p_decision WHERE id=p_application_id;
  IF p_decision='approved' THEN
    UPDATE public.profiles SET role='teacher'
      WHERE id=v_app.applicant_id AND account_status='active';
  END IF;
  INSERT INTO public.platform_audit_logs(actor_id,action,target_table,target_id,details)
    VALUES(v_uid,'teacher_application_'||p_decision,'teacher_applications',
      p_application_id::text,jsonb_build_object('applicant_id',v_app.applicant_id));
  RETURN jsonb_build_object('id',p_application_id,'status',p_decision);
END;
$function$;
REVOKE ALL ON FUNCTION public.review_teacher_application(bigint,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.review_teacher_application(bigint,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_teacher_class(p_class_name text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE v_uid uuid:=auth.uid(); v_row public.classes%ROWTYPE;
BEGIN
  IF v_uid IS NULL OR NOT public.is_active_teacher() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF length(trim(COALESCE(p_class_name,'')))<2 OR length(p_class_name)>80 THEN RAISE EXCEPTION 'Invalid class name'; END IF;
  INSERT INTO public.classes(teacher_id,class_name,invite_code)
    VALUES(v_uid,trim(p_class_name),upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)))
    RETURNING * INTO v_row;
  RETURN jsonb_build_object('id',v_row.id,'class_name',v_row.class_name,'invite_code',v_row.invite_code);
END;
$function$;
REVOKE ALL ON FUNCTION public.create_teacher_class(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_teacher_class(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.join_class_by_invite_code(p_invite_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE v_uid uuid:=auth.uid(); v_class public.classes%ROWTYPE;
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (SELECT 1 FROM public.profiles p
    WHERE p.id=v_uid AND p.role='student' AND p.account_status='active') THEN
    RAISE EXCEPTION 'Only active students may join a class';
  END IF;
  IF length(trim(COALESCE(p_invite_code,'')))<>8 THEN RAISE EXCEPTION 'Invalid invite code'; END IF;
  SELECT * INTO v_class FROM public.classes WHERE invite_code=upper(trim(p_invite_code)) FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Class not found'; END IF;
  INSERT INTO public.class_enrollments(class_id,student_id) VALUES(v_class.id,v_uid)
    ON CONFLICT(class_id,student_id) DO NOTHING;
  RETURN jsonb_build_object('class_id',v_class.id,'class_name',v_class.class_name);
END;
$function$;
REVOKE ALL ON FUNCTION public.join_class_by_invite_code(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.join_class_by_invite_code(text) TO authenticated;

DO $catalog$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['achievements','characters_catalog','skins_catalog'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC,anon,authenticated',t);
    EXECUTE format('GRANT SELECT ON TABLE public.%I TO authenticated',t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I',t||'_authenticated_read',t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (true)',t||'_authenticated_read',t);
  END LOOP;
END;
$catalog$;

DO $owned$
DECLARE t text; p record;
BEGIN
  FOREACH t IN ARRAY ARRAY['student_achievements','student_characters','student_skins','lottery_draws','pk_matches','platform_audit_logs'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I',p.policyname,t);
    END LOOP;
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC,anon,authenticated',t);
  END LOOP;
END;
$owned$;

CREATE POLICY student_achievements_read_own ON public.student_achievements FOR SELECT TO authenticated USING(student_id=auth.uid());
CREATE POLICY student_characters_read_own ON public.student_characters FOR SELECT TO authenticated USING(student_id=auth.uid());
CREATE POLICY student_skins_read_own ON public.student_skins FOR SELECT TO authenticated USING(student_id=auth.uid());
CREATE POLICY lottery_draws_read_own ON public.lottery_draws FOR SELECT TO authenticated USING(student_id=auth.uid());
CREATE POLICY pk_matches_read_participant ON public.pk_matches FOR SELECT TO authenticated USING(player_id=auth.uid() OR opponent_id=auth.uid());
CREATE POLICY platform_audit_admin_read ON public.platform_audit_logs FOR SELECT TO authenticated USING(public.is_platform_admin());

GRANT SELECT ON TABLE public.student_achievements,public.student_characters,
  public.student_skins,public.lottery_draws,public.pk_matches,public.platform_audit_logs TO authenticated;

REVOKE ALL ON TABLE public.student_resources,public.resource_transactions FROM PUBLIC,anon,authenticated;
REVOKE ALL ON TABLE public.curriculum_modules FROM PUBLIC,anon,authenticated;
GRANT SELECT ON TABLE public.curriculum_modules TO anon,authenticated;
GRANT SELECT ON TABLE public.student_resources,public.resource_transactions TO authenticated;


-- Administrators may manage other profiles; the trigger still prevents self-role changes.
DROP POLICY IF EXISTS profiles_admin_update ON public.profiles;
CREATE POLICY profiles_admin_update ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.is_platform_admin() AND id <> auth.uid())
  WITH CHECK (public.is_platform_admin() AND id <> auth.uid());

-- Purchase and equip operations are atomic server-side transactions.
CREATE OR REPLACE FUNCTION public.purchase_character(p_character_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE v_uid uuid:=auth.uid(); v_cost integer; v_balance integer;
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (SELECT 1 FROM public.profiles
    WHERE id=v_uid AND role='student' AND account_status='active') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT stardust_cost INTO v_cost FROM public.characters_catalog WHERE id=p_character_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Character not found'; END IF;
  IF EXISTS (SELECT 1 FROM public.student_characters WHERE student_id=v_uid AND character_id=p_character_id) THEN
    RAISE EXCEPTION 'Character already owned';
  END IF;
  SELECT stardust INTO v_balance FROM public.student_resources WHERE student_id=v_uid FOR UPDATE;
  IF NOT FOUND OR v_balance < v_cost THEN RAISE EXCEPTION 'Not enough stardust'; END IF;
  UPDATE public.student_resources SET stardust=stardust-v_cost,updated_at=now() WHERE student_id=v_uid;
  INSERT INTO public.student_characters(student_id,character_id) VALUES(v_uid,p_character_id);
  INSERT INTO public.resource_transactions(student_id,resource_type,delta,action_code,reference_id)
    VALUES(v_uid,'stardust',-v_cost,'PURCHASE_CHARACTER',p_character_id);
  RETURN jsonb_build_object('character_id',p_character_id,'stardust_spent',v_cost);
END;
$function$;
REVOKE ALL ON FUNCTION public.purchase_character(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.purchase_character(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.purchase_skin(p_skin_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE v_uid uuid:=auth.uid(); v_cost integer; v_balance integer;
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (SELECT 1 FROM public.profiles
    WHERE id=v_uid AND role='student' AND account_status='active') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT gem_cost INTO v_cost FROM public.skins_catalog WHERE id=p_skin_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Skin not found'; END IF;
  IF EXISTS (SELECT 1 FROM public.student_skins WHERE student_id=v_uid AND skin_id=p_skin_id) THEN
    RAISE EXCEPTION 'Skin already owned';
  END IF;
  SELECT gems INTO v_balance FROM public.student_resources WHERE student_id=v_uid FOR UPDATE;
  IF NOT FOUND OR v_balance < v_cost THEN RAISE EXCEPTION 'Not enough gems'; END IF;
  UPDATE public.student_resources SET gems=gems-v_cost,updated_at=now() WHERE student_id=v_uid;
  INSERT INTO public.student_skins(student_id,skin_id) VALUES(v_uid,p_skin_id);
  INSERT INTO public.resource_transactions(student_id,resource_type,delta,action_code,reference_id)
    VALUES(v_uid,'gems',-v_cost,'PURCHASE_SKIN',p_skin_id);
  RETURN jsonb_build_object('skin_id',p_skin_id,'gems_spent',v_cost);
END;
$function$;
REVOKE ALL ON FUNCTION public.purchase_skin(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.purchase_skin(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.equip_character(p_character_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE v_uid uuid:=auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (SELECT 1 FROM public.profiles
    WHERE id=v_uid AND role='student' AND account_status='active') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.student_characters
    WHERE student_id=v_uid AND character_id=p_character_id) THEN RAISE EXCEPTION 'Character not owned'; END IF;
  UPDATE public.student_characters SET is_equipped=(character_id=p_character_id) WHERE student_id=v_uid;
  RETURN jsonb_build_object('equipped_character_id',p_character_id);
END;
$function$;
REVOKE ALL ON FUNCTION public.equip_character(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.equip_character(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.equip_skin(p_skin_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE v_uid uuid:=auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (SELECT 1 FROM public.profiles
    WHERE id=v_uid AND role='student' AND account_status='active') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.student_skins
    WHERE student_id=v_uid AND skin_id=p_skin_id) THEN RAISE EXCEPTION 'Skin not owned'; END IF;
  UPDATE public.student_skins SET is_equipped=(skin_id=p_skin_id) WHERE student_id=v_uid;
  RETURN jsonb_build_object('equipped_skin_id',p_skin_id);
END;
$function$;
REVOKE ALL ON FUNCTION public.equip_skin(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.equip_skin(text) TO authenticated;


-- Teachers may see only the profiles of students enrolled in their own classes.
DROP POLICY IF EXISTS profiles_teacher_read_students ON public.profiles;
CREATE POLICY profiles_teacher_read_students ON public.profiles
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.class_enrollments ce
      JOIN public.classes cl ON cl.id=ce.class_id
      WHERE ce.student_id=profiles.id
        AND cl.teacher_id=auth.uid()
        AND public.is_active_teacher()
    )
  );


CREATE OR REPLACE FUNCTION public.admin_set_account_status(p_target_user uuid,p_status text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE v_uid uuid:=auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT public.is_platform_admin() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF p_target_user IS NULL OR p_target_user=v_uid THEN RAISE EXCEPTION 'Cannot change own account status'; END IF;
  IF p_status NOT IN ('active','suspended','deactivated') THEN RAISE EXCEPTION 'Invalid account status'; END IF;
  UPDATE public.profiles SET account_status=p_status WHERE id=p_target_user;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found'; END IF;
  INSERT INTO public.platform_audit_logs(actor_id,action,target_table,target_id,details)
    VALUES(v_uid,'account_status_changed','profiles',p_target_user::text,
      jsonb_build_object('account_status',p_status));
  RETURN jsonb_build_object('user_id',p_target_user,'account_status',p_status);
END;
$function$;
REVOKE ALL ON FUNCTION public.admin_set_account_status(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_set_account_status(uuid,text) TO authenticated;


-- Pin search_path for the pre-existing SECURITY DEFINER resource and trigger functions.
ALTER FUNCTION public.apply_learning_action_reward(text,text)
  SET search_path = pg_catalog, public;
ALTER FUNCTION public.sync_student_stamina_and_rockets(text)
  SET search_path = pg_catalog, public;
ALTER FUNCTION public.use_rocket_supply()
  SET search_path = pg_catalog, public;
ALTER FUNCTION public.handle_new_user_profile()
  SET search_path = pg_catalog, public;
REVOKE ALL ON FUNCTION public.handle_new_user_profile() FROM PUBLIC, anon, authenticated;
