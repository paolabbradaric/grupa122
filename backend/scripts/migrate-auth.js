const fs = require('node:fs');
const path = require('node:path');
const pool = require('../src/config/db');

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const sql = fs.readFileSync(path.resolve(__dirname, '../../db/migrations/auth_sessions.sql'), 'utf8');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('Auth migracija je uspješno primijenjena.');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

migrate().catch(error => {
  console.error('Auth migracija nije uspjela:', error.code || error.message);
  process.exitCode = 1;
}).finally(() => pool.end());
