const { spawnSync } = require('node:child_process');

const result = spawnSync(process.execPath, ['--test', 'test/auth-database.test.js'], {
  stdio: 'inherit', env: { ...process.env, AUTH_DATABASE_TESTS: '1' },
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
