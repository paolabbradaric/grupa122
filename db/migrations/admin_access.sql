-- Nepoznati osobni podaci dopušteni su samo administratorskim računima.
ALTER TABLE public.users ALTER COLUMN birth_date DROP NOT NULL;
ALTER TABLE public.users ALTER COLUMN first_name DROP NOT NULL;
ALTER TABLE public.users ALTER COLUMN last_name DROP NOT NULL;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.users'::regclass
                AND conname = 'users_personal_data_required') THEN
  ALTER TABLE public.users ADD CONSTRAINT users_personal_data_required CHECK (
   role = 'admin' OR (birth_date IS NOT NULL AND first_name IS NOT NULL AND last_name IS NOT NULL)
  );
 END IF;
END $$;
-- Sprječava sukobe i kada postojeća adresa ima drukčiju veličinu slova/razmake.
CREATE UNIQUE INDEX IF NOT EXISTS users_email_normalized_unique ON public.users (lower(btrim(email)));
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.users FROM PUBLIC;
DO $$ DECLARE api_role TEXT; BEGIN
 FOREACH api_role IN ARRAY ARRAY['anon','authenticated'] LOOP
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
   EXECUTE format('REVOKE ALL ON public.users FROM %I', api_role);
  END IF;
 END LOOP;
END $$;
