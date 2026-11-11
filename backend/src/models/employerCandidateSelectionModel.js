'use strict';
const pool = require('../config/db');

function createEmployerCandidateSelectionModel(database = pool) {
  return {
    async select(userId, castingId, applicationId) {
      const client = await database.connect();
      let transaction = false;
      try {
        await client.query('BEGIN');
        transaction = true;
        // Zakljucavanje oglasa serijalizira odabire za isti oglas.
        const { rows: [casting] } = await client.query(`
          SELECT c.id, c.status, c.positions_count
          FROM casting_calls c
          JOIN projects p ON p.id = c.project_id
          JOIN organisations o ON o.id = p.org_id
          WHERE c.id = $1 AND o.owner_id = $2
          FOR UPDATE OF c`, [castingId, userId]);
        if (!casting) {
          await client.query('ROLLBACK'); transaction = false;
          return { outcome: 'not_found' };
        }
        if (!['published', 'closed'].includes(casting.status)) {
          await client.query('ROLLBACK'); transaction = false;
          return { outcome: 'invalid_status' };
        }
        const { rows: [application] } = await client.query(`
          SELECT id, status FROM applications
          WHERE id = $1 AND casting_call_id = $2
          FOR UPDATE`, [applicationId, castingId]);
        if (!application) {
          await client.query('ROLLBACK'); transaction = false;
          return { outcome: 'application_not_found' };
        }
        if (application.status === 'SELECTED') {
          await client.query('ROLLBACK'); transaction = false;
          return { outcome: 'already_selected' };
        }
        if (application.status !== 'SUBMITTED') {
          await client.query('ROLLBACK'); transaction = false;
          return { outcome: 'invalid_application_status' };
        }
        const { rows: [counts] } = await client.query(`
          SELECT COUNT(*)::int AS total FROM applications
          WHERE casting_call_id = $1 AND status = 'SELECTED'`, [castingId]);
        if (counts.total >= casting.positions_count) {
          await client.query('ROLLBACK'); transaction = false;
          return { outcome: 'positions_filled' };
        }
        await client.query(`
          UPDATE applications SET status = 'SELECTED', updated_at = NOW()
          WHERE id = $1`, [applicationId]);
        await client.query(`
          INSERT INTO application_status_history
            (old_status, new_status, reason, application_id, changed_by)
          VALUES ($1, 'SELECTED', $2, $3, $4)`,
          [application.status, 'Kandidata odabrao poslodavac.', applicationId, userId]);
        const selectedCount = counts.total + 1;
        let castingStatus = casting.status;
        if (selectedCount >= casting.positions_count) {
          await client.query(`
            UPDATE casting_calls SET status = 'filled', updated_at = NOW()
            WHERE id = $1`, [castingId]);
          await client.query(`
            INSERT INTO casting_call_status_history
              (old_status, new_status, reason, casting_call_id, changed_by)
            VALUES ($1, 'filled', $2, $3, $4)`,
            [casting.status, 'Odabran potreban broj kandidata.', castingId, userId]);
          castingStatus = 'filled';
        }
        await client.query('COMMIT'); transaction = false;
        return { outcome: 'selected', id: applicationId, status: 'SELECTED',
          castingStatus, selectedCount, positionsCount: casting.positions_count };
      } catch (error) {
        if (transaction) {
          try { await client.query('ROLLBACK'); } catch { /* izvorna greska */ }
        }
        throw error;
      } finally {
        client.release();
      }
    }
  };
}
module.exports = { createEmployerCandidateSelectionModel };
