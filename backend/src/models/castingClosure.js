// Caller holds the casting row lock. Booking and slot writers lock that row
// first as well, so no new booking can slip between closure and cancellation.
async function closeCastingDependents(client, castingId, kind, actorId) {
  const cancelled = kind === "cancelled";
  const reason = cancelled
    ? "Oglas je otkazan."
    : "Oglas je popunjen; odabran je potreban broj kandidata.";
  const status = cancelled ? "CANCELLED" : "REJECTED";
  await client.query(
    `WITH previous AS MATERIALIZED (
      SELECT id,status FROM applications WHERE casting_call_id=$1
        AND status NOT IN ('WITHDRAWN','REJECTED','CANCELLED'${cancelled ? "" : ",'ACCEPTED','SELECTED'"})
      ORDER BY id FOR UPDATE
    ), changed AS (
      UPDATE applications a SET status=$2,rejection_reason=$3,updated_at=NOW()
      FROM previous p WHERE a.id=p.id RETURNING a.id,p.status AS old_status
    ), history AS (
      INSERT INTO application_status_history(old_status,new_status,reason,application_id,changed_by)
      SELECT old_status,$2,$3,id,$4 FROM changed RETURNING application_id
    ) INSERT INTO notifications(user_id,type,title,message,application_id,casting_call_id)
      SELECT cp.user_id,'application_status',$3,$3,a.id,$1 FROM history h
      JOIN applications a ON a.id=h.application_id JOIN candidate_profiles cp ON cp.id=a.candidate_id`,
    [castingId, status, reason, actorId],
  );
  await client.query(
    `WITH cancelled AS (
      UPDATE audition_bookings b SET status='cancelled',cancelled_at=NOW()
      FROM audition_slots s WHERE b.audition_slot_id=s.id AND s.casting_call_id=$1
        AND s.starts_at>NOW() AND b.status NOT IN ('cancelled','canceled')
      RETURNING b.id,b.application_id
    ) INSERT INTO notifications(user_id,type,title,message,application_id,casting_call_id,booking_id)
      SELECT cp.user_id,'audition_cancelled','Audicija je otkazana.',$2,a.id,$1,b.id
      FROM cancelled b JOIN applications a ON a.id=b.application_id
      JOIN candidate_profiles cp ON cp.id=a.candidate_id`,
    [castingId, reason],
  );
  await client.query(
    `UPDATE audition_slots SET status='cancelled'
    WHERE casting_call_id=$1 AND starts_at>NOW() AND status<>'cancelled'`,
    [castingId],
  );
}
module.exports = { closeCastingDependents };
