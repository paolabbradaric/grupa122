const fs = require('node:fs/promises');
const path = require('node:path');
const pool = require('../src/config/db');
(async () => {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    await c.query(await fs.readFile(path.resolve(__dirname, '../../db/migrations/moderation.sql'), 'utf8'));
    await c.query('COMMIT');
    console.log('Migracija verifikacije i moderacije je primijenjena.');
  } catch (error) {
    await c.query('ROLLBACK');
    throw error;
  } finally { c.release(); }
})().catch(error => {
  console.error('Migracija nije uspjela:', error.code || 'ERROR');
  process.exitCode = 1;
}).finally(() => pool.end());
