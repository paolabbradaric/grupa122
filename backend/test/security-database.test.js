const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { readFile } = require('node:fs/promises');
const path = require('node:path');
const { Pool } = require('pg');
const { migrateSecurity } = require('../scripts/migrate-security');

const connectionString = process.env.SECURITY_TEST_DATABASE_URL;
const marker = '-- Application table security (same SQL as the additive migration).';
const optional = ['public.profile_media', 'public.profile_storage_objects', 'public.casting_reports',
  'app_private.moderation_events', 'app_private.moderation_file_cleanup',
  'app_private.application_submission_limits'];
const sensitive = ['public.users', 'public.candidate_profiles', 'public.organisations',
  'public.media_files', 'public.verification', 'app_private.sessions', ...optional];

async function catalog(db) {
  // Enumerate both application schemas, including future tables: a new table
  // without RLS must fail even if it is not in the migration's explicit list.
  const tables = (await db.query(`SELECT n.nspname||'.'||c.relname AS name,
    c.relrowsecurity AS rls, c.relforcerowsecurity AS force_rls,
    pg_get_userbyid(c.relowner) AS owner,
    COALESCE((SELECT jsonb_agg(jsonb_build_array(
      CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END,
      pg_get_userbyid(a.grantor),a.privilege_type,a.is_grantable)
      ORDER BY a.grantee=0,pg_get_userbyid(a.grantee),a.privilege_type)
      FROM aclexplode(COALESCE(c.relacl,acldefault('r',c.relowner))) a),'[]') AS acl,
    COALESCE((SELECT jsonb_agg(jsonb_build_object('name',p.polname,'command',p.polcmd,
      'permissive',p.polpermissive,'using',pg_get_expr(p.polqual,p.polrelid),
      'check',pg_get_expr(p.polwithcheck,p.polrelid),'roles',
        ARRAY(SELECT CASE WHEN r=0 THEN 'PUBLIC' ELSE pg_get_userbyid(r) END
          FROM unnest(p.polroles) r ORDER BY 1)) ORDER BY p.polname)
      FROM pg_policy p WHERE p.polrelid=c.oid),'[]') AS policies
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname IN ('public','app_private') AND c.relkind IN ('r','p') ORDER BY 1`)).rows;
  const schemas = (await db.query(`SELECT nspname AS name,pg_get_userbyid(nspowner) AS owner,
    ARRAY(SELECT concat(CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END,
      ':',a.privilege_type,':',a.is_grantable)
      FROM aclexplode(COALESCE(nspacl,acldefault('n',nspowner))) a ORDER BY 1) AS acl
    FROM pg_namespace WHERE nspname IN ('public','app_private') ORDER BY 1`)).rows;
  const sequences = (await db.query(`SELECT n.nspname||'.'||c.relname AS name,
    pg_get_userbyid(c.relowner) AS owner,
    ARRAY(SELECT concat(CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END,
      ':',a.privilege_type,':',a.is_grantable)
      FROM aclexplode(COALESCE(c.relacl,acldefault('s',c.relowner))) a ORDER BY 1) AS acl
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname IN ('public','app_private') AND c.relkind='S' ORDER BY 1`)).rows;
  return { tables, schemas, sequences };
}

function assertClosed(snapshot) {
  assert.ok(snapshot.tables.length >= 18);
  for (const table of snapshot.tables) {
    assert.equal(table.rls, true, `${table.name} must have RLS`);
    assert.equal(table.force_rls, false, `${table.name} must preserve owner access`);
    assert.equal(table.owner, 'postgres');
    if (sensitive.includes(table.name)) {
      assert.deepEqual(table.acl.filter(a => ['PUBLIC','anon','authenticated'].includes(a[0])), [], table.name);
    }
  }
  assert.deepEqual(snapshot.schemas.find(s => s.name === 'app_private').acl
    .filter(a => /^(PUBLIC|anon|authenticated):/.test(a)), []);
}

