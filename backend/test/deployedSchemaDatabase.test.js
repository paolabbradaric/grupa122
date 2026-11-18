const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { Pool } = require('pg');

test('profile/moderation upgrade and casting writes: isolated local castme_test', {
  skip: process.env.DEPLOYED_SCHEMA_DB_TESTS === '1' ? false : 'Set DEPLOYED_SCHEMA_DB_TESTS=1 on local castme_test.'
}, async t => {
  assert.equal(process.env.PGHOST, '127.0.0.1');
  assert.equal(process.env.PGPORT, '5432');
  assert.equal(process.env.PGDATABASE, 'castme_test');
  assert.equal(process.env.PGSSL, 'false');
  const suffix = randomUUID().replaceAll('-', '');
  const schema = 'deployed_fix_' + suffix;
  const privateSchema = 'deployed_private_' + suffix;
  const db = new Pool({ host: '127.0.0.1', port: 5432, database: 'castme_test',
    user: process.env.PGUSER, password: process.env.PGPASSWORD || undefined, ssl: false,
    options: `-c search_path=${schema} -c statement_timeout=5000`, connectionTimeoutMillis: 3000 });
  let created = false;
  t.after(async () => {
    try {
      if (created) {
        await db.query(`DROP SCHEMA IF EXISTS ${privateSchema} CASCADE`);
        await db.query(`DROP SCHEMA ${schema} CASCADE`);
      }
    } finally { await db.end(); }
  });
  const { rows: [server] } = await db.query('SELECT current_database() AS name, host(inet_server_addr()) AS ip');
  assert.equal(server.name, 'castme_test');
  assert.ok(['127.0.0.1','::1'].includes(server.ip));
  await db.query(`CREATE SCHEMA ${schema}`);
  created = true;
  const initial = fs.readFileSync(path.resolve(__dirname, '../../db/schema.sql'), 'utf8');
  const beforeProfiles = initial.indexOf('-- Nullable additions preserve');
  assert.ok(beforeProfiles > 0);
  const namespaced = sql => sql.replaceAll('app_private', privateSchema).replaceAll('public.users', `${schema}.users`);
  await db.query(namespaced(initial.slice(0, beforeProfiles)));
  const database = {
    query: (sql, params) => db.query(namespaced(sql), params),
    async connect() {
      const client = await db.connect();
      return { query: (sql, params) => client.query(namespaced(sql), params), release: () => client.release() };
    }
  };
  const { createUserModel } = require('../src/auth/userModel');
  const { createProfileModel } = require('../src/profiles/model');
  const { createModerationModel } = require('../src/admin/model');
  const { createEmployerCastingModel } = require('../src/models/employerCastingModel');
  const users = createUserModel(database);
  const profile = createProfileModel(database);
  const moderation = createModerationModel(database);
  const castings = createEmployerCastingModel(database);
  const employer = await users.register({authId:'test-employer',email:'employer@example.invalid'}, {
    role:'employer',firstName:'Test',lastName:'Employer',birthDate:'1990-01-01',companyName:'Local test',
    regNum:'33392005961',contactEmail:'local@example.invalid',phone:'+385 1 1234567',location:'Zagreb' });
  const candidate = await users.register({authId:'test-candidate',email:'candidate@example.invalid'}, {
    role:'candidate',firstName:'Test',lastName:'Candidate',birthDate:'1990-01-01' });

  await t.test('legacy schema reproduces missing profile/report tables and verification column', async () => {
    await assert.rejects(profile.read(employer), { code: '42P01' });
    await assert.rejects(moderation.reports({ status:null,limit:10,offset:0 }), { code:'42P01' });
    await assert.rejects(moderation.verifications({ status:null,limit:10,offset:0 }), { code:'42703' });
  });
  for (const name of ['profiles.sql','moderation.sql']) {
    const sql = namespaced(fs.readFileSync(path.resolve(__dirname, '../../db/migrations', name), 'utf8'));
    for (let i = 0; i < 2; i++) {
      const client = await db.connect();
      try { await client.query('BEGIN'); await client.query(sql); await client.query('COMMIT'); }
      catch(error) { await client.query('ROLLBACK'); throw error; }
      finally { client.release(); }
    }
  }
  await t.test('profiles and admin reads work after the existing repeatable migrations', async () => {
    assert.equal((await profile.read(employer)).profile.logo, null);
    assert.deepEqual((await profile.read(candidate)).profile.portfolio, []);
    assert.deepEqual((await moderation.reports({status:null,limit:10,offset:0})).items, []);
    assert.deepEqual((await moderation.verifications({status:null,limit:10,offset:0})).items, []);
    assert.equal((await profile.patch(employer, {companyName:'Updated local studio'})).profile.companyName,'Updated local studio');
  });
  await t.test('draft, publish, own listing and inappropriate casting report use real SQL', async () => {
    const draft = await castings.createDraft(employer.id, {projectTitle:'Local project',projectType:'film',
      projectDescription:'Local only',roleTitle:'Local role',roleDescription:'Local only',positionsCount:1,
      maxApplications:1000,minAge:18,maxAge:60,location:'Zagreb',applicationDeadline:'2099-01-01T00:00:00Z'});
    assert.equal(draft.outcome,'created');
    assert.equal((await castings.listMine(employer.id)).find(row=>row.id===draft.id).status,'draft');
    assert.equal((await castings.publishDraft(employer.id,draft.id)).outcome,'not_verified');
    await db.query("INSERT INTO verification(org_id,status) VALUES ($1,'approved')",[employer.organization.id]);
    assert.equal((await castings.publishDraft(employer.id,draft.id)).outcome,'published');
    const report = await moderation.report(candidate.id,draft.id,'Local integration test');
    assert.equal(report.report.status,'open');
    assert.equal((await moderation.reports({status:'open',limit:10,offset:0})).items.length,1);
    await assert.rejects(moderation.report(employer.id,draft.id,'Own casting'),{code:'OWN_CASTING'});
    await assert.rejects(moderation.report(candidate.id,draft.id,'Duplicate'),{code:'REPORT_EXISTS'});
  });
  await t.test('new profile/moderation tables retain RLS and no PUBLIC privileges', async () => {
    for (const table of [`${schema}.profile_media`,`${schema}.profile_storage_objects`,
      `${schema}.casting_reports`,`${privateSchema}.moderation_events`,`${privateSchema}.moderation_file_cleanup`]) {
      const {rows:[r]} = await db.query(`SELECT relrowsecurity,
        NOT EXISTS(SELECT 1 FROM aclexplode(COALESCE(relacl,acldefault('r',relowner))) WHERE grantee=0) AS private
        FROM pg_class WHERE oid=$1::regclass`,[table]);
      assert.deepEqual(r,{relrowsecurity:true,private:true});
    }
  });
});
