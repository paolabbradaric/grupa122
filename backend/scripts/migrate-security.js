const fs = require('node:fs/promises');
const path = require('node:path');

async function migrateSecurity(pool) {
  const sql = await fs.readFile(path.resolve(__dirname,
    '../../db/migrations/20261118_application_security.sql'), 'utf8');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  const pool = require('../src/config/db');
  migrateSecurity(pool).then(() => {
    console.log('Sigurnosna migracija uspješno je primijenjena.');
  }).catch(error => {
    // Never print connection strings, credentials, query parameters or DB detail.
    const diagnostic = error.code === 'P0001' && error.message.startsWith('Security migration:')
      ? error.message : 'Provjerite ciljnu bazu, ovlasti i dostupnost zaključavanja.';
    console.error('Sigurnosna migracija nije uspjela:', error.code || 'CONNECTION_ERROR', diagnostic);
    process.exitCode = 1;
  }).finally(() => pool.end());
}

module.exports = { migrateSecurity };
