const path = require("path");
const { Pool } = require("pg");

// Učitava postavke iz backend/.env.
require("dotenv").config({
  path: path.join(__dirname, "../../.env"),
});

// Upravlja vezama s PostgreSQL bazom.
const pool = new Pool();

pool.on("error", (error) => {
  console.error("Greška veze s bazom:", error.message);
});

module.exports = pool;