const pool = require("./config/database");

async function checkDatabase() {
  try {
    // Provjerava vezu bez mijenjanja podataka.
    const result = await pool.query(
      "SELECT current_database() AS database, current_user AS user"
    );

    console.log("Veza s bazom radi:", result.rows[0]);
  } catch (error) {
    console.error("Spajanje nije uspjelo:", error.message);
    process.exitCode = 1;
  } finally {
    // Zatvara veze nakon provjere.
    await pool.end();
  }
}

checkDatabase();