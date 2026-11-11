const fs = require('node:fs');
const path = require('node:path');
const pool = require('../src/config/db');

async function migrate() {
  const client = await pool.connect();
  try {
    const sql = fs.readFileSync(path.resolve(__dirname,
      '../../db/migrations/20261104205039_casting_call_drafts.sql'), 'utf8');
    await client.query(sql);
    console.log('Migracija casting nacrta je uspješno primijenjena.');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

migrate().catch(error => {
  console.error('Migracija casting nacrta nije uspjela:', error.code || error.message);
  process.exitCode = 1;
}).finally(() => pool.end());
