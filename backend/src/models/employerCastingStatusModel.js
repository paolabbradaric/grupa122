const pool = require('../config/db');
const { closeCastingDependents } = require('./castingClosure');

// Statusi su na engleskom, jednako kao u ostalom backendu.
function createEmployerCastingStatusModel(database = pool) {
  async function transition(userId, castingId, action) {
    const client = await database.connect();
    let begun = false;
    try {
      await client.query('BEGIN');
      begun = true;
      const { rows: [casting] } = await client.query(`
        SELECT c.id, c.status
        FROM casting_calls c
        JOIN projects p ON p.id = c.project_id
        JOIN organisations o ON o.id = p.org_id
        WHERE c.id = $1 AND o.owner_id = $2
        FOR UPDATE OF c`, [castingId, userId]);

      if (!casting) {
        await client.query('ROLLBACK'); begun = false;
        return { outcome: 'not_found' };
      }
      const permitted = action === 'close'
        ? casting.status === 'published'
        : ['published', 'closed'].includes(casting.status);
      if (!permitted) {
        await client.query('ROLLBACK'); begun = false;
        return { outcome: 'invalid_status' };
      }

      // Ne otkazuj aktivne audicije / rezervacije bez dogovorenog
      // postupka s modulom audicija i obavijesti. Ne ostavljaj siročad.

      const newStatus = action === 'close' ? 'closed' : 'cancelled';
      await client.query(`
        UPDATE casting_calls
        SET status = $1, updated_at = NOW()
        WHERE id = $2`, [newStatus, castingId]);

      if (action === 'cancel') {
        await closeCastingDependents(client, castingId, 'cancelled', userId);
      }

      await client.query(`
        INSERT INTO casting_call_status_history
          (old_status, new_status, reason, casting_call_id, changed_by)
        VALUES ($1, $2, $3, $4, $5)`, [
          casting.status, newStatus,
          action === 'close' ? 'Prijave zatvorio poslodavac.' : 'Oglas otkazao poslodavac.',
          castingId, userId
        ]);
      await client.query('COMMIT'); begun = false;
      return { outcome: 'updated', id: castingId, status: newStatus };
    } catch (error) {
      if (begun) {
        try { await client.query('ROLLBACK'); } catch { /* zadrži izvornu grešku */ }
      }
      throw error;
    } finally {
      client.release();
    }
  }
  return {
    close: (userId, castingId) => transition(userId, castingId, 'close'),
    cancel: (userId, castingId) => transition(userId, castingId, 'cancel')
  };
}
module.exports = { createEmployerCastingStatusModel };
