const pool = require('../src/config/db');
const { createStorage } = require('../src/profiles/storage');
const { cleanupModerationFiles } = require('../src/admin/cleanup');
cleanupModerationFiles(pool, createStorage()).then(result => {
  console.log(result);
  if (result.failed) process.exitCode = 1;
}).catch(error => {
  console.error('Čišćenje nije uspjelo:', error.code || 'ERROR');
  process.exitCode = 1;
}).finally(() => pool.end());
