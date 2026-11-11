const { spawnSync } = require('node:child_process');

const result = spawnSync(process.execPath, ['--test', 'test/casting-drafts-database.test.js'], {
  stdio: 'inherit', env: { ...process.env, CASTING_DATABASE_TESTS: '1' },
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
