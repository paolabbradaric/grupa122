BEGIN;

-- Optional additive field. Existing rows retain NULL; no data rewrite/backfill.
ALTER TABLE casting_calls ADD COLUMN IF NOT EXISTS role_genre VARCHAR(100);
DO $$
BEGIN
  IF (SELECT format_type(atttypid, atttypmod) FROM pg_attribute
      WHERE attrelid = 'casting_calls'::regclass AND attname = 'role_genre'
        AND NOT attisdropped) IS DISTINCT FROM 'character varying(100)'
    OR (SELECT attnotnull FROM pg_attribute
        WHERE attrelid = 'casting_calls'::regclass AND attname = 'role_genre'
          AND NOT attisdropped) THEN
    RAISE EXCEPTION 'Review the existing role_genre column type or nullability before applying this migration.';
  END IF;
END;
$$;

COMMIT;
