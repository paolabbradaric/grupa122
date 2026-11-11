'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Pool } = require('pg');
const { createEmployerCandidateSelectionModel } = require('../src/models/employerCandidateSelectionModel');
const enabled = process.env.EMPLOYER_SELECTION_DB_TESTS === '1';

test('Odabir kandidata: samo lokalni castme_test', {
  skip: enabled ? false : 'Za lokalni DB test postavi EMPLOYER_SELECTION_DB_TESTS=1.'
}, async t => {
  // Sigurnosna provjera prije bilo kakvog povezivanja.
  assert.equal(process.env.PGHOST, '127.0.0.1');
  assert.equal(process.env.PGPORT, '5432');
  assert.equal(process.env.PGDATABASE, 'castme_test');
  assert.equal(process.env.PGSSL, 'false');
  const db = new Pool({ host: '127.0.0.1', port: 5432, database: 'castme_test',
    user: process.env.PGUSER, password: process.env.PGPASSWORD || undefined,
    ssl: false, connectionTimeoutMillis: 3000 });
  const ids = { users: [], orgs: [], projects: [], castings: [], applications: [] };
  t.after(async () => {
    try {
      // Brisi samo vlastite testne zapise, prvo ovisne tablice.
      if (ids.applications.length) {
        await db.query('DELETE FROM application_status_history WHERE application_id = ANY($1::int[])', [ids.applications]);
      }
      if (ids.castings.length) {
        await db.query('DELETE FROM casting_call_status_history WHERE casting_call_id = ANY($1::int[])', [ids.castings]);
      }
      if (ids.applications.length) await db.query('DELETE FROM applications WHERE id = ANY($1::int[])', [ids.applications]);
      if (ids.castings.length) await db.query('DELETE FROM casting_calls WHERE id = ANY($1::int[])', [ids.castings]);
      if (ids.projects.length) await db.query('DELETE FROM projects WHERE id = ANY($1::int[])', [ids.projects]);
      if (ids.orgs.length) await db.query('DELETE FROM organisations WHERE id = ANY($1::int[])', [ids.orgs]);
      if (ids.users.length) {
        await db.query('DELETE FROM candidate_profiles WHERE user_id = ANY($1::int[])', [ids.users]);
        await db.query('DELETE FROM users WHERE id = ANY($1::int[])', [ids.users]);
      }
    } finally { await db.end(); }
  });
  const { rows: [server] } = await db.query('SELECT current_database() AS name, host(inet_server_addr()) AS ip');
  assert.equal(server.name, 'castme_test');
  assert.ok(['127.0.0.1', '::1'].includes(server.ip));
  const model = createEmployerCandidateSelectionModel(db);

  async function user(role) {
    const uuid = randomUUID();
    const { rows: [u] } = await db.query(`
      INSERT INTO users(auth_id,email,first_name,last_name,birth_date,role)
      VALUES ($1,$2,'Integration','Test','1990-01-01',$3) RETURNING id`,
    [`selection-${uuid}`, `selection-${uuid}@example.invalid`, role]);
    ids.users.push(u.id);
    if (role === 'candidate') {
      const { rows: [profile] } = await db.query(
        'INSERT INTO candidate_profiles(user_id) VALUES($1) RETURNING id', [u.id]);
      return { id: u.id, profileId: profile.id };
    }
    const { rows: [org] } = await db.query(`
      INSERT INTO organisations(owner_id,company_name,reg_num,contact_email)
      VALUES($1,'Selection Integration',$2,$3) RETURNING id`,
    [u.id, `selection-${uuid}`, `selection-${uuid}@example.invalid`]);
    ids.orgs.push(org.id);
    return { id: u.id, orgId: org.id };
  }
  const employer = await user('employer');
  const other = await user('employer');
  const c1 = await user('candidate');
  const c2 = await user('candidate');
  const c3 = await user('candidate');
  async function casting(positions = 2, status = 'published') {
    const { rows: [p] } = await db.query(`
      INSERT INTO projects(title,project_type,description,org_id)
      VALUES ('Selection test','film','Local only',$1) RETURNING id`, [employer.orgId]);
    ids.projects.push(p.id);
    const { rows: [c] } = await db.query(`
      INSERT INTO casting_calls(project_id,title,description,positions_count,max_applications,
        min_age,max_age,location,application_deadline,status)
      VALUES($1,'Selection test role','Local only',$2,1000,18,60,'Zagreb',NOW()+INTERVAL '30 days',$3)
      RETURNING id`, [p.id, positions, status]);
    ids.castings.push(c.id);
    return c.id;
  }
  async function apply(profileId, castingId, status = 'SUBMITTED') {
    const { rows: [a] } = await db.query(`
      INSERT INTO applications(candidate_id,casting_call_id,status)
      VALUES($1,$2,$3) RETURNING id`, [profileId, castingId, status]);
    ids.applications.push(a.id);
    return a.id;
  }
  const getStatus = async (table, id) => (await db.query(`SELECT status FROM ${table} WHERE id=$1`, [id])).rows[0].status;

  await t.test('prvi odabir ne popunjava oglas, drugi ga automatski popunjava', async () => {
    const id = await casting();
    const a1 = await apply(c1.profileId, id);
    const a2 = await apply(c2.profileId, id);
    const r1 = await model.select(employer.id, id, a1);
    assert.equal(r1.castingStatus, 'published');
    assert.equal(await getStatus('applications', a1), 'SELECTED');
    const r2 = await model.select(employer.id, id, a2);
    assert.equal(r2.castingStatus, 'filled');
    assert.equal(await getStatus('casting_calls', id), 'filled');
    const { rows: [h] } = await db.query(`
      SELECT old_status, new_status, changed_by FROM casting_call_status_history
      WHERE casting_call_id = $1`, [id]);
    assert.deepEqual(h, { old_status: 'published', new_status: 'filled', changed_by: employer.id });
    const { rows: history } = await db.query(`
      SELECT old_status, new_status FROM application_status_history
      WHERE application_id = ANY($1::int[])`, [[a1,a2]]);
    assert.equal(history.length, 2);
    assert.ok(history.every(h => h.old_status === 'SUBMITTED' && h.new_status === 'SELECTED'));
  });

  await t.test('tudi poslodavac i prijava s drugog oglasa nemaju pristup', async () => {
    const id = await casting();
    const otherCasting = await casting();
    const app = await apply(c1.profileId, otherCasting);
    assert.equal((await model.select(other.id, id, app)).outcome, 'not_found');
    assert.equal((await model.select(employer.id, id, app)).outcome, 'application_not_found');
    assert.equal(await getStatus('applications', app), 'SUBMITTED');
  });

  await t.test('isti kandidat ne moze biti dva puta odabran', async () => {
    const id = await casting();
    const app = await apply(c1.profileId, id);
    await model.select(employer.id, id, app);
    assert.equal((await model.select(employer.id, id, app)).outcome, 'already_selected');
  });

  await t.test('nema odabira na otkazanom oglasu', async () => {
    const id = await casting(1, 'cancelled');
    const app = await apply(c1.profileId, id);
    assert.equal((await model.select(employer.id, id, app)).outcome, 'invalid_status');
    assert.equal(await getStatus('applications', app), 'SUBMITTED');
  });

  await t.test('rollback vraca aplikaciju u SUBMITTED ako povijest ne uspije', async () => {
    const id = await casting();
    const app = await apply(c3.profileId, id);
    const failing = {
      async connect() {
        const client = await db.connect();
        return {
          async query(sql, params) {
            if (sql.includes('INSERT INTO application_status_history')) throw new Error('History failure');
            return client.query(sql, params);
          },
          release() { client.release(); }
        };
      }
    };
    await assert.rejects(createEmployerCandidateSelectionModel(failing).select(employer.id,id,app), /History failure/);
    assert.equal(await getStatus('applications', app), 'SUBMITTED');
  });
});
