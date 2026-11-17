const { spawnSync } = require("node:child_process");
if (!process.env.PROFILE_TEST_DATABASE_URL) {
  console.error(
    "Postavi PROFILE_TEST_DATABASE_URL na lokalni testni PostgreSQL server.",
  );
  process.exitCode = 1;
} else {
  const result = spawnSync(
    process.execPath,
    ["--test", "test/profiles-database.test.js"],
    { stdio: "inherit", env: process.env },
  );
  process.exitCode = result.status ?? 1;
}
