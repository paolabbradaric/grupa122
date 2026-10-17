const pool = require("./config/database");

async function createTestCandidate() {
  let client;

  try {
    client = await pool.connect();

    // Oba zapisa moraju uspjeti zajedno.
    await client.query("BEGIN");

    // Sprema probni korisnički račun.
    const userResult = await client.query(
      `INSERT INTO users
        (auth_id, email, first_name, last_name, birth_date, role)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, email`,
      [
        "local-test-candidate-1",
        "kandidat1@example.invalid",
        "Probni",
        "Kandidat",
        "2000-01-01",
        "candidate",
      ]
    );

    const user = userResult.rows[0];

    // Povezuje profil s upravo spremljenim korisnikom.
    const profileResult = await client.query(
      `INSERT INTO candidate_profiles (user_id, city)
       VALUES ($1, $2)
       RETURNING id, user_id, city`,
      [user.id, "Zagreb"]
    );

    // Potvrđuje oba upisa.
    await client.query("COMMIT");

    console.log("Korisnik spremljen:", user);
    console.log("Profil spremljen:", profileResult.rows[0]);
  } catch (error) {
    // Ako neki upis ne uspije, poništava cijeli postupak.
    if (client) {
      await client.query("ROLLBACK");
    }

    console.error("Upis nije uspio:", error.message);
    process.exitCode = 1;
  } finally {
    if (client) {
      client.release();
    }

    await pool.end();
  }
}

createTestCandidate();