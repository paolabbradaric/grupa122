-- Google identiteti koriste postojeći users.auth_id: google:<sub>.
-- Pokretanje je ponovljivo; postojeći korisnici i oglasi ostaju sačuvani.
CREATE SCHEMA IF NOT EXISTS app_private;
REVOKE ALL ON SCHEMA app_private FROM PUBLIC;

CREATE TABLE IF NOT EXISTS app_private.sessions (
  sid VARCHAR NOT NULL PRIMARY KEY,
  sess JSON NOT NULL,
  expire TIMESTAMP(6) NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_expire_idx ON app_private.sessions (expire);
ALTER TABLE app_private.sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON app_private.sessions FROM PUBLIC;

ALTER TABLE public.organisations ADD COLUMN IF NOT EXISTS location VARCHAR(255);
CREATE INDEX IF NOT EXISTS organisations_owner_id_idx ON public.organisations (owner_id);

-- Browser ne pristupa ovim tablicama preko Supabase Data API-ja.
-- Express koristi postojeću serversku PG vezu (vlasnik tablica / BYPASSRLS).
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organisations ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE api_role TEXT;
BEGIN
  FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
      EXECUTE format('REVOKE ALL ON SCHEMA app_private FROM %I', api_role);
      EXECUTE format('REVOKE ALL ON app_private.sessions FROM %I', api_role);
      EXECUTE format('REVOKE ALL ON public.users, public.candidate_profiles, public.organisations FROM %I', api_role);
    END IF;
  END LOOP;
END;
$$;
