
const pool = require('../config/db');

// Dohvaća sve objavljene casting oglase iz baze.
async function getPublishedCastings() {
  const result = await pool.query(
    `SELECT id, title, description, location,
            positions_count, application_deadline
     FROM casting_calls
     WHERE status = 'published'
     ORDER BY created_at DESC`
  );

  return result.rows;
}


 // Dohvaća jedan objavljeni casting oglas prema ID-u.
async function getCastingById(id) {
  const result = await pool.query(
    `SELECT id, title, description, location,
            positions_count, application_deadline
     FROM casting_calls
     WHERE id = $1 AND status = 'published'`,
    [id]
  );

  return result.rows[0] || null;
}


// Omogućuje controlleru korištenje ove funkcije.
module.exports = {
  getPublishedCastings,
  getCastingById
};