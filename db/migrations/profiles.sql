-- Nullable additions preserve existing profiles and application references.
ALTER TABLE candidate_profiles ADD COLUMN IF NOT EXISTS weight_kg NUMERIC(6,2) CHECK (weight_kg > 0);
ALTER TABLE candidate_profiles ADD COLUMN IF NOT EXISTS eye_color VARCHAR(20);
ALTER TABLE candidate_profiles ADD COLUMN IF NOT EXISTS hair_color VARCHAR(20);
CREATE UNIQUE INDEX IF NOT EXISTS candidate_profile_owner_pair ON candidate_profiles(id, user_id);
CREATE UNIQUE INDEX IF NOT EXISTS organisation_owner_pair ON organisations(id, owner_id);
CREATE UNIQUE INDEX IF NOT EXISTS media_owner_pair ON media_files(id, owner_user_id);
CREATE TABLE IF NOT EXISTS profile_media (
 media_id INT PRIMARY KEY,
 owner_user_id INT NOT NULL,
 candidate_id INT,
 org_id INT,
 purpose VARCHAR(10) NOT NULL CHECK (purpose IN ('avatar','portfolio','logo')),
 FOREIGN KEY (media_id, owner_user_id) REFERENCES media_files(id, owner_user_id),
 FOREIGN KEY (candidate_id, owner_user_id) REFERENCES candidate_profiles(id, user_id),
 FOREIGN KEY (org_id, owner_user_id) REFERENCES organisations(id, owner_id),
 CHECK ((purpose IN ('avatar','portfolio') AND candidate_id IS NOT NULL AND org_id IS NULL)
 OR (purpose = 'logo' AND org_id IS NOT NULL AND candidate_id IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS one_profile_avatar ON profile_media(candidate_id) WHERE purpose='avatar';
CREATE UNIQUE INDEX IF NOT EXISTS one_organisation_logo ON profile_media(org_id) WHERE purpose='logo';
-- Durable object ledger also records uploads interrupted before database linking.
CREATE TABLE IF NOT EXISTS profile_storage_objects (
 storage_key VARCHAR(500) PRIMARY KEY,
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE profile_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_storage_objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE organisations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON profile_media, profile_storage_objects, media_files, candidate_profiles, organisations, users FROM PUBLIC;
DO $$ DECLARE api_role TEXT; BEGIN
 FOREACH api_role IN ARRAY ARRAY['anon','authenticated'] LOOP
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=api_role) THEN
 EXECUTE format('REVOKE ALL ON profile_media, profile_storage_objects, media_files, candidate_profiles, organisations, users FROM %I', api_role);
 END IF; END LOOP;
END $$;
