BEGIN;

CREATE SCHEMA IF NOT EXISTS app_private;
REVOKE ALL ON SCHEMA app_private FROM PUBLIC;
CREATE TABLE IF NOT EXISTS app_private.application_submission_limits (
  user_id INT PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  total_hits INT NOT NULL CHECK (total_hits >= 0),
  reset_at TIMESTAMPTZ NOT NULL
);
ALTER TABLE app_private.application_submission_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON app_private.application_submission_limits FROM PUBLIC;
DO $$
DECLARE api_role TEXT;
BEGIN
  FOR api_role IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated') LOOP
    EXECUTE format('REVOKE ALL ON app_private.application_submission_limits FROM %I', api_role);
  END LOOP;
END $$;

COMMIT;
