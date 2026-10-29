
const pool = require('../config/db');

// Dohvaća sve objavljene casting oglase.
// Ako je zadana lokacija, filtrira oglase po gradu.
async function getPublishedCastings(location) {
  const result = await pool.query(
    `SELECT id, title, description, location,
            positions_count, application_deadline
     FROM casting_calls
     WHERE status = 'published'
       AND ($1::text IS NULL OR location ILIKE $1)
     ORDER BY created_at DESC`,
    [location || null]
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


// Omogućuje controlleru korištenje obje funkcije.
module.exports = {
  getPublishedCastings,
  getCastingById
};
