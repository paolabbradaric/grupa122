const pool = require('../config/db');

// Dohvaća termine audicija za određeni oglas.
async function getAuditionSlots(casting_call_id, database = pool) {
  const result = await database.query(
    `SELECT id, starts_at, ends_at, location, capacity, status
     FROM audition_slots
     WHERE casting_call_id = $1
     ORDER BY starts_at`,
    [casting_call_id]
  );

  return result.rows;
}

// Dodaje novi termin audicije.
async function createAuditionSlot(
  casting_call_id,
  starts_at,
  ends_at,
  location,
  capacity,
  employer_id,
  database = pool
) {
  const result = await database.query(
    `INSERT INTO audition_slots
       (casting_call_id, starts_at, ends_at, location, capacity, status)
     SELECT c.id, $2, $3, $4, $5, 'scheduled'
     FROM casting_calls c
     JOIN projects p ON p.id = c.project_id
     JOIN organisations o ON o.id = p.org_id
     WHERE c.id = $1
      AND o.owner_id = $6
      AND c.status = 'published'
     RETURNING id, starts_at, ends_at, location, capacity, status`,
    [casting_call_id, starts_at, ends_at, location, capacity, employer_id]
  );

  return result.rows[0] || null;
}

async function cancelAuditionSlot(
  casting_call_id,
  slot_id,
  employer_id,
  database = pool
) {
  const client = await database.connect();
  let transaction = false;

  try{
    await client.query('BEGIN');
    transaction = true;

    const { rows: [slot] } = await client.query(
      `SELECT s.id, s.status, s.starts_at
      FROM audition_slots s
      JOIN casting_calls c ON c.id = s.casting_call_id
      JOIN projects p ON p.id = c.project_id
      JOIN organisations o ON o.id = p.org_id
      WHERE s.id = $1
        AND s.casting_call_id = $2
        AND o.owner_id = $3
      FOR UPDATE OF s`,
      [slot_id, casting_call_id, employer_id]
    );

    if (!slot){
      await client.query('ROLLBACK');
      transaction = false;
      return { outcome: 'not_found' };
    }

    if (slot.status !== 'scheduled' || new Date(slot.starts_at) <= new Date()){
      await client.query('ROLLBACK');
      transaction = false;
      return { outcome: 'invalid_status' };
    }

    const { rows: [row] } = await client.query(
      `SELECT EXISTS (
        SELECT 1
        FROM audition_bookings
        WHERE audition_slot_id = $1
          AND status NOT IN ('cancelled', 'canceled')
      )AS has_active_bookings`,
      [slot_id]
    );
    if (row.has_active_bookings){
      await client.query('ROLLBACK');
      transaction = false;
      return { outcome: 'active_bookings' };
    }

    await client.query(
      `UPDATE audition_slots
      SET status = 'cancelled'
      WHERE id = $1`,
      [slot_id]
    );

    await client.query('COMMIT');
    transaction = false;
    return { outcome: 'cancelled', id:slot_id };

  } catch(error){
    if (transaction){
      try{
        await client.query('ROLLBACK');
      } catch{
        //Zadržavamo izvornu grešku
      }
    } throw error;
  } finally{
    client.release();
  }
}

module.exports = {
  getAuditionSlots,
  createAuditionSlot,
  cancelAuditionSlot
};