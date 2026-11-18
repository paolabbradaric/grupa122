BEGIN;

-- Isti redak prijave serijalizira povlačenje i aktivaciju rezervacije.
-- SECURITY INVOKER poštuje ovlasti i RLS pozivatelja; nema podizanja ovlasti.
CREATE OR REPLACE FUNCTION guard_active_audition_booking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
DECLARE
  application_status text;
BEGIN
  IF NEW.status IN ('cancelled', 'canceled') THEN
    RETURN NEW;
  END IF;

  -- Nova verzija retka sprječava i zastarjelu sliku podataka pri REPEATABLE READ.
  -- Vrijednost ID-ja ostaje ista; ne mijenjamo status, updated_at ni povijest.
  EXECUTE format('UPDATE %I.applications SET id = id WHERE id = $1 RETURNING status', TG_TABLE_SCHEMA)
    INTO application_status USING NEW.application_id;
  IF application_status IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '23503',
      MESSAGE = 'Application is unavailable for this booking.';
  END IF;
  IF application_status = 'WITHDRAWN' THEN
    RAISE EXCEPTION USING ERRCODE = '23514',
      CONSTRAINT = 'audition_bookings_application_not_withdrawn',
      MESSAGE = 'An active booking cannot belong to a withdrawn application.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION guard_application_withdrawal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
DECLARE
  active_bookings boolean;
BEGIN
  EXECUTE format(
    'SELECT EXISTS (SELECT 1 FROM %I.audition_bookings WHERE application_id = $1 AND status NOT IN (''cancelled'', ''canceled''))',
    TG_TABLE_SCHEMA)
    INTO active_bookings USING NEW.id;
  IF active_bookings THEN
    RAISE EXCEPTION USING ERRCODE = '23514',
      CONSTRAINT = 'applications_withdrawal_without_active_bookings',
      MESSAGE = 'An application with an active booking cannot be withdrawn.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audition_bookings_withdrawal_guard ON audition_bookings;
CREATE TRIGGER audition_bookings_withdrawal_guard
  BEFORE INSERT OR UPDATE OF application_id, status ON audition_bookings
  FOR EACH ROW EXECUTE FUNCTION guard_active_audition_booking();

DROP TRIGGER IF EXISTS applications_withdrawal_guard ON applications;
CREATE TRIGGER applications_withdrawal_guard
  BEFORE UPDATE OF status ON applications
  FOR EACH ROW WHEN (NEW.status = 'WITHDRAWN')
  EXECUTE FUNCTION guard_application_withdrawal();

-- Ne proglašavaj zaštitu spremnom ako postoje nedosljedni stari zapisi.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM applications a JOIN audition_bookings b ON b.application_id = a.id
    WHERE a.status = 'WITHDRAWN' AND b.status NOT IN ('cancelled', 'canceled')
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514',
      MESSAGE = 'Resolve active bookings on withdrawn applications before applying this migration.';
  END IF;
END;
$$;

COMMIT;