async function dataAndStructure(db) {
  const { tables } = await catalog(db);
  const rows = {};
  for (const table of tables) {
    rows[table.name] = (await db.query(`SELECT to_jsonb(t) AS data FROM ${table.name} t ORDER BY to_jsonb(t)::text`)).rows;
  }
  const constraints = (await db.query(`SELECT n.nspname,c.relname,k.conname,pg_get_constraintdef(k.oid) AS definition
    FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname IN ('public','app_private') ORDER BY 1,2,3`)).rows;
  const functions = (await db.query(`SELECT proname,prosecdef,proconfig,pg_get_functiondef(p.oid) AS definition
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' ORDER BY 1`)).rows;
  const triggers = (await db.query(`SELECT n.nspname,c.relname,t.tgname,pg_get_triggerdef(t.oid) AS definition
    FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname IN ('public','app_private') AND NOT t.tgisinternal ORDER BY 1,2,3`)).rows;
  return { rows, constraints, functions, triggers };
}

async function seed(db) {
  await db.query(`INSERT INTO users(id,auth_id,email,first_name,last_name,birth_date,role) VALUES
    (100,'google:security-candidate','candidate@example.test','Test','Candidate','2000-01-01','candidate'),
    (101,'google:security-owner','owner@example.test','Test','Owner','2000-01-01','employer');
    INSERT INTO candidate_profiles(id,user_id) VALUES(300,100);
    INSERT INTO organisations(id,owner_id,company_name,reg_num,contact_email)
      VALUES(200,101,'Test studio','33392005961','studio@example.test');
    INSERT INTO projects(id,title,project_type,org_id) VALUES(400,'Test film','film',200);
    INSERT INTO casting_calls(id,title,description,positions_count,min_age,max_age,location,
      application_deadline,status,project_id)
      VALUES(500,'Public role','Description',1,18,65,'Zagreb',now()+interval '1 day','published',400);
    INSERT INTO applications(id,status,candidate_id,casting_call_id) VALUES(600,'SUBMITTED',300,500);
    INSERT INTO audition_slots(id,starts_at,ends_at,location,capacity,status,casting_call_id)
      VALUES(900,now(),now()+interval '1 hour','Zagreb',1,'open',500);
    INSERT INTO audition_bookings(id,status,booked_at,audition_slot_id,application_id)
      VALUES(901,'booked',now(),900,600);
    INSERT INTO notifications(id,type,title,message,user_id,application_id,casting_call_id,booking_id)
      VALUES(1000,'application','Private notification','Private content',100,600,500,901);
    INSERT INTO media_files(id,kind,storage_key,original_name,mime_type,size_bytes,owner_user_id)
      VALUES(700,'image','synthetic/test.png','test.png','image/png',10,100);
    INSERT INTO application_files VALUES('image',600,700);
    INSERT INTO skills(id,name) VALUES(800,'Acting');
    INSERT INTO candidate_skills VALUES('advanced',300,800);
    INSERT INTO casting_call_skills VALUES(500,800);
    INSERT INTO verification(status,org_id,reviewed_by) VALUES('approved',200,101);
    INSERT INTO application_status_history(new_status,application_id,changed_by) VALUES('SUBMITTED',600,100);
    INSERT INTO casting_call_status_history(new_status,casting_call_id,changed_by) VALUES('published',500,101);
    INSERT INTO app_private.sessions VALUES('synthetic','{"passport":{"user":100}}',now()+interval '1 hour');`);
}

