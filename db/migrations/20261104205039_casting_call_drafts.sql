BEGIN;

SET LOCAL lock_timeout = '5s';

-- Samo nacrti smiju biti nepotpuni; ostali statusi zadržavaju obavezna polja.
ALTER TABLE casting_calls
  ALTER COLUMN title DROP NOT NULL,
  ALTER COLUMN description DROP NOT NULL,
  ALTER COLUMN positions_count DROP NOT NULL,
  ALTER COLUMN min_age DROP NOT NULL,
  ALTER COLUMN max_age DROP NOT NULL,
  ALTER COLUMN location DROP NOT NULL,
  ALTER COLUMN application_deadline DROP NOT NULL,
  DROP CONSTRAINT age_range,
  DROP CONSTRAINT IF EXISTS casting_calls_complete_unless_draft;

-- Provjeri i pojedinačno unesenu dob, dok drugi kraj raspona još nedostaje.
ALTER TABLE casting_calls
  ADD CONSTRAINT age_range CHECK (
    (min_age IS NULL OR min_age >= 18)
    AND (max_age IS NULL OR max_age >= 18)
    AND (min_age IS NULL OR max_age IS NULL OR max_age >= min_age)
  ),
  ADD CONSTRAINT casting_calls_complete_unless_draft CHECK (
    status = 'draft' OR (
      title IS NOT NULL AND title ~ '[^[:space:]]'
      AND description IS NOT NULL AND description ~ '[^[:space:]]'
      AND positions_count IS NOT NULL
      AND min_age IS NOT NULL AND max_age IS NOT NULL
      AND location IS NOT NULL AND location ~ '[^[:space:]]'
      AND application_deadline IS NOT NULL
    )
  );

COMMIT;
