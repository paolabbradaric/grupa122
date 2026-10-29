
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Učitavamo postavke iz backend/.env
require('dotenv').config({
  path: path.resolve(__dirname, '../../.env')
});

// Stvaramo skup veza prema PostgreSQL bazi.
const pool = new Pool({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT),
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  ssl: process.env.PGSSL === 'true'
    ? {
        rejectUnauthorized: true,
        ...(process.env.PGSSLROOTCERT
          ? { ca: fs.readFileSync(path.resolve(__dirname, '../../', process.env.PGSSLROOTCERT), 'utf8') }
          : {})
      }
    : undefined
});

// Omogućujemo drugim datotekama korištenje baze.
module.exports = pool;
