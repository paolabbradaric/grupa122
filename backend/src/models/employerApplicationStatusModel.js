
const pool = require('../config/db');

const allowedTransitions = {
  SUBMITTED: ['UNDER_REVIEW', 'REJECTED'],
  UNDER_REVIEW: ['SHORTLISTED', 'REJECTED'],
  SHORTLISTED: ['INVITED', 'REJECTED'],
  INVITED: ['AUDITIONED', 'REJECTED'],
  AUDITIONED: ['REJECTED']
};

function createEmployerApplicationStatusModel(database = pool) {
  return {
    async changeStatus(employerId, castingId, applicationId, newStatus, rejectionReason = null) {
      const client = await database.connect();

      try {
        await client.query('BEGIN');

        // Provjera vlasništva oglasa.
        const castingResult = await client.query(`
          SELECT c.id, c.status
          FROM casting_calls c
          JOIN projects p ON p.id = c.project_id
          JOIN organisations o ON o.id = p.org_id
          WHERE c.id = $1 AND o.owner_id = $2
          FOR UPDATE OF c
        `, [castingId, employerId]);

        const casting = castingResult.rows[0];

        if (!casting) {
          await client.query('ROLLBACK');
          return { outcome: 'not_found' };
        }

        if (!['published', 'closed'].includes(casting.status)) {
          await client.query('ROLLBACK');
          return { outcome: 'invalid_casting_status' };
        }

        // Dohvat i zaključavanje prijave.
        const applicationResult = await client.query(`
          SELECT id, status
          FROM applications
          WHERE id = $1 AND casting_call_id = $2
          FOR UPDATE
        `, [applicationId, castingId]);

        const application = applicationResult.rows[0];

        if (!application) {
          await client.query('ROLLBACK');
          return { outcome: 'application_not_found' };
        }

        const allowed = allowedTransitions[application.status] || [];

        if (!allowed.includes(newStatus)) {
          await client.query('ROLLBACK');
          return { outcome: 'invalid_transition' };
        }

        if (newStatus === 'REJECTED' && !rejectionReason?.trim()) {
          await client.query('ROLLBACK');
          return { outcome: 'reason_required' };
        }

        // Spremanje novog statusa.
        await client.query(`
          UPDATE applications
          SET status = $1,
              rejection_reason = $2,
              updated_at = NOW()
          WHERE id = $3
        `, [
          newStatus,
          newStatus === 'REJECTED' ? rejectionReason.trim() : null,
          applicationId
        ]);

        // Evidencija promjene statusa.
        await client.query(`
          INSERT INTO application_status_history
            (old_status, new_status, reason, application_id, changed_by)
          VALUES ($1, $2, $3, $4, $5)
        `, [
          application.status,
          newStatus,
          newStatus === 'REJECTED' ? rejectionReason.trim() : null,
          applicationId,
          employerId
        ]);

        await client.query('COMMIT');

        return {
          outcome: 'updated',
          applicationId,
          oldStatus: application.status,
          newStatus
        };

      } catch (error) {
        try {
          await client.query('ROLLBACK');
        } catch {
          // Zadržavamo izvornu grešku.
        }
        throw error;
      } finally {
        client.release();
      }
    }
  };
}

module.exports = {
  createEmployerApplicationStatusModel,
  allowedTransitions
};
