const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Pool } = require('pg');
const { readFile } = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { createUserModel } = require('../src/auth/userModel');

const connectionString = process.env.ADMIN_TEST_DATABASE_URL;
test('admin PostgreSQL provisioning, migrations, identity conflicts and preserved references', {
  skip: !connectionString ? 'Set ADMIN_TEST_DATABASE_URL to a disposable local PostgreSQL server.' : false,
}, async t => {
  const url = new URL(connectionString);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname), 'Local server required');
  const admin = new Pool({ connectionString });
  const name = 'admin_test_' + randomUUID().replaceAll('-', '');
  await admin.query(`CREATE DATABASE ${name}`);
  url.pathname = '/' + name;
  const pool = new Pool({ connectionString: url.href });
  t.after(async () => {
    await pool.end();
    await admin.query(`DROP DATABASE ${name} WITH (FORCE)`);
    await admin.end();
  });
  // Roles belong only to the explicitly selected disposable local server.
  await admin.query(`DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF;
  END $$`);
  const schema = await readFile(path.resolve(__dirname, '../../db/schema.sql'), 'utf8');
  const migration = await readFile(path.resolve(__dirname, '../../db/migrations/admin_access.sql'), 'utf8');
  const migrate = async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(migration);
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  };
  const users = createUserModel(pool);
  const candidate = { firstName: 'Existing', lastName: 'Candidate', birthDate: '2000-04-12', role: 'candidate' };
  const identity = { authId: 'google:existing', email: 'existing@example.test' };
  await pool.query(schema);
  const contract = async () => ({
    columns: (await pool.query(`SELECT attname, attnotnull FROM pg_attribute
      WHERE attrelid='public.users'::regclass AND attnum>0 ORDER BY attnum`)).rows,
    checks: (await pool.query(`SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint
      WHERE conrelid='public.users'::regclass AND contype='c' ORDER BY conname`)).rows,
    indexes: (await pool.query(`SELECT indexdef FROM pg_indexes WHERE schemaname='public'
      AND tablename='users' ORDER BY indexname`)).rows,
  });
  const freshContract = await contract();
  await t.test('fresh schema and repeat migration have identical contracts', async () => {
    await migrate(); await migrate();
    assert.deepEqual(await contract(), freshContract);
  });
  // Restore the previous users contract, then upgrade with existing FK data.
  await pool.query(`ALTER TABLE users DROP CONSTRAINT users_personal_data_required;
    ALTER TABLE users ALTER COLUMN first_name SET NOT NULL;
    ALTER TABLE users ALTER COLUMN last_name SET NOT NULL;
    ALTER TABLE users ALTER COLUMN birth_date SET NOT NULL;
    DROP INDEX users_email_normalized_unique;
    GRANT ALL ON users TO anon, authenticated`);
  const original = await users.register(identity, candidate);
  const owner = await users.register({ authId: 'google:owner', email: 'owner@example.test' }, {
    ...candidate, role: 'employer', companyName: 'Test organisation', regNum: '33392005961',
    contactEmail: 'contact@example.test', phone: null, location: 'Zagreb',
  });
  await pool.query(`INSERT INTO verification (status, org_id, reviewed_by) VALUES ('approved', $1, $2)`,
    [owner.organization.id, original.id]);

  await t.test('legacy normalized duplicates abort the entire upgrade', async () => {
    await pool.query(`INSERT INTO users (auth_id,email,first_name,last_name,birth_date,role)
      VALUES ('google:duplicate',' EXISTING@EXAMPLE.TEST ','Test','Duplicate','2000-01-01','candidate')`);
    await assert.rejects(migrate(), error => error.code === '23505');
    const birthColumn = (await contract()).columns.find(column => column.attname === 'birth_date');
    assert.equal(birthColumn.attnotnull, true);
    await pool.query("DELETE FROM users WHERE auth_id='google:duplicate'");
  });
  await t.test('upgrade preserves users and references and denies public API roles', async () => {
    await migrate(); await migrate();
    assert.deepEqual(await contract(), freshContract);
    assert.equal((await users.findByAuthId(identity.authId)).id, original.id);
    assert.equal((await pool.query('SELECT reviewed_by FROM verification')).rows[0].reviewed_by, original.id);
    assert.equal((await pool.query('SELECT user_id FROM candidate_profiles')).rows[0].user_id, original.id);
    const security = (await pool.query(`SELECT relrowsecurity AS rls,
      has_table_privilege('anon','public.users','SELECT') AS anon_read,
      has_table_privilege('authenticated','public.users','INSERT') AS authenticated_write
      FROM pg_class WHERE oid='public.users'::regclass`)).rows[0];
    assert.deepEqual(security, { rls: true, anon_read: false, authenticated_write: false });
  });
  await t.test('promotion keeps ID, subject, birth date, profile and reviewed_by', async () => {
    const promoted = await users.provisionAdmin(identity);
    assert.equal(promoted.id, original.id);
    assert.equal(promoted.birthDate, original.birthDate);
    assert.equal(promoted.googleAuthId, identity.authId);
    assert.equal(promoted.role, 'admin');
    assert.equal(JSON.stringify(promoted).includes('google:existing'), false);
    assert.equal((await pool.query('SELECT user_id FROM candidate_profiles')).rows[0].user_id, original.id);
    assert.equal((await pool.query('SELECT reviewed_by FROM verification')).rows[0].reviewed_by, original.id);
  });
  await t.test('first admin has no invented personal data or profile or organisation', async () => {
    const user = await users.provisionAdmin({ authId: 'google:new-admin', email: 'new@example.test' });
    assert.equal(user.birthDate, null); assert.equal(user.firstName, null); assert.equal(user.lastName, null);
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM candidate_profiles WHERE user_id=$1', [user.id])).rows[0].n, 0);
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM organisations WHERE owner_id=$1', [user.id])).rows[0].n, 0);
    for (const role of ['candidate', 'employer']) {
      await assert.rejects(pool.query('UPDATE users SET role=$1 WHERE id=$2', [role, user.id]), error => error.code === '23514');
    }
  });
  await t.test('ordinary personal data constraints and candidate/employer registration remain intact', async () => {
    for (const missing of ['birthDate', 'firstName', 'lastName']) {
      await assert.rejects(users.register({ authId: `google:missing-${missing}`, email: `${missing}@example.test` },
        { ...candidate, [missing]: null }), error => error.code === '23514');
    }
    const ordinary = await users.register({ authId: 'google:ordinary', email: 'ordinary@example.test' }, candidate);
    assert.equal(ordinary.role, 'candidate');
    assert.equal((await users.findById(owner.id)).role, 'employer');
  });
  await t.test('concurrent same-subject logins return one account', async () => {
    const data = { authId: 'google:concurrent', email: 'concurrent@example.test' };
    const results = await Promise.all(Array.from({ length: 8 }, () => users.provisionAdmin(data)));
    assert.equal(new Set(results.map(user => user.id)).size, 1);
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM users WHERE auth_id=$1', [data.authId])).rows[0].n, 1);
  });
  await t.test('concurrent different subjects cannot claim the same normalized email', async () => {
    const results = await Promise.allSettled(['one', 'two'].map(subject => users.provisionAdmin({
      authId: `google:collision-${subject}`, email: 'collision@example.test',
    })));
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(results.find(result => result.status === 'rejected').reason.status, 409);
  });
  await t.test('email/subject conflicts roll back without promotion, merging or reactivation', async () => {
    const count = (await pool.query('SELECT count(*)::int AS n FROM users')).rows[0].n;
    await assert.rejects(users.provisionAdmin({ ...identity, authId: 'google:impostor' }), error => error.status === 409);
    await assert.rejects(users.provisionAdmin({ authId: 'google:owner', email: identity.email }), error => error.status === 409);
    assert.equal((await users.findById(owner.id)).role, 'employer');
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM users')).rows[0].n, count);
    await pool.query('UPDATE users SET deleted_at=now() WHERE id=$1', [original.id]);
    await assert.rejects(users.provisionAdmin(identity), error => error.status === 403);
    assert.equal(await users.findById(original.id), null);
    assert.equal((await pool.query('SELECT user_id FROM candidate_profiles WHERE user_id=$1', [original.id])).rows[0].user_id, original.id);
  });
  await t.test('same subject may update to an unclaimed verified address', async () => {
    const updated = await users.provisionAdmin({ authId: 'google:owner', email: 'updated@example.test' });
    assert.equal(updated.id, owner.id);
    assert.equal(updated.email, 'updated@example.test');
    assert.equal((await pool.query('SELECT owner_id FROM organisations WHERE id=$1', [owner.organization.id])).rows[0].owner_id, owner.id);
  });
});
