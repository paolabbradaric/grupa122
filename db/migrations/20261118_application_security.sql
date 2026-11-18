-- The caller owns the transaction (migrate-security.js or psql --single-transaction).
-- No grants, policy replacement, ownership changes or functional schema changes.
DO $security$
DECLARE
  required_tables text[] := ARRAY[
    'public.users', 'public.candidate_profiles', 'public.organisations',
    'public.projects', 'public.casting_calls', 'public.applications',
    'public.audition_slots', 'public.audition_bookings', 'public.notifications',
    'public.media_files', 'public.verification', 'public.skills',
    'public.candidate_skills', 'public.casting_call_status_history',
    'public.casting_call_skills', 'public.application_files',
    'public.application_status_history', 'app_private.sessions'
  ];
  optional_tables text[] := ARRAY[
    'public.profile_media', 'public.profile_storage_objects', 'public.casting_reports',
    'app_private.moderation_events', 'app_private.moderation_file_cleanup',
    'app_private.application_submission_limits'
  ];
  sensitive_tables text[] := ARRAY[
    'public.users', 'public.candidate_profiles', 'public.organisations',
    'public.media_files', 'public.verification', 'app_private.sessions'
  ] || optional_tables;
  targets text[] := required_tables;
  target text;
  api_role record;
  policy record;
BEGIN
  PERFORM set_config('lock_timeout', '5s', true);
  -- Validate the complete baseline before making any security changes.
  FOREACH target IN ARRAY required_tables LOOP
    IF to_regclass(target) IS NULL THEN
      RAISE EXCEPTION 'Security migration: required table % is missing; apply the base schema and auth migration first.', target;
    END IF;
  END LOOP;
  FOREACH target IN ARRAY optional_tables LOOP
    IF to_regclass(target) IS NOT NULL THEN
      targets := array_append(targets, target);
    END IF;
  END LOOP;
  -- Lock every target before inspecting policies so concurrent DDL cannot change
  -- the checked contract between preflight and ALTER TABLE. Names are fixed above.
  FOREACH target IN ARRAY targets LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE oid=to_regclass(target) AND relkind IN ('r','p')) THEN
      RAISE EXCEPTION 'Security migration: expected an application table at %.', target;
    END IF;
    EXECUTE format('LOCK TABLE %s IN ACCESS EXCLUSIVE MODE', target);
  END LOOP;

  FOR api_role IN SELECT oid, rolname, rolsuper, rolbypassrls FROM pg_roles
    WHERE rolname IN ('anon', 'authenticated') LOOP
    IF api_role.rolsuper OR api_role.rolbypassrls OR EXISTS (
      SELECT 1 FROM pg_class WHERE oid=ANY(
        ARRAY(SELECT to_regclass(t) FROM unnest(targets) t))
        AND pg_has_role(api_role.oid, relowner, 'USAGE')
    ) THEN
      RAISE EXCEPTION 'Security migration: API role % can bypass RLS; resolve its role or ownership separately.', api_role.rolname;
    END IF;
  END LOOP;

  -- Preserve policies for other roles, restrictive policies, and provably closed
  -- permissive policies. Arbitrary expressions cannot safely be proved false.
  FOR policy IN
    SELECT p.*, p.polrelid::regclass AS table_name,
      pg_get_expr(p.polqual,p.polrelid) AS using_expression,
      pg_get_expr(p.polwithcheck,p.polrelid) AS check_expression
    FROM pg_policy p
    WHERE p.polrelid=ANY(ARRAY(SELECT to_regclass(t) FROM unnest(targets) t))
      AND p.polpermissive
      AND (0=ANY(p.polroles) OR EXISTS (
        SELECT 1 FROM pg_roles r, unnest(p.polroles) role_oid
        WHERE r.rolname IN ('anon','authenticated') AND role_oid<>0
          AND pg_has_role(r.oid,role_oid,'MEMBER')
      ))
  LOOP
    IF (policy.polcmd IN ('r','w','d','*') AND policy.using_expression IS DISTINCT FROM 'false')
      OR (policy.polcmd IN ('a','w','*') AND
        COALESCE(policy.check_expression,policy.using_expression) IS DISTINCT FROM 'false') THEN
      RAISE EXCEPTION 'Security migration: API policy % on % is not provably closed; review it separately before retrying.',
        policy.polname, policy.table_name;
    END IF;
  END LOOP;

  FOREACH target IN ARRAY targets LOOP
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', target);
  END LOOP;
  REVOKE ALL ON SCHEMA app_private FROM PUBLIC;
  FOREACH target IN ARRAY sensitive_tables LOOP
    IF to_regclass(target) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON TABLE %s FROM PUBLIC', target);
    END IF;
  END LOOP;
  FOR api_role IN SELECT oid, rolname FROM pg_roles WHERE rolname IN ('anon','authenticated') LOOP
    EXECUTE format('REVOKE ALL ON SCHEMA app_private FROM %I', api_role.rolname);
    FOREACH target IN ARRAY sensitive_tables LOOP
      IF to_regclass(target) IS NOT NULL THEN
        EXECUTE format('REVOKE ALL ON TABLE %s FROM %I', target, api_role.rolname);
        -- Direct REVOKE cannot remove privileges inherited from another role.
        IF has_table_privilege(api_role.oid, to_regclass(target),
          'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
          OR has_any_column_privilege(api_role.oid, to_regclass(target), 'SELECT,INSERT,UPDATE,REFERENCES') THEN
          RAISE EXCEPTION 'Security migration: API role % retains inherited or column privileges on %; resolve those grants separately.', api_role.rolname, target;
        END IF;
      END IF;
    END LOOP;
    IF has_schema_privilege(api_role.oid,'app_private','USAGE,CREATE') THEN
      RAISE EXCEPTION 'Security migration: API role % retains inherited privileges on app_private; resolve those grants separately.', api_role.rolname;
    END IF;
  END LOOP;
END
$security$;
