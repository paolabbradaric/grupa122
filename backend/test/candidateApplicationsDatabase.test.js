'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');
const { createCandidateApplicationsModel } = require('../src/models/candidateApplicationsModel');
const { createEmployerCandidateSelectionModel } = require('../src/models/employerCandidateSelectionModel');
const { createEmployerApplicationStatusModel } = require('../src/models/employerApplicationStatusModel');

test('Moje prijave i povlacenje: iskljucivo lokalni castme_test', {
  skip: process.env.CANDIDATE_APPLICATIONS_DB_TESTS === '1' ? false : 'Pokreni s CANDIDATE_APPLICATIONS_DB_TESTS=1 na lokalnom castme_test.'
}, async t => {
  assert.equal(process.env.PGHOST, '127.0.0.1');
  assert.equal(process.env.PGPORT, '5432');
  assert.equal(process.env.PGDATABASE, 'castme_test');
  assert.equal(process.env.PGSSL, 'false');
  const schema = 'candidate_api_' + randomUUID().replaceAll('-', '');
  let schemaCreated = false;
  const db = new Pool({ options: `-c search_path=${schema},public`, host: '127.0.0.1', port: 5432, database: 'castme_test',
    user: process.env.PGUSER, password: process.env.PGPASSWORD || undefined,
    ssl: false, connectionTimeoutMillis: 3000 });
  const ids = { users: [], profiles: [], orgs: [], projects: [], castings: [], applications: [], slots: [], bookings: [] };
  t.after(async () => {
    try {
      // Samo zapisi kreirani u ovom izvođenju.
      if (ids.applications.length) await db.query('DELETE FROM application_status_history WHERE application_id = ANY($1::int[])', [ids.applications]);
      for (const [table, key] of [['audition_bookings', 'bookings'], ['audition_slots', 'slots'],
        ['applications', 'applications'], ['casting_calls', 'castings'], ['projects', 'projects'],
        ['organisations', 'orgs'], ['candidate_profiles', 'profiles'], ['users', 'users']]) {
        if (ids[key].length) await db.query(`DELETE FROM ${table} WHERE id = ANY($1::int[])`, [ids[key]]);
      }
    } finally {
      try { if (schemaCreated) await db.query(`DROP SCHEMA ${schema} CASCADE`); }
      finally { await db.end(); }
    }
  });
  // Potvrda stvarnog servera prije prvog upisa, uz provjere parametara iznad.
  const { rows: [server] } = await db.query('SELECT current_database() AS name, host(inet_server_addr()) AS ip');
  assert.equal(server.name, 'castme_test');
  assert.ok(['127.0.0.1', '::1'].includes(server.ip));
  // Vlastita shema čuva i lokalne postojeće podatke i triggere netaknutima.
  await db.query(`CREATE SCHEMA ${schema}`);
  schemaCreated = true;
  const initialSchema = fs.readFileSync(path.resolve(__dirname, '../../db/schema.sql'), 'utf8');
  const coreEnd = initialSchema.indexOf('CREATE SCHEMA IF NOT EXISTS app_private;');
  assert.ok(coreEnd > 0);
  await db.query(initialSchema.slice(0, coreEnd));
  const migration = fs.readFileSync(path.resolve(__dirname,
    '../../db/migrations/20261112_candidate_withdrawal_booking_guard.sql'), 'utf8');
  await db.query(migration);
  await db.query(migration); // Migracija mora biti ponovljiva i na novoj shemi.


  async function user(role) {
    const uuid = randomUUID();
    const { rows: [u] } = await db.query(`
      INSERT INTO users(auth_id, email, first_name, last_name, birth_date, role)
      VALUES ($1, $2, 'Candidate', 'Integration', '1990-01-01', $3) RETURNING id`,
    [`candidate-test-${uuid}`, `candidate-test-${uuid}@example.invalid`, role]);
    ids.users.push(u.id);
    if (role === 'candidate') {
      const { rows: [profile] } = await db.query('INSERT INTO candidate_profiles(user_id) VALUES ($1) RETURNING id', [u.id]);
      ids.profiles.push(profile.id);
      return { id: u.id, profileId: profile.id };
    }
    const { rows: [org] } = await db.query(`
      INSERT INTO organisations(owner_id, company_name, reg_num, contact_email)
      VALUES ($1, 'Candidate API Integration', $2, $3) RETURNING id`, [u.id, uuid, `candidate-org-${uuid}@example.invalid`]);
    ids.orgs.push(org.id);
    return { id: u.id, orgId: org.id };
  }
  const employer = await user('employer');
  const owner = await user('candidate');
  const other = await user('candidate');
  async function casting(status = 'published') {
    const { rows: [project] } = await db.query(`
      INSERT INTO projects(title, project_type, description, org_id)
      VALUES ('Candidate API project', 'film', 'Local test only', $1) RETURNING id`, [employer.orgId]);
    ids.projects.push(project.id);
    const { rows: [c] } = await db.query(`
      INSERT INTO casting_calls(project_id, title, description, positions_count, max_applications,
        min_age, max_age, location, application_deadline, status)
      VALUES ($1, 'Candidate API role', 'Local test only', 2, 1000, 18, 60, 'Zagreb', NOW()+INTERVAL '30 days', $2)
      RETURNING id`, [project.id, status]);
    ids.castings.push(c.id);
    return c.id;
  }
  async function apply(status = 'SUBMITTED', candidate = owner, castingId) {
    castingId ??= await casting();
    const { rows: [application] } = await db.query(`
      INSERT INTO applications(candidate_id, casting_call_id, status)
      VALUES ($1, $2, $3) RETURNING id, casting_call_id AS "castingId"`, [candidate.profileId, castingId, status]);
    ids.applications.push(application.id);
    return application;
  }
  async function booking(application, status) {
    const { rows: [slot] } = await db.query(`
      INSERT INTO audition_slots(casting_call_id, starts_at, ends_at, location, capacity, status)
      VALUES ($1, NOW()+INTERVAL '7 days', NOW()+INTERVAL '7 days 1 hour', 'Zagreb', 2, 'scheduled') RETURNING id`, [application.castingId]);
    ids.slots.push(slot.id);
    const { rows: [b] } = await db.query(`
      INSERT INTO audition_bookings(audition_slot_id, application_id, status, booked_at)
      VALUES ($1, $2, $3, NOW()) RETURNING id`, [slot.id, application.id, status]);
    ids.bookings.push(b.id);
    return b.id;
  }
  const state = async id => (await db.query('SELECT status FROM applications WHERE id = $1', [id])).rows[0].status;
  const history = async id => (await db.query(`
    SELECT old_status, new_status, reason, changed_by FROM application_status_history
    WHERE application_id = $1 ORDER BY id`, [id])).rows;
  const model = createCandidateApplicationsModel(db);

  await t.test('popis vraca samo vlastite prijave, podatke projekta i sve statuse oglasa', async () => {
    const c1 = await casting('closed');
    const a1 = await apply('REJECTED', owner, c1);
    const c2 = await casting('cancelled');
    const a2 = await apply('WITHDRAWN', owner, c2);
    const foreign = await apply('SUBMITTED', other, c1);
    await db.query("UPDATE applications SET submitted_at = '2026-11-01T12:00:00Z' WHERE id = ANY($1::int[])", [[a1.id, a2.id]]);
    await db.query("UPDATE applications SET rejection_reason = 'Razlog odbijanja.' WHERE id = $1", [a1.id]);
    const rows = await model.listMine(owner.id);
    assert.deepEqual(rows.map(a => a.id), [a2.id, a1.id]);
    assert.equal(rows.some(a => a.id === foreign.id), false);
    assert.equal(rows[0].projectTitle, 'Candidate API project');
    assert.equal(rows[0].projectType, 'film');
    assert.equal(rows[0].roleTitle, 'Candidate API role');
    assert.equal(rows[0].location, 'Zagreb');
    assert.equal(rows[0].castingStatus, 'cancelled');
    assert.equal(rows[0].status, 'WITHDRAWN');
    assert.equal(rows[1].rejectionReason, 'Razlog odbijanja.');
    assert.ok(rows[0].submittedAt instanceof Date);
    assert.deepEqual((await model.listMine(other.id)).map(a => a.id), [foreign.id]);
    assert.deepEqual(await model.listMine(employer.id), []);
  });

  await t.test('sva cetiri dopustena statusa prelaze u WITHDRAWN s povijescu', async () => {
    for (const status of ['SUBMITTED', 'UNDER_REVIEW', 'SHORTLISTED', 'INVITED']) {
      const app = await apply(status);
      assert.deepEqual(await model.withdraw(owner.id, app.id), {
        outcome: 'withdrawn', applicationId: app.id, oldStatus: status, status: 'WITHDRAWN'
      });
      assert.equal(await state(app.id), 'WITHDRAWN');
      assert.deepEqual(await history(app.id), [{ old_status: status, new_status: 'WITHDRAWN',
        reason: 'Prijavu povukao kandidat.', changed_by: owner.id }]);
      assert.equal((await db.query('SELECT status FROM casting_calls WHERE id = $1', [app.castingId])).rows[0].status, 'published');
    }
  });

  await t.test('tuđa i nepostojeca prijava ne mogu se povuci', async () => {
    const app = await apply();
    assert.deepEqual(await model.withdraw(other.id, app.id), { outcome: 'not_found' });
    assert.deepEqual(await model.withdraw(owner.id, -1), { outcome: 'not_found' });
    assert.equal(await state(app.id), 'SUBMITTED');
    assert.deepEqual(await history(app.id), []);
  });

  await t.test('zavrsni i nepoznati statusi nemaju dopusteni prijelaz', async () => {
    for (const status of ['AUDITIONED', 'ACCEPTED', 'SELECTED', 'REJECTED', 'WITHDRAWN', 'CANCELLED', 'UNKNOWN']) {
      const app = await apply(status);
      assert.deepEqual(await model.withdraw(owner.id, app.id), { outcome: 'invalid_status' });
      assert.equal(await state(app.id), status);
      assert.deepEqual(await history(app.id), []);
    }
  });

  await t.test('aktivna rezervacija odbija povlacenje i ostaje nepromijenjena', async () => {
    const app = await apply('INVITED');
    const b = await booking(app, 'confirmed');
    assert.deepEqual(await model.withdraw(owner.id, app.id), { outcome: 'active_bookings' });
    assert.equal(await state(app.id), 'INVITED');
    assert.deepEqual(await history(app.id), []);
    assert.equal((await db.query('SELECT status FROM audition_bookings WHERE id = $1', [b])).rows[0].status, 'confirmed');
  });

  await t.test('vec otkazane rezervacije ne blokiraju povlacenje niti se mijenjaju', async () => {
    for (const status of ['cancelled', 'canceled']) {
      const app = await apply('INVITED');
      const b = await booking(app, status);
      assert.equal((await model.withdraw(owner.id, app.id)).outcome, 'withdrawn');
      assert.equal((await db.query('SELECT status FROM audition_bookings WHERE id = $1', [b])).rows[0].status, status);
    }
  });

  await t.test('neuspjela povijest vraca stvarni upis prijave rollbackom', async () => {
    const app = await apply('SHORTLISTED');
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
    await assert.rejects(createCandidateApplicationsModel(failing).withdraw(owner.id, app.id), /History failure/);
    assert.equal(await state(app.id), 'SHORTLISTED');
    assert.deepEqual(await history(app.id), []);
  });

  await t.test('dvije istodobne radnje povlacenja stvaraju samo jednu povijest', async () => {
    const app = await apply();
    const results = await Promise.all([model.withdraw(owner.id, app.id), model.withdraw(owner.id, app.id)]);
    assert.deepEqual(results.map(r => r.outcome).sort(), ['invalid_status', 'withdrawn']);
    assert.equal(await state(app.id), 'WITHDRAWN');
    assert.equal((await history(app.id)).length, 1);
  });

  async function raceBookingWrite(app, sql, params) {
    const updater = await db.connect();
    const { rows: [{ pid }] } = await updater.query('SELECT pg_backend_pid() AS pid');
    let pending;
    let finished = false;
    const racing = {
      async connect() {
        const client = await db.connect();
        return {
          async query(query, values) {
            const result = await client.query(query, values);
            if (query.includes('AS has_active_bookings')) {
              pending = updater.query(sql, params).then(result => {
                for (const row of result.rows) ids.bookings.push(row.id);
                return { updated: true };
              }, error => ({ error }));
              pending.then(() => { finished = true; });
              const deadline = Date.now() + 5000;
              while (!finished) {
                const { rows: [activity] } = await db.query('SELECT wait_event_type FROM pg_stat_activity WHERE pid = $1', [pid]);
                if (activity?.wait_event_type === 'Lock') break;
                if (Date.now() > deadline) throw new Error('Concurrent booking query did not start');
              }
            }
            return result;
          },
          release() { client.release(); }
        };
      }
    };
    try {
      const result = await createCandidateApplicationsModel(racing).withdraw(owner.id, app.id);
      assert.equal(result.outcome, 'withdrawn');
      return await pending;
    } finally {
      if (pending) await pending;
      updater.release();
    }
  }

  await t.test('konkurentna reaktivacija rezervacije ne ostavlja aktivnu rezervaciju na WITHDRAWN prijavi', async () => {
    const app = await apply('INVITED');
    const b = await booking(app, 'cancelled');
    const result = await raceBookingWrite(app, "UPDATE audition_bookings SET status = 'confirmed' WHERE id = $1", [b]);
    assert.equal(result.error?.code, '23514');
    assert.equal((await db.query('SELECT status FROM audition_bookings WHERE id = $1', [b])).rows[0].status, 'cancelled');
    assert.equal(await state(app.id), 'WITHDRAWN');
    assert.equal((await history(app.id)).length, 1);
  });

  await t.test('konkurentni INSERT rezervacije ne zaobilazi povlacenje', async () => {
    const app = await apply('INVITED');
    const b = await booking(app, 'cancelled');
    const { rows: [row] } = await db.query('SELECT audition_slot_id FROM audition_bookings WHERE id = $1', [b]);
    const result = await raceBookingWrite(app, `INSERT INTO audition_bookings(audition_slot_id, application_id, status, booked_at)
      VALUES ($1, $2, 'confirmed', NOW()) RETURNING id`, [row.audition_slot_id, app.id]);
    assert.equal(result.error?.code, '23514');
    assert.equal((await db.query('SELECT count(*)::int AS n FROM audition_bookings WHERE application_id = $1', [app.id])).rows[0].n, 1);
    assert.equal(await state(app.id), 'WITHDRAWN');
  });

  await t.test('rezervacija koja prva zakljuca prijavu blokira konkurentno povlacenje', async () => {
    const app = await apply('INVITED');
    const b = await booking(app, 'cancelled');
    const updater = await db.connect();
    let transaction = false;
    let pending;
    let notifyPid;
    let finished = false;
    const started = new Promise(resolve => { notifyPid = resolve; });
    const observed = {
      async connect() {
        const client = await db.connect();
        const { rows: [{ pid }] } = await client.query('SELECT pg_backend_pid() AS pid');
        notifyPid(pid);
        return client;
      }
    };
    try {
      await updater.query('BEGIN');
      transaction = true;
      await updater.query("UPDATE audition_bookings SET status = 'confirmed' WHERE id = $1", [b]);
      pending = createCandidateApplicationsModel(observed).withdraw(owner.id, app.id);
      pending.then(() => { finished = true; }, () => { finished = true; });
      const pid = await started;
      const deadline = Date.now() + 5000;
      let blocked = false;
      while (!finished && !blocked) {
        const { rows: [activity] } = await db.query('SELECT wait_event_type FROM pg_stat_activity WHERE pid = $1', [pid]);
        blocked = activity?.wait_event_type === 'Lock';
        if (Date.now() > deadline) throw new Error('Withdrawal did not wait for booking');
      }
      assert.equal(blocked, true);
      await updater.query('COMMIT');
      transaction = false;
      assert.deepEqual(await pending, { outcome: 'active_bookings' });
      assert.equal(await state(app.id), 'INVITED');
      assert.deepEqual(await history(app.id), []);
    } finally {
      if (transaction) await updater.query('ROLLBACK');
      if (pending) await pending.catch(() => {});
      updater.release();
    }
  });

  await t.test('DB zastita odbija izravni SQL koji bi zaobisao provjere modela', async () => {
    const active = await apply('INVITED');
    const b = await booking(active, 'confirmed');
    await assert.rejects(db.query("UPDATE applications SET status = 'WITHDRAWN' WHERE id = $1", [active.id]),
      { code: '23514', constraint: 'applications_withdrawal_without_active_bookings' });
    assert.equal(await state(active.id), 'INVITED');
    const withdrawn = await apply('WITHDRAWN');
    await assert.rejects(booking(withdrawn, 'confirmed'),
      { code: '23514', constraint: 'audition_bookings_application_not_withdrawn' });
    await assert.rejects(db.query('UPDATE audition_bookings SET application_id = $1 WHERE id = $2', [withdrawn.id, b]),
      { code: '23514', constraint: 'audition_bookings_application_not_withdrawn' });
  });

  await t.test('stari REPEATABLE READ snapshot ne zaobilazi konkurentno potvrdenu rezervaciju', async () => {
    const app = await apply('INVITED');
    const stale = await db.connect();
    try {
      await stale.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
      await stale.query('SELECT status FROM applications WHERE id = $1', [app.id]);
      await booking(app, 'confirmed');
      await assert.rejects(stale.query("UPDATE applications SET status = 'WITHDRAWN' WHERE id = $1", [app.id]),
        { code: '40001' });
      await stale.query('ROLLBACK');
      assert.equal(await state(app.id), 'INVITED');
      assert.deepEqual(await history(app.id), []);
    } finally {
      await stale.query('ROLLBACK');
      stale.release();
    }
  });

  await t.test('iskljucena ili nedostajuca DB zastita zatvara povlacenje bez upisa', async () => {
    const app = await apply();
    try {
      await db.query('ALTER TABLE audition_bookings DISABLE TRIGGER audition_bookings_withdrawal_guard');
      assert.deepEqual(await model.withdraw(owner.id, app.id), { outcome: 'integration_unavailable' });
      await db.query('DROP TRIGGER audition_bookings_withdrawal_guard ON audition_bookings');
      assert.deepEqual(await model.withdraw(owner.id, app.id), { outcome: 'integration_unavailable' });
      assert.equal(await state(app.id), 'SUBMITTED');
      assert.deepEqual(await history(app.id), []);
    } finally { await db.query(migration); }
  });

  await t.test('migracija se ponistava ako legacy podaci vec krse invariant', async () => {
    const app = await apply('WITHDRAWN');
    let b;
    const client = await db.connect();
    try {
      await client.query('DROP TRIGGER audition_bookings_withdrawal_guard ON audition_bookings');
      await client.query('DROP TRIGGER applications_withdrawal_guard ON applications');
      b = await booking(app, 'confirmed');
      await assert.rejects(client.query(migration), { code: '23514' });
      await client.query('ROLLBACK');
      const fresh = await apply();
      assert.deepEqual(await model.withdraw(owner.id, fresh.id), { outcome: 'integration_unavailable' });
      assert.equal(await state(fresh.id), 'SUBMITTED');
    } finally {
      await client.query('ROLLBACK');
      if (b) await client.query("UPDATE audition_bookings SET status = 'cancelled' WHERE id = $1", [b]);
      await client.query(migration);
      client.release();
    }
  });

  await t.test('guard funkcije su SECURITY INVOKER s fiksnim search_path bez iskljucivanja RLS-a', async () => {
    const { rows } = await db.query(`SELECT p.prosecdef, p.proconfig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = $1 AND p.proname IN ('guard_active_audition_booking', 'guard_application_withdrawal')`, [schema]);
    assert.equal(rows.length, 2);
    for (const row of rows) {
      assert.equal(row.prosecdef, false);
      assert.deepEqual(row.proconfig, ['search_path=pg_catalog']);
    }
  });

  await t.test('povucena prijava ostaje vidljiva, ne moze napredovati i ne omogucuje duplu prijavu', async () => {
    const app = await apply();
    await model.withdraw(owner.id, app.id);
    assert.equal((await model.listMine(owner.id)).find(a => a.id === app.id).status, 'WITHDRAWN');
    assert.equal((await createEmployerCandidateSelectionModel(db).select(employer.id, app.castingId, app.id)).outcome,
      'invalid_application_status');
    assert.equal((await createEmployerApplicationStatusModel(db).changeStatus(employer.id, app.castingId, app.id, 'UNDER_REVIEW')).outcome,
      'invalid_transition');
    await assert.rejects(db.query(`INSERT INTO applications(candidate_id, casting_call_id, status)
      VALUES ($1, $2, 'SUBMITTED')`, [owner.profileId, app.castingId]), { code: '23505', constraint: 'application_unique' });
    assert.equal((await history(app.id)).length, 1);
  });
});
