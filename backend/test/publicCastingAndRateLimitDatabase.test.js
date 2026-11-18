const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');

test('public casting SQL and shared submission quota: isolated local castme_test only', {
  skip: process.env.PUBLIC_CASTING_DB_TESTS === '1' ? false : 'Set PUBLIC_CASTING_DB_TESTS=1 on local castme_test.'
}, async t => {
  // Verify both explicit configuration and the actual server before any writes.
  assert.equal(process.env.PGHOST, '127.0.0.1');
  const port = Number(process.env.PGPORT);
  assert.ok(Number.isInteger(port) && port > 0 && port <= 65535);
  assert.equal(process.env.PGDATABASE, 'castme_test');
  assert.equal(process.env.PGSSL, 'false');
  const suffix = randomUUID().replaceAll('-', '');
  const businessSchema = `tin_public_${suffix}`;
  const privateSchema = `tin_limits_${suffix}`;
  const db = new Pool({ host: '127.0.0.1', port, database: 'castme_test',
    user: process.env.PGUSER, password: process.env.PGPASSWORD || undefined, ssl: false,
    options: `-c search_path=${businessSchema} -c statement_timeout=5000`, connectionTimeoutMillis: 3000 });
  let businessCreated = false;
  let privateCreated = false;
  t.after(async () => {
    try {
      if (privateCreated) await db.query(`DROP SCHEMA ${privateSchema} CASCADE`);
      if (businessCreated) await db.query(`DROP SCHEMA ${businessSchema} CASCADE`);
    } finally { await db.end(); }
  });
  const { rows: [server] } = await db.query('SELECT current_database() AS name, host(inet_server_addr()) AS ip');
  assert.equal(server.name, 'castme_test');
  assert.ok(['127.0.0.1', '::1'].includes(server.ip));
  await db.query(`CREATE SCHEMA ${businessSchema}`);
  businessCreated = true;
  await db.query(`CREATE SCHEMA ${privateSchema}`);
  privateCreated = true;

  const schema = fs.readFileSync(path.resolve(__dirname, '../../db/schema.sql'), 'utf8');
  const coreEnd = schema.indexOf('CREATE SCHEMA IF NOT EXISTS app_private;');
  assert.ok(coreEnd > 0);
  await db.query(schema.slice(0, coreEnd));
  // Only namespace substitutions: exercise the real migration without touching
  // existing public/app_private objects, even on the isolated local database.
  const originalMigration = fs.readFileSync(path.resolve(__dirname,
    '../../db/migrations/20261118_application_submission_rate_limit.sql'), 'utf8');
  assert.ok(schema.split('-- Application table security (same SQL')[0].replaceAll('\r\n', '\n').trimEnd()
    .endsWith(originalMigration.replaceAll('\r\n', '\n').trimEnd()));
  const migration = originalMigration.replaceAll('app_private', privateSchema)
    .replaceAll('public.users', `${businessSchema}.users`);
  await db.query(migration);
  await db.query(migration);

  const { createCastingModel } = require('../src/models/castingModel');
  const { ApplicationRateLimitStore } = require('../src/middleware/applicationRateLimit');
  const { createApplicationTransaction } = require('../src/models/applicationModel');
  const { httpFixture } = require('../test-utils/httpFixture');
  const model = createCastingModel(db);
  const rateDatabase = { query: (sql, params) => db.query(sql.replaceAll('app_private', privateSchema), params) };
  const firstStore = new ApplicationRateLimitStore(rateDatabase);
  const secondStore = new ApplicationRateLimitStore(rateDatabase);
  firstStore.init({ windowMs: 900000 });
  secondStore.init({ windowMs: 900000 });

  await db.query(`INSERT INTO users(id,auth_id,email,first_name,last_name,birth_date,role)
    VALUES (1,'tin-local-1','tin-local-1@example.invalid','Test','One','1990-01-01','candidate'),
      (2,'tin-local-2','tin-local-2@example.invalid','Test','Two','1990-01-01','candidate'),
      (3,'tin-local-3','tin-local-3@example.invalid','Test','Three','1990-01-01','employer')`);
  await db.query('INSERT INTO candidate_profiles(id,user_id) VALUES (1,1),(2,2)');
  await db.query(`INSERT INTO organisations(id,owner_id,company_name,reg_num,contact_email)
    VALUES (1,3,'Private organisation','local-only','private-contact@example.invalid')`);
  await db.query(`INSERT INTO projects(id,title,project_type,description,org_id)
    VALUES (1,'Projekt Mjesec','film','Opis filma',1), (2,'Projekt Sunce','reklama','Opis reklame',1)`);
  async function casting(id, status = 'published', projectId = 1, minAge = 18, maxAge = 30) {
    if (id > 2) {
      await db.query(`INSERT INTO projects(id,title,project_type,description,org_id)
        SELECT $1,title,project_type,description,org_id FROM projects WHERE id=$2`, [id, projectId]);
      projectId = id;
    }
    await db.query(`INSERT INTO casting_calls(id,project_id,title,description,status,positions_count,
      max_applications,min_age,max_age,appearance_req,exp_req,location,audition_text,application_deadline,created_at)
      VALUES ($1,$2,$3,'Opis uloge',$4,2,1000,$5,$6,'visok','ples 100% A_B C\\D','Zagreb',
        'Tekst audicije',NOW()+INTERVAL '30 days','2026-01-01')`, [id, projectId, `Uloga ${id}`, status, minAge, maxAge]);
  }
  await casting(1);
  await casting(2, 'published', 2, 18, 99);
  await casting(3, 'published', 1, 40, 60);
  await casting(4, 'draft', 1, null, null);
  for (const [index, status] of ['closed', 'cancelled', 'filled'].entries()) await casting(index + 5, status);

  await t.test('public SQL returns only published records and an explicit public projection', async () => {
    assert.deepEqual((await model.getPublishedCastings()).map(row => row.id), [3, 2, 1]);
    const row = await model.getCastingById(1);
    assert.deepEqual(Object.keys(row).sort(), ['id','title','description','location','positions_count',
      'application_deadline','status','project_id','project_title','project_type','project_description',
      'audition_text','min_age','max_age','appearance_req','exp_req','projectTitle','roleTitle','projectType'].sort());
    assert.equal(row.projectTitle, 'Projekt Mjesec');
    assert.equal(row.roleTitle, 'Uloga 1');
    assert.equal(row.status, 'published');
    assert.equal(row.audition_text, 'Tekst audicije');
    assert.equal(row.project_description, 'Opis filma');
    for (const id of [4,5,6,7,999]) assert.equal(await model.getCastingById(id), null);
  });

  await t.test('combined filters, age boundaries, wildcards and SQL injection', async () => {
    const ids = async (location, search, filters) => (await model.getPublishedCastings(location, search, filters)).map(row => row.id);
    assert.deepEqual(await ids('zagreb', 'mjesec', { projectType: 'FILM', age: 18, requirements: 'PLES' }), [1]);
    assert.deepEqual(await ids('Zag%', 'Uloga', { age: 30 }), [2,1]);
    assert.deepEqual(await ids(null, null, { age: 31 }), [2]);
    assert.deepEqual(await ids(null, null, { age: 40 }), [3,2]);
    assert.deepEqual(await ids('Split'), []);
    assert.deepEqual(await ids(null, null, { projectType: 'reklama' }), [2]);
    assert.deepEqual(await ids(null, null, { requirements: 'visok' }), [3,2,1]);
    for (const literal of ['100%', 'A_B', 'C\\D']) assert.deepEqual(await ids(null, null, { requirements: literal }), [3,2,1]);
    assert.deepEqual(await ids(null, null, { requirements: '100_' }), []);
    for (const filters of [{ projectType: "film' OR TRUE --" }, { requirements: "' OR TRUE --" }]) {
      assert.deepEqual(await ids(null, null, filters), []);
    }
    assert.deepEqual(await ids("' OR TRUE --", "' OR TRUE --"), []);
    assert.equal((await model.getPublishedCastings()).length, 3);
  });

  await t.test('real migration enables RLS, revokes public access and enforces the user FK', async () => {
    const table = `${privateSchema}.application_submission_limits`;
    const { rows: [security] } = await db.query(`SELECT relrowsecurity,
      NOT EXISTS (SELECT 1 FROM aclexplode(COALESCE(relacl, acldefault('r',relowner))) WHERE grantee=0) AS private
      FROM pg_class WHERE oid=$1::regclass`, [table]);
    assert.deepEqual(security, { relrowsecurity: true, private: true });
    const { rows: roles } = await db.query("SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated')");
    for (const { rolname } of roles) {
      const { rows: [rights] } = await db.query(`SELECT has_table_privilege($1,$2,'SELECT,INSERT,UPDATE,DELETE') AS allowed`, [rolname, table]);
      assert.equal(rights.allowed, false, rolname);
    }
    await assert.rejects(firstStore.increment('999999'), { code: '23503' });
  });

  await t.test('separate store instances serialize increments, retain reset time and reset expired windows', async () => {
    const results = await Promise.all(Array.from({ length: 30 }, (_, i) => (i % 2 ? firstStore : secondStore).increment('1')));
    assert.deepEqual(results.map(r => r.totalHits).sort((a,b) => a-b), Array.from({ length: 30 }, (_, i) => i+1));
    assert.equal(new Set(results.map(r => r.resetTime.getTime())).size, 1);
    assert.equal((await secondStore.increment('2')).totalHits, 1);
    await db.query(`UPDATE ${privateSchema}.application_submission_limits SET reset_at=NOW()-INTERVAL '1 second' WHERE user_id=1`);
    const reset = await secondStore.increment('1');
    assert.equal(reset.totalHits, 1);
    assert.ok(reset.resetTime.getTime() > Date.now());
    await firstStore.decrement('1');
    await secondStore.decrement('1');
    assert.equal((await firstStore.increment('1')).totalHits, 1);
    await firstStore.resetKey('1');
    assert.equal((await secondStore.increment('1')).totalHits, 1);
    await firstStore.resetKey('1');
    await secondStore.resetKey('2');
  });

  await t.test('HTTP through two API instances shares the DB quota and blocks excess business inserts', async t => {
    const applicationModel = {
      async getCandidateProfileByUserId(id) {
        return (await db.query('SELECT id FROM candidate_profiles WHERE user_id=$1', [id])).rows[0];
      },
      createApplicationTransaction: (...args) => createApplicationTransaction(...args, db)
    };
    const first = await httpFixture(t, { writesEnabled: true, rateStore: firstStore, publicModel: model, applicationModel });
    const second = await httpFixture(t, { writesEnabled: true, rateStore: secondStore, publicModel: model, applicationModel });
    const cookie1 = await first.cookie();
    const cookie2 = await second.cookie();
    const responses = await Promise.all(Array.from({ length: 20 }, (_, i) =>
      i % 2 ? first.post(cookie1) : second.post(cookie2)));
    assert.equal(responses.filter(r => r.status === 201).length, 1);
    assert.equal(responses.filter(r => r.status === 409).length, 9);
    assert.equal(responses.filter(r => r.status === 429).length, 10);
    for (const response of responses.filter(r => r.status === 429)) {
      assert.equal((await response.json()).code, 'APPLICATION_RATE_LIMITED');
      assert.ok(Number(response.headers.get('retry-after')) > 0);
    }
    assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM applications')).rows[0].n, 1);
    assert.equal((await first.post(await first.cookie(2))).status, 201);
    const publicList = await second.request('/api/castings?projectType=film&age=25&search=Mjesec');
    assert.equal(publicList.status, 200);
    assert.deepEqual((await publicList.json()).map(row => row.id), [1]);
    // Missing migration must fail closed, while public reads keep working.
    await db.query(`DROP TABLE ${privateSchema}.application_submission_limits`);
    const unavailable = await second.post(cookie2);
    assert.equal(unavailable.status, 503);
    assert.equal((await unavailable.json()).code, 'APPLICATION_RATE_LIMIT_UNAVAILABLE');
    assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM applications')).rows[0].n, 2);
    assert.equal((await first.request('/api/castings')).status, 200);
  });
});
