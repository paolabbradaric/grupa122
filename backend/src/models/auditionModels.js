const pool = require('../config/db');

// Dohvaća termine audicija za određeni oglas.
async function getAuditionSlots(casting_call_id) {
  const result = await pool.query(
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
  capacity
) {
  const result = await pool.query(
    `INSERT INTO audition_slots
       (casting_call_id, starts_at, ends_at, location, capacity, status)
     VALUES ($1, $2, $3, $4, $5, 'scheduled')
     RETURNING id, starts_at, ends_at, location, capacity, status`,
    [casting_call_id, starts_at, ends_at, location, capacity]
  );

  return result.rows[0];
}

module.exports = {
  getAuditionSlots,
  createAuditionSlot
};