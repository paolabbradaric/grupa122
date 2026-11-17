const fs = require("node:fs");
const path = require("node:path");
const pool = require("../src/config/db");
(async () => {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    await c.query(
      fs.readFileSync(
        path.resolve(__dirname, "../../db/migrations/admin_access.sql"),
        "utf8",
      ),
    );
    await c.query("COMMIT");
    console.log("Migracija admin pristupa je primijenjena.");
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
})()
  .catch((e) => {
    console.error("Migracija nije uspjela:", e.code || "ERROR");
    process.exitCode = 1;
  })
  .finally(() => pool.end());
