const { spawnSync } = require('node:child_process');
const path = require('node:path');

if (!process.env.SECURITY_TEST_DATABASE_URL || !process.env.SECURITY_TEST_CLUSTER_ID) {
  console.error('Set SECURITY_TEST_DATABASE_URL and SECURITY_TEST_CLUSTER_ID for a dedicated local PostgreSQL cluster.');
  process.exitCode = 1;
} else {
  const result = spawnSync(process.execPath, ['--test',
    path.resolve(__dirname, '../test/security-database.test.js')], { stdio: 'inherit' });
  process.exitCode = result.status ?? 1;
}
