const { test } = require('node:test');
const assert = require('node:assert/strict');
const { getEmployerCastingWritesEnabled } = require('../src/app');

test('employer writes remain off unless explicitly requested', () => {
  assert.equal(getEmployerCastingWritesEnabled({}), false);
  assert.equal(getEmployerCastingWritesEnabled({ EMPLOYER_CASTING_WRITES_ENABLED: 'false',
    EMPLOYER_CASTING_WRITES_ALLOW_REMOTE: 'true', EMPLOYER_CASTING_WRITES_CONFIRMED: 'true' }), false);
});

test('local castme_test still requires confirmation', () => {
  const local = { PGHOST: '127.0.0.1', PGPORT: '5432', PGDATABASE: 'castme_test',
    EMPLOYER_CASTING_WRITES_ENABLED: 'true' };
  assert.throws(() => getEmployerCastingWritesEnabled(local), /potvrđeno/);
  assert.equal(getEmployerCastingWritesEnabled({ ...local, EMPLOYER_CASTING_WRITES_CONFIRMED: 'true' }), true);
});

test('remote writes require both confirmations and TLS; local-looking wrong database is remote', () => {
  const remote = { PGHOST: 'database.example.invalid', PGPORT: '5432', PGDATABASE: 'postgres', PGSSL: 'true',
    EMPLOYER_CASTING_WRITES_ENABLED: 'true', EMPLOYER_CASTING_WRITES_CONFIRMED: 'true' };
  assert.throws(() => getEmployerCastingWritesEnabled(remote), /udaljenu bazu/);
  assert.throws(() => getEmployerCastingWritesEnabled({ ...remote,
    EMPLOYER_CASTING_WRITES_ALLOW_REMOTE: 'true', PGSSL: 'false' }), /TLS/);
  assert.throws(() => getEmployerCastingWritesEnabled({ ...remote, PGHOST: '127.0.0.1',
    PGDATABASE: 'other_database' }), /udaljenu bazu/);
  assert.equal(getEmployerCastingWritesEnabled({ ...remote, EMPLOYER_CASTING_WRITES_ALLOW_REMOTE: 'true' }), true);
});
