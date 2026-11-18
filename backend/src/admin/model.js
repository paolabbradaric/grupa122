const { AuthError } = require('../auth/errors');
const fail = (status, code, message) => { throw new AuthError(status, code, message); };
const verificationColumns = `v.id, v.org_id AS "orgId", v.status,
  v.submitted_at AS "submittedAt", v.reviewed_at AS "reviewedAt",
  v.reviewed_by AS "reviewedBy", v.rejection_reason AS "rejectionReason",
  v.submitted_data AS "submittedData"`;
const snapshot = org => Object.fromEntries(
  ['company_name', 'reg_num', 'contact_email', 'phone', 'website', 'location'].map(key => [key, org[key] ?? null]));

function createModerationModel(pool) {
  async function transaction(action) {
    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      const result = await action(c);
      await c.query('COMMIT');
      return result;
    } catch (error) {
      try { await c.query('ROLLBACK'); } catch { /* Sačuvaj izvornu grešku. */ }
      throw error;
    } finally { c.release(); }
  }
  async function event(c, actor, action, entityId, reason = null) {
    await c.query(`INSERT INTO app_private.moderation_events(actor_id,action,entity_id,reason)
      VALUES($1,$2,$3,$4)`, [actor, action, entityId, reason]);
  }
  async function notify(c, userId, type, title, message) {
    await c.query(`INSERT INTO notifications(user_id,type,title,message) VALUES($1,$2,$3,$4)`,
      [userId, type, title, message]);
  }
  async function organisation(c, userId, lock = false) {
    const { rows: [org] } = await c.query(`SELECT o.* FROM organisations o
      JOIN users u ON u.id=o.owner_id WHERE o.owner_id=$1 AND u.deleted_at IS NULL
      AND u.role='employer' ORDER BY o.id LIMIT 1 ${lock ? 'FOR UPDATE OF o' : ''}`, [userId]);
    if (!org) fail(404, 'ORGANISATION_NOT_FOUND', 'Organizacija nije pronađena.');
    return org;
  }
  async function latest(c, orgId) {
    const { rows: [v] } = await c.query(`SELECT ${verificationColumns} FROM verification v
      WHERE v.org_id=$1 ORDER BY v.submitted_at DESC,v.id DESC LIMIT 1`, [orgId]);
    return v || null;
  }
  async function mine(userId) {
    const org = await organisation(pool, userId);
    return { verification: await latest(pool, org.id) };
  }
  async function submit(userId) {
    return transaction(async c => {
      const org = await organisation(c, userId, true);
      const previous = await latest(c, org.id);
      if (previous && previous.status !== 'rejected')
        fail(409, 'VERIFICATION_EXISTS', 'Zahtjev je već u obradi ili je tvrtka verificirana.');
      if (['company_name', 'reg_num', 'contact_email', 'phone', 'location']
        .some(key => typeof org[key] !== 'string' || !org[key].trim()))
        fail(409, 'INCOMPLETE_ORGANISATION', 'Prije slanja spremi sve obavezne podatke tvrtke.');
      const { rows: [v] } = await c.query(`INSERT INTO verification AS v(status,org_id,submitted_data)
        VALUES('pending',$1,$2) RETURNING ${verificationColumns}`, [org.id, snapshot(org)]);
      return { verification: v };
    });
  }
  async function verifications({ status, limit, offset }) {
    const { rows } = await pool.query(`SELECT ${verificationColumns},o.company_name AS "companyName",
      o.reg_num AS "regNum",o.contact_email AS "contactEmail",o.phone,o.location,o.website,
      count(*) OVER()::int AS total
      FROM verification v JOIN organisations o ON o.id=v.org_id
      JOIN users u ON u.id=o.owner_id AND u.deleted_at IS NULL
      WHERE v.id=(SELECT v2.id FROM verification v2 WHERE v2.org_id=o.id
        ORDER BY v2.submitted_at DESC,v2.id DESC LIMIT 1)
      AND ($1::text IS NULL OR v.status=$1)
      ORDER BY v.submitted_at DESC,v.id DESC LIMIT $2 OFFSET $3`, [status, limit, offset]);
    return { items: rows.map(({ total, ...row }) => row), hasMore: rows.length === limit };
  }
  async function reviewVerification(actorId, verificationId, status, rejectionReason) {
    return transaction(async c => {
      const { rows: [reference] } = await c.query(`SELECT v.org_id,o.owner_id FROM verification v
        JOIN organisations o ON o.id=v.org_id WHERE v.id=$1`, [verificationId]);
      if (!reference) fail(404, 'VERIFICATION_NOT_FOUND', 'Zahtjev nije pronađen.');
      // Profil prvo zaključava korisnika pa organizaciju. Zadrži isti redoslijed:
      // obavijest vlasniku također provjerava FK prema users i inače može nastati deadlock.
      const owner = await c.query(`SELECT id FROM users WHERE id=$1
        AND role='employer' AND deleted_at IS NULL FOR UPDATE`, [reference.owner_id]);
      if (!owner.rowCount) fail(404, 'ORGANISATION_NOT_FOUND', 'Organizacija nije pronađena.');
      const { rows: [org] } = await c.query(`SELECT o.* FROM organisations o JOIN users u ON u.id=o.owner_id
        WHERE o.id=$1 AND o.owner_id=$2 AND u.deleted_at IS NULL FOR UPDATE OF o`,
        [reference.org_id, reference.owner_id]);
      if (!org) fail(404, 'ORGANISATION_NOT_FOUND', 'Organizacija nije pronađena.');
      const v = await latest(c, org.id);
      if (!v || v.id !== verificationId || !['pending', 'under_review'].includes(v.status))
        fail(409, 'STALE_VERIFICATION', 'Zahtjev je već obrađen ili zamijenjen novijim.');
      if (v.status === 'under_review' && v.reviewedBy !== actorId)
        fail(409, 'OTHER_REVIEWER', 'Zahtjev je preuzeo drugi administrator.');
      if (status === 'under_review' && v.status !== 'pending')
        fail(409, 'INVALID_TRANSITION', 'Zahtjev je već u provjeri.');
      if (status !== 'under_review' && v.status !== 'under_review')
        fail(409, 'REVIEW_REQUIRED', 'Prvo preuzmi zahtjev u provjeru.');
      // Stari zahtjevi bez snimke mogu se odbiti i ponovno poslati, ali ne odobriti.
      if (status === 'approved' && (!v.submittedData ||
          Object.keys(snapshot(org)).some(key => v.submittedData[key] !== snapshot(org)[key])))
        fail(409, 'ORGANISATION_CHANGED', 'Podaci su promijenjeni. Odbij zahtjev i zatraži ponovno slanje.');
      const { rows: [updated] } = await c.query(`UPDATE verification AS v SET status=$1::varchar,
        reviewed_by=$2,reviewed_at=CASE WHEN $1::varchar='under_review' THEN NULL ELSE CURRENT_TIMESTAMP END,
        rejection_reason=$3 WHERE id=$4 RETURNING ${verificationColumns}`,
        [status, actorId, status === 'rejected' ? rejectionReason : null, verificationId]);
      await event(c, actorId, `verification_${status}`, verificationId, rejectionReason);
      if (status !== 'under_review') await notify(c, org.owner_id, 'verification', 'Verifikacija tvrtke',
        status === 'approved' ? 'Zahtjev za verifikaciju tvrtke je odobren.' : `Zahtjev je odbijen: ${rejectionReason}`.slice(0, 2000));
      return { verification: updated };
    });
  }
  async function report(userId, castingId, reason) {
    try {
      return await transaction(async c => {
        const { rows: [casting] } = await c.query(`SELECT c.id,c.title,o.owner_id FROM casting_calls c
          JOIN projects p ON p.id=c.project_id JOIN organisations o ON o.id=p.org_id
          WHERE c.id=$1 AND c.status='published' FOR UPDATE OF c`, [castingId]);
        if (!casting) fail(404, 'CASTING_NOT_FOUND', 'Objavljeni oglas nije pronađen.');
        if (casting.owner_id === userId) fail(403, 'OWN_CASTING', 'Vlastiti oglas ne možeš prijaviti.');
        const { rows: [created] } = await c.query(`INSERT INTO casting_reports
          (casting_call_id,casting_title,reporter_id,reason) VALUES($1,$2,$3,$4)
          RETURNING id,status,submitted_at AS "submittedAt"`, [castingId, casting.title, userId, reason]);
        return { report: created };
      });
    } catch (error) {
      if (error.code === '23505') fail(409, 'REPORT_EXISTS', 'Tvoja prijava ovog oglasa već čeka obradu.');
      throw error;
    }
  }
  async function reports({ status, limit, offset }) {
    const { rows } = await pool.query(`SELECT r.id,r.casting_call_id AS "castingId",
      r.casting_title AS "castingTitle",r.reason,r.status,r.submitted_at AS "submittedAt",
      r.reviewed_at AS "reviewedAt",r.reviewed_by AS "reviewedBy",r.review_note AS "reviewNote",
      o.company_name AS "companyName"
      FROM casting_reports r LEFT JOIN casting_calls c ON c.id=r.casting_call_id
      LEFT JOIN projects p ON p.id=c.project_id LEFT JOIN organisations o ON o.id=p.org_id
      WHERE ($1::text IS NULL OR r.status=$1) ORDER BY r.submitted_at DESC,r.id DESC
      LIMIT $2 OFFSET $3`, [status, limit, offset]);
    return { items: rows, hasMore: rows.length === limit };
  }
  async function dismissReport(actorId, reportId, reason) {
    return transaction(async c => {
      const { rows: [r] } = await c.query(`UPDATE casting_reports SET status='dismissed',reviewed_by=$1,
        reviewed_at=CURRENT_TIMESTAMP,review_note=$2 WHERE id=$3 AND status='open' RETURNING id,status`,
        [actorId, reason, reportId]);
      if (!r) fail(409, 'REPORT_ALREADY_REVIEWED', 'Prijava ne postoji ili je već obrađena.');
      await event(c, actorId, 'report_dismissed', reportId, reason);
      return { report: r };
    });
  }
  async function deleteCasting(actorId, castingId, reason) {
    return transaction(async c => {
      const { rows: [casting] } = await c.query(`SELECT c.id,c.title,c.project_id,o.owner_id
        FROM casting_calls c JOIN projects p ON p.id=c.project_id JOIN organisations o ON o.id=p.org_id
        WHERE c.id=$1 FOR UPDATE OF c,p`, [castingId]);
      if (!casting) fail(404, 'CASTING_NOT_FOUND', 'Oglas više ne postoji.');
      // Zaključavanje djece onemogućuje rezervaciju/prilaganje tijekom brisanja.
      const { rows: applications } = await c.query(`SELECT a.id,cp.user_id FROM applications a
        JOIN candidate_profiles cp ON cp.id=a.candidate_id WHERE a.casting_call_id=$1 FOR UPDATE OF a`, [castingId]);
      await c.query('SELECT id FROM audition_slots WHERE casting_call_id=$1 FOR UPDATE', [castingId]);
      const applicationIds = applications.map(a => a.id);
      // Uključuje i nekonzistentne stare rezervacije koje referenciraju termin ovog oglasa.
      const { rows: bookings } = await c.query(`SELECT b.id,cp.user_id FROM audition_bookings b
        JOIN applications a ON a.id=b.application_id JOIN candidate_profiles cp ON cp.id=a.candidate_id
        JOIN audition_slots s ON s.id=b.audition_slot_id
        WHERE a.id=ANY($1::int[]) OR s.casting_call_id=$2 FOR UPDATE OF b`, [applicationIds, castingId]);
      const bookingIds = bookings.map(b => b.id);
      const { rows: files } = await c.query(`SELECT DISTINCT m.id,m.storage_key FROM media_files m
        JOIN application_files f ON f.media_file_id=m.id WHERE f.application_id=ANY($1::int[])`, [applicationIds]);
      // FK redoslijed je izričit. Nijedan korisnik, profil ili organizacija se ne briše.
      await c.query(`DELETE FROM notifications WHERE casting_call_id=$1 OR application_id=ANY($2::int[])
        OR booking_id=ANY($3::int[])`, [castingId, applicationIds, bookingIds]);
      await c.query('DELETE FROM audition_bookings WHERE id=ANY($1::int[])', [bookingIds]);
      await c.query('DELETE FROM audition_slots WHERE casting_call_id=$1', [castingId]);
      await c.query('DELETE FROM application_status_history WHERE application_id=ANY($1::int[])', [applicationIds]);
      await c.query('DELETE FROM application_files WHERE application_id=ANY($1::int[])', [applicationIds]);
      await c.query('DELETE FROM applications WHERE casting_call_id=$1', [castingId]);
      await c.query('DELETE FROM casting_call_skills WHERE casting_call_id=$1', [castingId]);
      await c.query('DELETE FROM casting_call_status_history WHERE casting_call_id=$1', [castingId]);
      await c.query(`UPDATE casting_reports SET casting_call_id=NULL,
        reviewed_by=CASE WHEN status='open' THEN $2 ELSE reviewed_by END,
        reviewed_at=CASE WHEN status='open' THEN CURRENT_TIMESTAMP ELSE reviewed_at END,
        review_note=CASE WHEN status='open' THEN $3 ELSE review_note END,
        status=CASE WHEN status='open' THEN 'removed' ELSE status END WHERE casting_call_id=$1`,
        [castingId, actorId, reason]);
      await c.query('DELETE FROM casting_calls WHERE id=$1', [castingId]);
      await c.query(`DELETE FROM projects p WHERE id=$1 AND NOT EXISTS
        (SELECT 1 FROM casting_calls c WHERE c.project_id=p.id)`, [casting.project_id]);
      const { rows: removedFiles } = await c.query(`DELETE FROM media_files m WHERE id=ANY($1::int[])
        AND NOT EXISTS(SELECT 1 FROM application_files f WHERE f.media_file_id=m.id)
        AND NOT EXISTS(SELECT 1 FROM profile_media p WHERE p.media_id=m.id) RETURNING storage_key`, [files.map(f => f.id)]);
      let cleanupQueued = 0;
      for (const { storage_key } of removedFiles) {
        const queued = await c.query(`INSERT INTO app_private.moderation_file_cleanup(storage_key)
          SELECT $1::varchar WHERE NOT EXISTS(SELECT 1 FROM media_files WHERE storage_key=$1::varchar)
          ON CONFLICT DO NOTHING`, [storage_key]);
        cleanupQueued += queued.rowCount;
      }
      for (const userId of new Set([casting.owner_id, ...applications.map(a => a.user_id), ...bookings.map(b => b.user_id)]))
        await notify(c, userId, 'casting_removed', 'Oglas je uklonjen',
          `Oglas „${casting.title || castingId}” uklonjen je odlukom administratora. Razlog: ${reason}`.slice(0, 2000));
      await event(c, actorId, 'casting_deleted', castingId, reason);
      return { deleted: true, castingId, cleanupQueued };
    });
  }
  async function stats() {
    // Jedan SELECT daje dosljednu snimku svih agregata; nema osobnih podataka.
    const { rows: [result] } = await pool.query(`SELECT
      (SELECT count(*)::int FROM users WHERE deleted_at IS NULL) AS "activeUsers",
      (SELECT count(*)::int FROM users WHERE deleted_at IS NOT NULL) AS "disabledUsers",
      (SELECT coalesce(jsonb_object_agg(role,n),'{}'::jsonb) FROM
        (SELECT role,count(*)::int n FROM users WHERE deleted_at IS NULL GROUP BY role) x) AS "usersByRole",
      (SELECT coalesce(jsonb_object_agg(status,n),'{}'::jsonb) FROM
        (SELECT coalesce(v.status,'not_requested') status,count(*)::int n FROM organisations o
         JOIN users u ON u.id=o.owner_id AND u.deleted_at IS NULL
         LEFT JOIN LATERAL (SELECT status FROM verification WHERE org_id=o.id
           ORDER BY submitted_at DESC,id DESC LIMIT 1) v ON true GROUP BY coalesce(v.status,'not_requested')) x) AS verifications,
      (SELECT coalesce(jsonb_object_agg(status,n),'{}'::jsonb) FROM
        (SELECT status,count(*)::int n FROM casting_calls GROUP BY status) x) AS castings,
      (SELECT coalesce(jsonb_object_agg(status,n),'{}'::jsonb) FROM
        (SELECT status,count(*)::int n FROM applications GROUP BY status) x) AS applications,
      (SELECT coalesce(jsonb_object_agg(status,n),'{}'::jsonb) FROM
        (SELECT status,count(*)::int n FROM casting_reports GROUP BY status) x) AS reports,
      (SELECT count(*)::int FROM app_private.moderation_file_cleanup) AS "cleanupPending"`);
    return result;
  }
  return { mine, submit, verifications, reviewVerification, report, reports, dismissReport, deleteCasting, stats };
}
module.exports = { createModerationModel };
