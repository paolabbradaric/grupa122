BEGIN;

-- Abort without changing existing rows if historical bookings need repair.
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM audition_bookings WHERE status NOT IN ('cancelled','canceled')
    GROUP BY application_id HAVING count(*)>1) THEN
    RAISE EXCEPTION 'Resolve duplicate active bookings before installing the capacity guard.';
  END IF;
  IF EXISTS(SELECT 1 FROM audition_slots s JOIN audition_bookings b ON b.audition_slot_id=s.id
    WHERE b.status NOT IN ('cancelled','canceled') GROUP BY s.id,s.capacity HAVING count(*)>s.capacity) THEN
    RAISE EXCEPTION 'Resolve overbooked slots before installing the capacity guard.';
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS one_active_application_booking ON audition_bookings(application_id)
  WHERE status NOT IN ('cancelled','canceled');

CREATE OR REPLACE FUNCTION guard_audition_booking_capacity()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE casting_id int; casting_status text; application_status text;
  slot_capacity int; slot_status text; slot_start timestamptz; active_count int;
BEGIN
  IF NEW.status IN ('cancelled','canceled') THEN RETURN NEW; END IF;
  EXECUTE format('SELECT casting_call_id FROM %I.audition_slots WHERE id=$1',TG_TABLE_SCHEMA)
    INTO casting_id USING NEW.audition_slot_id;
  IF casting_id IS NULL THEN RAISE EXCEPTION USING ERRCODE='23503',MESSAGE='Audition slot is unavailable.'; END IF;
  EXECUTE format('UPDATE %I.casting_calls SET id=id WHERE id=$1 RETURNING status',TG_TABLE_SCHEMA)
    INTO casting_status USING casting_id;
  EXECUTE format('SELECT status FROM %I.applications WHERE id=$1 AND casting_call_id=$2 FOR UPDATE',TG_TABLE_SCHEMA)
    INTO application_status USING NEW.application_id,casting_id;
  EXECUTE format('SELECT capacity,status,starts_at FROM %I.audition_slots WHERE id=$1 FOR UPDATE',TG_TABLE_SCHEMA)
    INTO slot_capacity,slot_status,slot_start USING NEW.audition_slot_id;
  IF casting_status NOT IN ('published','closed') OR application_status IS DISTINCT FROM 'INVITED'
    OR slot_status IS DISTINCT FROM 'scheduled' OR slot_start<=statement_timestamp() THEN
    RAISE EXCEPTION USING ERRCODE='23514',CONSTRAINT='audition_booking_eligible',MESSAGE='Audition booking is not available.';
  END IF;
  EXECUTE format('SELECT count(*) FROM %I.audition_bookings WHERE audition_slot_id=$1 AND id IS DISTINCT FROM $2 AND status NOT IN (''cancelled'',''canceled'')',TG_TABLE_SCHEMA)
    INTO active_count USING NEW.audition_slot_id,NEW.id;
  IF active_count>=slot_capacity THEN
    RAISE EXCEPTION USING ERRCODE='23514',CONSTRAINT='audition_booking_capacity',MESSAGE='Audition capacity exceeded.';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS audition_bookings_capacity_guard ON audition_bookings;
CREATE TRIGGER audition_bookings_capacity_guard BEFORE INSERT OR UPDATE OF application_id,audition_slot_id,status ON audition_bookings
  FOR EACH ROW EXECUTE FUNCTION guard_audition_booking_capacity();
COMMIT;
