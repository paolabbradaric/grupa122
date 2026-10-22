
const { Pool } = require('pg');
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
  user: process.env.PGUSER
});

// Omogućujemo drugim datotekama korištenje baze.
module.exports = pool;
