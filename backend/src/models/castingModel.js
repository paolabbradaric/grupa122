
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

// Omogućuje controlleru korištenje ove funkcije.
module.exports = {
  getPublishedCastings
};
