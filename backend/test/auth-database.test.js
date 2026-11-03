const { test } = require('node:test');
const assert = require('node:assert/strict');
const session = require('express-session');
const PgStore = require('connect-pg-simple')(session);
const pool = require('../src/config/db');
const { createUserModel } = require('../src/auth/userModel');

test('PostgreSQL registracija, rollback konflikata i serverske sesije', {
  skip: process.env.AUTH_DATABASE_TESTS !== '1' ? 'Pokreni npm run test:db za provjeru konfigurirane baze.' : false,
}, async t => {
  const client = await pool.connect();
  t.after(async () => { await client.query('ROLLBACK'); client.release(); await pool.end(); });
  await client.query('BEGIN');
  await client.query('CREATE TEMP TABLE users (LIKE public.users INCLUDING ALL) ON COMMIT DROP');
  await client.query('CREATE TEMP TABLE candidate_profiles (LIKE public.candidate_profiles INCLUDING ALL) ON COMMIT DROP');
  await client.query('CREATE TEMP TABLE organisations (LIKE public.organisations INCLUDING ALL) ON COMMIT DROP');
  await client.query('CREATE TEMP TABLE sessions (LIKE app_private.sessions INCLUDING ALL) ON COMMIT DROP');
  await client.query('SET LOCAL search_path = pg_temp, public');
  const scopedPool = {
    query: (...args) => client.query(...args),
    connect: async () => ({
      query: (sql, args) => client.query({
        BEGIN: 'SAVEPOINT registration', COMMIT: 'RELEASE SAVEPOINT registration', ROLLBACK: 'ROLLBACK TO SAVEPOINT registration',
      }[sql] || sql, args),
      release() {},
    }),
  };
  const users = createUserModel(scopedPool);
  const identity = { authId: 'google:test-only-subject', email: 'auth-test@example.test' };
  const candidate = { role: 'candidate', firstName: 'Test', lastName: 'Kandidat', birthDate: '2000-04-12' };
  const user = await users.register(identity, candidate);
  assert.equal(user.birthDate, '2000-04-12');
  assert.equal((await users.findByAuthId(identity.authId)).id, user.id);
  assert.equal((await users.findById(user.id)).id, user.id);
  assert.equal((await client.query('SELECT count(*)::int AS n FROM candidate_profiles WHERE user_id = $1', [user.id])).rows[0].n, 1);
  await assert.rejects(users.register({ ...identity, authId: 'google:another-subject' }, candidate), error => error.status === 409);
  assert.equal((await client.query('SELECT count(*)::int AS n FROM users')).rows[0].n, 1);

  const employer = { ...candidate, role: 'employer', companyName: 'Test produkcija', regNum: '33392005961', contactEmail: 'kontakt@example.test', phone: '+385 1 1234567', location: 'Zagreb' };
  const owner = await users.register({ authId: 'google:test-owner', email: 'owner@example.test' }, employer);
  assert.equal(owner.organization.location, 'Zagreb');
  assert.equal((await users.findById(owner.id)).organization.reg_num, employer.regNum);
  await assert.rejects(users.register({ authId: 'google:other-owner', email: 'other@example.test' }, employer), error => error.status === 409);
  assert.equal((await client.query('SELECT count(*)::int AS n FROM users')).rows[0].n, 2);
  await client.query('UPDATE users SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);
  assert.equal(await users.findById(user.id), null);
  await assert.rejects(users.findByAuthId(identity.authId), error => error.status === 403);

  const store = new PgStore({ pool: scopedPool, schemaName: 'pg_temp', tableName: 'sessions', pruneSessionInterval: false });
  const invoke = (method, ...args) => new Promise((resolve, reject) => store[method](...args, (error, data) => error ? reject(error) : resolve(data)));
  await invoke('set', 'test-session', { cookie: { expires: new Date(Date.now() + 60000) }, passport: { user: owner.id } });
  assert.equal((await invoke('get', 'test-session')).passport.user, owner.id);
  await invoke('destroy', 'test-session');
  assert.equal(await invoke('get', 'test-session'), undefined);
  await invoke('set', 'expired-session', { cookie: { expires: new Date(Date.now() - 60000) }, passport: { user: owner.id } });
  assert.equal(await invoke('get', 'expired-session'), undefined);
});
