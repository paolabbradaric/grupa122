-- Only for rolling back an unused deployment. Never discard uploaded profile media.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM profile_media) OR EXISTS(SELECT 1 FROM profile_storage_objects)
 OR EXISTS(SELECT 1 FROM candidate_profiles WHERE weight_kg IS NOT NULL OR eye_color IS NOT NULL OR hair_color IS NOT NULL)
 THEN RAISE EXCEPTION 'Profile data exists; retain additive schema and roll back application code only'; END IF;
END $$;
DROP TABLE profile_media;
DROP TABLE profile_storage_objects;
DROP INDEX media_owner_pair;
DROP INDEX candidate_profile_owner_pair;
DROP INDEX organisation_owner_pair;
ALTER TABLE candidate_profiles DROP COLUMN weight_kg, DROP COLUMN eye_color, DROP COLUMN hair_color;
-- RLS and revoked API privileges intentionally remain in effect.
