'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Pool } = require('pg');
const { createEmployerCastingStatusModel } =
  require('../src/models/employerCastingStatusModel');

const enabled = process.env.EMPLOYER_CASTING_STATUS_DB_TESTS === '1';

test('Statusi oglasa: integracija iskljucivo s lokalnim castme_test', {
  skip: enabled ? false : 'Pokreni s EMPLOYER_CASTING_STATUS_DB_TESTS=1.'
}, async (t) => {
  // Ova provjera mora se izvrsiti prije uspostavljanja veze s bazom.
  assert.equal(process.env.PGHOST, '127.0.0.1');
  assert.equal(process.env.PGPORT, '5432');
  assert.equal(process.env.PGDATABASE, 'castme_test');
  assert.equal(process.env.PGSSL, 'false');

  const db = new Pool({
    host: '127.0.0.1', port: 5432, database: 'castme_test',
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD || undefined,
    ssl: false, connectionTimeoutMillis: 3000
  });
  const ids = {
    users: [], orgs: [], projects: [], castings: [],
    applications: [], slots: [], bookings: []
  };

  t.after(async () => {
    try {
      // Brisu se samo zapisi koje je stvorio ovaj test.
      if (ids.castings.length) {
        await db.query(
          'DELETE FROM casting_call_status_history WHERE casting_call_id = ANY($1::int[])',
          [ids.castings]
        );
      }
      if (ids.bookings.length) {
        await db.query('DELETE FROM audition_bookings WHERE id = ANY($1::int[])', [ids.bookings]);
      }
      if (ids.slots.length) {
        await db.query('DELETE FROM audition_slots WHERE id = ANY($1::int[])', [ids.slots]);
      }
      if (ids.applications.length) {
        await db.query('DELETE FROM applications WHERE id = ANY($1::int[])', [ids.applications]);
      }
      if (ids.castings.length) {
        await db.query('DELETE FROM casting_calls WHERE id = ANY($1::int[])', [ids.castings]);
      }
      if (ids.projects.length) {
        await db.query('DELETE FROM projects WHERE id = ANY($1::int[])', [ids.projects]);
      }
      if (ids.orgs.length) {
        await db.query('DELETE FROM organisations WHERE id = ANY($1::int[])', [ids.orgs]);
      }
      if (ids.users.length) {
        await db.query('DELETE FROM candidate_profiles WHERE user_id = ANY($1::int[])', [ids.users]);
        await db.query('DELETE FROM users WHERE id = ANY($1::int[])', [ids.users]);
      }
    } finally {
      await db.end();
    }
  });

  // Dodatna provjera identiteta stvarnog PostgreSQL servera.
  const { rows: [server] } = await db.query(
    'SELECT current_database() AS name, host(inet_server_addr()) AS ip'
  );
  assert.equal(server.name, 'castme_test');
  assert.ok(['127.0.0.1', '::1'].includes(server.ip));

  const model = createEmployerCastingStatusModel(db);

  async function makeUser(role) {
    const unique = randomUUID();
    const { rows: [row] } = await db.query(`
      INSERT INTO users (auth_id, email, first_name, last_name, birth_date, role)
      VALUES ($1, $2, 'Local', 'Test', '1990-01-01', $3)
      RETURNING id
    `, [`status-test-${unique}`, `status-${unique}@example.invalid`, role]);
    ids.users.push(row.id);
    if (role === 'employer') {
      const { rows: [org] } = await db.query(`
        INSERT INTO organisations
          (owner_id, company_name, reg_num, contact_email)
        VALUES ($1, 'Status Test Org', $2, $3)
        RETURNING id
      `, [row.id, `S-${unique}`, `status-${unique}@example.invalid`]);
      ids.orgs.push(org.id);
      return { userId: row.id, orgId: org.id };
    }
    const { rows: [profile] } = await db.query(`
      INSERT INTO candidate_profiles(user_id) VALUES ($1) RETURNING id
    `, [row.id]);
    return { userId: row.id, profileId: profile.id };
  }

  const owner = await makeUser('employer');
  const other = await makeUser('employer');
  const candidate = await makeUser('candidate');

  async function makeCasting(status = 'published') {
    const { rows: [project] } = await db.query(`
      INSERT INTO projects (title, project_type, description, org_id)
      VALUES ('Status test project', 'film', 'Test project', $1)
      RETURNING id
    `, [owner.orgId]);
    ids.projects.push(project.id);
    const { rows: [casting] } = await db.query(`
      INSERT INTO casting_calls
        (project_id, status, title, description, positions_count,
         max_applications, min_age, max_age, location, application_deadline)
      VALUES ($1, $2, 'Test role', 'Test role description', 2,
              1000, 18, 55, 'Zagreb', NOW() + INTERVAL '20 days')
      RETURNING id
    `, [project.id, status]);
    ids.castings.push(casting.id);
    return casting.id;
  }

  async function makeSlot(castingId, bookingStatus = null) {
    const { rows: [slot] } = await db.query(`
      INSERT INTO audition_slots
        (casting_call_id, starts_at, ends_at, location, capacity, status)
      VALUES ($1, NOW() + INTERVAL '5 days',
              NOW() + INTERVAL '5 days 1 hour', 'Zagreb', 10, 'open')
      RETURNING id
    `, [castingId]);
    ids.slots.push(slot.id);
    if (bookingStatus !== null) {
      const { rows: [application] } = await db.query(`
        INSERT INTO applications (candidate_id, casting_call_id, status)
        VALUES ($1, $2, 'SUBMITTED') RETURNING id
      `, [candidate.profileId, castingId]);
      ids.applications.push(application.id);
      const { rows: [booking] } = await db.query(`
        INSERT INTO audition_bookings
          (audition_slot_id, application_id, booked_at, status)
        VALUES ($1, $2, NOW(), $3) RETURNING id
      `, [slot.id, application.id, bookingStatus]);
      ids.bookings.push(booking.id);
    }
    return slot.id;
  }

  const state = async id => (
    await db.query('SELECT status FROM casting_calls WHERE id = $1', [id])
  ).rows[0].status;
  const history = async id => (
    await db.query(
      `SELECT old_status, new_status, changed_by
       FROM casting_call_status_history
       WHERE casting_call_id = $1 ORDER BY id`, [id])
  ).rows;

  await t.test('vlasnik zatvara objavljeni oglas i zapisuje povijest', async () => {
    const id = await makeCasting();
    assert.deepEqual(await model.close(owner.userId, id),
      { outcome: 'updated', id, status: 'closed' });
    assert.equal(await state(id), 'closed');
    assert.deepEqual(await history(id),
      [{ old_status: 'published', new_status: 'closed', changed_by: owner.userId }]);
  });

  await t.test('ponovno zatvaranje nije dopusteno', async () => {
    const id = await makeCasting('closed');
    assert.equal((await model.close(owner.userId, id)).outcome, 'invalid_status');
    assert.equal(await state(id), 'closed');
    assert.equal((await history(id)).length, 0);
  });

  await t.test('drugi poslodavac ne smije promijeniti tudji oglas', async () => {
    const id = await makeCasting();
    assert.equal((await model.close(other.userId, id)).outcome, 'not_found');
    assert.equal((await model.cancel(other.userId, id)).outcome, 'not_found');
    assert.equal(await state(id), 'published');
    assert.equal((await history(id)).length, 0);
  });

  await t.test('otkazivanje objavljenog oglasa otkazuje buduce termine', async () => {
    const id = await makeCasting();
    const slotId = await makeSlot(id);
    assert.equal((await model.cancel(owner.userId, id)).outcome, 'updated');
    assert.equal(await state(id), 'cancelled');
    const { rows: [slot] } = await db.query(
      'SELECT status FROM audition_slots WHERE id = $1', [slotId]);
    assert.equal(slot.status, 'cancelled');
    assert.deepEqual(await history(id),
      [{ old_status: 'published', new_status: 'cancelled', changed_by: owner.userId }]);
  });

  await t.test('zatvoreni oglas se moze otkazati', async () => {
    const id = await makeCasting('closed');
    assert.equal((await model.cancel(owner.userId, id)).outcome, 'updated');
    assert.equal(await state(id), 'cancelled');
    assert.equal((await history(id))[0].old_status, 'closed');
  });

  await t.test('aktivna buduca rezervacija blokira otkazivanje', async () => {
    const id = await makeCasting();
    const slotId = await makeSlot(id, 'booked');
    assert.equal((await model.cancel(owner.userId, id)).outcome, 'active_bookings');
    assert.equal(await state(id), 'published');
    const { rows: [slot] } = await db.query(
      'SELECT status FROM audition_slots WHERE id = $1', [slotId]);
    assert.equal(slot.status, 'open');
    assert.equal((await history(id)).length, 0);
  });

  await t.test('SQL greska pri pisanju povijesti vraca cijelu transakciju', async () => {
    const id = await makeCasting();
    const failingDatabase = {
      async connect() {
        const client = await db.connect();
        return {
          async query(sql, params) {
            if (sql.includes('INSERT INTO casting_call_status_history')) {
              throw new Error('Simulirana greska povijesti');
            }
            return client.query(sql, params);
          },
          release() { client.release(); }
        };
      }
    };
    await assert.rejects(
      createEmployerCastingStatusModel(failingDatabase).close(owner.userId, id),
      /Simulirana greska povijesti/
    );
    assert.equal(await state(id), 'published');
    assert.equal((await history(id)).length, 0);
  });
});