test('application security: dedicated PostgreSQL bootstrap and upgrades', {
  skip: !connectionString ? 'Set SECURITY_TEST_DATABASE_URL and SECURITY_TEST_CLUSTER_ID; use npm run test:security:db.' : false,
}, async t => {
  const url = new URL(connectionString);
  assert.ok(['localhost','127.0.0.1','[::1]'].includes(url.hostname), 'Explicit local host required');
  assert.match(process.env.SECURITY_TEST_CLUSTER_ID || '', /^\d+$/, 'Expected dedicated cluster system_identifier required');
  const admin = new Pool({ connectionString, connectionTimeoutMillis: 3000 });
  const pools = [];
  const databases = [];
  let createdRoles = false;
  t.after(async () => {
    for (const pool of pools) await pool.end();
    for (const name of databases) await admin.query(`DROP DATABASE ${name} WITH (FORCE)`);
    if (createdRoles) await admin.query('DROP ROLE anon, authenticated, security_observer');
    await admin.end();
  });
  // Read identity BEFORE any CREATE/DROP DATABASE or ROLE, not just hostname.
  const { rows: [server] } = await admin.query(`SELECT host(inet_server_addr()) AS ip,
    current_setting('cluster_name') AS name, system_identifier::text AS id, version()
    FROM pg_control_system()`);
  const expectedAddress = process.env.SECURITY_TEST_SERVER_ADDRESS;
  if (expectedAddress) assert.equal(server.ip,expectedAddress,'Dedicated container address must match its inventory');
  else assert.ok(['127.0.0.1','::1'].includes(server.ip));
  assert.equal(server.name, 'castme_security_test');
  assert.equal(server.id, process.env.SECURITY_TEST_CLUSTER_ID);
  t.diagnostic(server.version);
  assert.equal((await admin.query(`SELECT count(*)::int AS n FROM pg_roles
    WHERE rolname IN ('anon','authenticated','security_observer')`)).rows[0].n, 0,
  'Use a fresh dedicated cluster; never drop pre-existing roles for the no-API-role scenario');

  const schema = await readFile(path.resolve(__dirname,'../../db/schema.sql'), 'utf8');
  const migration = await readFile(path.resolve(__dirname,'../../db/migrations/20261118_application_security.sql'), 'utf8');
  const legacy = schema.split(marker)[0];
  assert.ok(legacy.length < schema.length, 'Bootstrap security block marker required');
  assert.equal(schema.split(marker)[1].replaceAll('\r\n','\n').trim(),
    migration.replaceAll('\r\n','\n').trim(), 'Keep the two real SQL copies identical');
  async function database(withGrants = true) {
    const name = 'security_test_' + randomUUID().replaceAll('-','');
    await admin.query(`CREATE DATABASE ${name}`);
    databases.push(name);
    const target = new URL(url);
    target.pathname = '/' + name;
    const db = new Pool({ connectionString: target.href });
    pools.push(db);
    if (withGrants) await db.query(`GRANT USAGE ON SCHEMA public TO anon,authenticated;
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated;
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon,authenticated;
      CREATE SCHEMA app_private;
      GRANT ALL ON SCHEMA app_private TO anon,authenticated;
      ALTER DEFAULT PRIVILEGES IN SCHEMA app_private GRANT ALL ON TABLES TO anon,authenticated;`);
    return db;
  }
  await t.test('ordinary PostgreSQL without Supabase roles supports the complete bootstrap and repeat upgrade', async () => {
    const db = await database(false);
    await db.query(schema);
    const before = await catalog(db);
    assertClosed(before);
    await migrateSecurity(db); await migrateSecurity(db);
    assert.deepEqual(await catalog(db), before);
  });
  await admin.query('CREATE ROLE anon NOSUPERUSER NOBYPASSRLS; CREATE ROLE authenticated NOSUPERUSER NOBYPASSRLS; CREATE ROLE security_observer NOSUPERUSER NOBYPASSRLS');
  createdRoles = true;
  const fresh = await database();
  let expected;
  await t.test('complete bootstrap closes every table with broad table/sequence grants and direct private grants', async () => {
    await fresh.query(schema);
    expected = await catalog(fresh);
    assert.equal(expected.tables.filter(x => x.name.startsWith('public.')).length, 20);
    assert.equal(expected.tables.filter(x => x.name.startsWith('app_private.')).length, 4);
    assertClosed(expected);
    for (const role of ['anon','authenticated']) {
      for (const privilege of ['SELECT','INSERT','UPDATE','DELETE']) {
        assert.equal((await fresh.query(`SELECT has_table_privilege($1,'public.skills',$2) AS granted`,
          [role,privilege])).rows[0].granted, true);
      }
      assert.equal((await fresh.query(`SELECT has_sequence_privilege($1,'public.skills_id_seq','USAGE') AS granted`,[role])).rows[0].granted,true);
    }
    await fresh.query('CREATE TABLE public.future_unprotected(id int)');
    const withNewTable = await catalog(fresh);
    assert.throws(() => assertClosed(withNewTable), /public.future_unprotected must have RLS/);
    await fresh.query('DROP TABLE public.future_unprotected');
  });

  // Compare all ACLs, policies, flags, owners and sequences from real catalogs.
  const upgraded = await database();
  await upgraded.query(legacy);
  await seed(upgraded);
  await upgraded.query('GRANT ALL ON SCHEMA app_private TO anon,authenticated; GRANT ALL ON app_private.sessions TO anon,authenticated');
  await t.test('legacy fixture reproduces the leak under real API roles before the fix', async () => {
    const unprotected = await catalog(upgraded);
    assert.equal(unprotected.tables.filter(table => !table.rls).length,12);
    assert.throws(() => assertClosed(unprotected), 'The original bootstrap must fail the security contract');
    const client = await upgraded.connect();
    try {
      await client.query('SET ROLE anon');
      assert.equal((await client.query('SELECT * FROM notifications')).rowCount,1);
      await client.query('BEGIN');
      assert.equal((await client.query("INSERT INTO skills(name) VALUES('Leaked write')")).rowCount,1);
      assert.equal((await client.query("UPDATE skills SET category='leaked' WHERE name='Leaked write'")).rowCount,1);
      assert.equal((await client.query("DELETE FROM skills WHERE name='Leaked write'")).rowCount,1);
      await client.query('ROLLBACK');
    } finally { await client.query('ROLLBACK'); await client.query('RESET ROLE'); client.release(); }
  });
  await t.test('upgrade preserves populated rows, IDs, links, constraints and invoker guards; repeat matches bootstrap', async () => {
    const before = await dataAndStructure(upgraded);
    await migrateSecurity(upgraded); await migrateSecurity(upgraded);
    assert.deepEqual(await catalog(upgraded), expected);
    assert.deepEqual(await dataAndStructure(upgraded), before);
    await assert.rejects(upgraded.query("UPDATE applications SET status='WITHDRAWN' WHERE id=600"), { code: '23514' });
    await assert.rejects(upgraded.query('INSERT INTO candidate_skills VALUES(NULL,300,999999)'), { code: '23503' });
    await assert.rejects(upgraded.query("INSERT INTO skills(name) VALUES('Acting')"), { code: '23505' });
  });
  await t.test('real API roles cannot SELECT/INSERT/UPDATE/DELETE populated sensitive, business or join rows', async () => {
    const statements = [
      ['notifications', "INSERT INTO notifications(type,title,message,user_id) VALUES('test','x','x',100)", "UPDATE notifications SET title='leaked'", 'DELETE FROM notifications'],
      ['skills', "INSERT INTO skills(name) VALUES('Denied')", "UPDATE skills SET category='leaked'", 'DELETE FROM skills'],
      ['candidate_skills', "INSERT INTO candidate_skills VALUES('basic',300,800)", "UPDATE candidate_skills SET proficiency='leaked'", 'DELETE FROM candidate_skills'],
      ['users', "INSERT INTO users(auth_id,email,role) VALUES('google:denied','denied@example.test','admin')", "UPDATE users SET first_name='leaked'", 'DELETE FROM users'],
      ['app_private.sessions', "INSERT INTO app_private.sessions VALUES('denied','{}',now())", "UPDATE app_private.sessions SET sess='{}'", 'DELETE FROM app_private.sessions'],
    ];
    const before = await dataAndStructure(upgraded);
    const client = await upgraded.connect();
    try {
      for (const role of ['anon','authenticated']) {
        await client.query(`SET ROLE ${role}`);
        for (const [table,insert,update,remove] of statements) {
          for (const [index,sql] of [`SELECT * FROM ${table}`,insert,update,remove].entries()) {
            await client.query('BEGIN');
            try {
              const result = await client.query(sql);
              assert.notEqual(index,1, `${role}: INSERT must fail, not succeed with zero rows`);
              assert.equal(result.rowCount,0,`${role}: ${sql}`);
            } catch (error) { assert.equal(error.code,'42501',`${role}: ${sql}`); }
            finally { await client.query('ROLLBACK'); }
          }
        }
        await client.query('RESET ROLE');
      }
    } finally { await client.query('RESET ROLE'); client.release(); }
    assert.deepEqual(await dataAndStructure(upgraded),before);
  });
  await t.test('older base plus auth upgrades without creating optional functional tables or columns', async () => {
    const db = await database();
    await db.query(legacy.split('-- Nullable additions preserve')[0]);
    await seed(db);
    const before = await dataAndStructure(db);
    await migrateSecurity(db); await migrateSecurity(db);
    const actual = await catalog(db);
    assertClosed(actual);
    assert.equal(actual.tables.length,18);
    assert.deepEqual(actual.tables, expected.tables.filter(x => !optional.includes(x.name)));
    assert.deepEqual(actual.schemas,expected.schemas);
    assert.deepEqual(actual.sequences,expected.sequences.filter(x => actual.sequences.some(y => x.name===y.name)));
    assert.deepEqual(await dataAndStructure(db),before);
    assert.equal((await db.query("SELECT count(*)::int AS n FROM information_schema.columns WHERE table_schema='public' AND column_name IN ('weight_kg','submitted_data')")).rows[0].n,0);
  });
  await t.test('missing required table fails with a diagnostic and no partial changes', async () => {
    const db = await database(); await db.query(legacy);
    await db.query('DROP TABLE public.application_files');
    const before = await catalog(db);
    await assert.rejects(migrateSecurity(db), /required table public.application_files is missing/);
    assert.deepEqual(await catalog(db),before);
  });
  await t.test('controlled rollback restores all flags and ACLs after the original SQL ran', async () => {
    const db = await database(); await db.query(legacy);
    const before = await catalog(db);
    const client = await db.connect();
    try {
      await client.query('BEGIN'); await client.query(migration);
      assertClosed(await catalog(client));
      await assert.rejects(client.query('SELECT 1/0'), { code: '22012' });
      await client.query('ROLLBACK');
    } finally { await client.query('ROLLBACK'); client.release(); }
    assert.deepEqual(await catalog(db),before);
  });
  await t.test('stricter grants and compatible existing policies are preserved without adding rights', async () => {
    const db = await database(); await db.query(legacy);
    await db.query(`REVOKE ALL ON public.skills FROM anon,authenticated;
      CREATE POLICY closed_api ON public.notifications TO anon,authenticated USING(false) WITH CHECK(false);
      CREATE POLICY observer ON public.skills TO security_observer USING(true);
      CREATE POLICY restrictive_api ON public.skills AS RESTRICTIVE TO anon USING(true);`);
    const before = await catalog(db);
    await migrateSecurity(db); await migrateSecurity(db);
    const after = await catalog(db); assertClosed(after);
    for (const table of after.tables) {
      const old = before.tables.find(x => x.name===table.name);
      assert.deepEqual(table.policies,old.policies);
      assert.ok(table.acl.every(a => old.acl.some(b => JSON.stringify(a)===JSON.stringify(b))),table.name);
    }
    assert.equal((await db.query("SELECT has_table_privilege('anon','public.skills','SELECT') AS allowed")).rows[0].allowed,false);
  });
  await t.test('public, direct and inherited permissive API policies abort before any changes', async () => {
    const db = await database(); await db.query(legacy);
    for (const [target,expression] of [['PUBLIC','true'],['anon','user_id=100'],['security_observer','true']]) {
      if (target==='security_observer') await admin.query('GRANT security_observer TO authenticated');
      try {
        await db.query(`CREATE POLICY incompatible ON public.notifications TO ${target} USING(${expression})`);
        const before = await catalog(db);
        await assert.rejects(migrateSecurity(db), /API policy incompatible on notifications is not provably closed/);
        assert.deepEqual(await catalog(db),before);
        await db.query('DROP POLICY incompatible ON public.notifications');
      } finally {
        if (target==='security_observer') await admin.query('REVOKE security_observer FROM authenticated');
      }
    }
  });
  await t.test('late inherited sensitive privilege failure rolls back earlier RLS and REVOKE changes', async () => {
    const db = await database(); await db.query(legacy);
    await db.query('GRANT SELECT ON public.users TO security_observer');
    await admin.query('GRANT security_observer TO anon');
    try {
      const before = await catalog(db);
      await assert.rejects(migrateSecurity(db), /retains inherited or column privileges/);
      assert.deepEqual(await catalog(db),before);
    } finally { await admin.query('REVOKE security_observer FROM anon'); }
  });
  await t.test('owner registration, real session store, guest Express casting, profiles, moderation and quota remain functional', async () => {
    const { createUserModel } = require('../src/auth/userModel');
    const { createCastingModel } = require('../src/models/castingModel');
    const { createCastingRouter } = require('../src/routes/castingRoutes');
    const { ApplicationRateLimitStore } = require('../src/middleware/applicationRateLimit');
    const session = require('express-session');
    const PgStore = require('connect-pg-simple')(session);
    const express = require('express');
    const { once } = require('node:events');
    const users = createUserModel(upgraded);
    const user = await users.register({ authId: 'google:after-upgrade',email: 'after@example.test' },
      { firstName: 'New',lastName: 'User',birthDate: '2000-01-01',role: 'candidate' });
    assert.equal((await users.findById(user.id)).id,user.id);
    const store = new PgStore({ pool: upgraded,schemaName: 'app_private',tableName: 'sessions',pruneSessionInterval: false });
    const invoke = (method,...args) => new Promise((resolve,reject) => store[method](...args,(e,data) => e ? reject(e) : resolve(data)));
    await invoke('set','server-session',{ cookie: { expires: new Date(Date.now()+60000) },passport: { user: user.id } });
    assert.equal((await invoke('get','server-session')).passport.user,user.id);
    await invoke('destroy','server-session');
    const app = express(); app.use('/api/castings',createCastingRouter({ model: createCastingModel(upgraded) }));
    const server = app.listen(0,'127.0.0.1'); await once(server,'listening');
    try {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api/castings`);
      assert.equal(response.status,200);
      assert.deepEqual((await response.json()).map(x => x.id),[500]);
    } finally { await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }); }
    await upgraded.query(`INSERT INTO profile_media(media_id,owner_user_id,candidate_id,purpose) VALUES(700,100,300,'avatar');
      INSERT INTO profile_storage_objects(storage_key) VALUES('synthetic/ledger');
      INSERT INTO casting_reports(casting_call_id,casting_title,reporter_id,reason) VALUES(500,'Public role',100,'Test report');
      INSERT INTO app_private.moderation_events(actor_id,action,entity_id) VALUES(101,'test',500);
      INSERT INTO app_private.moderation_file_cleanup(storage_key) VALUES('synthetic/cleanup');`);
    const quota = new ApplicationRateLimitStore(upgraded); quota.init({ windowMs: 60000 });
    assert.equal((await quota.increment(String(user.id))).totalHits,1);
    assert.equal((await quota.increment(String(user.id))).totalHits,2);
    assertClosed(await catalog(upgraded));
  });
});
