BEGIN;

ALTER TABLE casting_calls
  ADD COLUMN max_applications INTEGER NOT NULL DEFAULT 1000;

ALTER TABLE casting_calls
  ADD CONSTRAINT max_applications_positive
  CHECK (max_applications > 0);

ALTER TABLE casting_calls
  ADD CONSTRAINT project_unique
  UNIQUE (project_id);

-- Uskladi nazive postojećih ograničenja s novom shemom.
ALTER TABLE candidate_profiles
  RENAME CONSTRAINT candidate_profiles_user_unique TO profile_user_unique;
ALTER TABLE applications
  RENAME CONSTRAINT applications_candidate_call_unique TO application_unique;
ALTER TABLE casting_calls
  RENAME CONSTRAINT casting_calls_positions_positive TO positions_positive;
ALTER TABLE casting_calls
  RENAME CONSTRAINT casting_calls_age_range TO age_range;
ALTER TABLE audition_slots
  RENAME CONSTRAINT audition_slots_capacity_positive TO slot_capacity_positive;
ALTER TABLE audition_slots
  RENAME CONSTRAINT audition_slots_time_range TO slot_time_range;

COMMIT;
