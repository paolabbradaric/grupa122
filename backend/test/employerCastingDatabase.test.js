'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Pool } = require('pg');
const { createEmployerCastingModel } = require('../src/models/employerCastingModel');

const enabled = process.env.EMPLOYER_CASTING_DB_TESTS === '1';
const localOnly = ['127.0.0.1', 'localhost'].includes(process.env.PGHOST)
  && Number(process.env.PGPORT) === 5432
  && process.env.PGDATABASE === 'castme_test'
  && process.env.PGSSL === 'false';

test('Poslodavčevi oglasi: lokalni PostgreSQL integracijski test', {
  skip: !enabled ? 'Pokreni s EMPLOYER_CASTING_DB_TESTS=1.' : false,
}, async (t) => {
  assert.ok(localOnly, 'STOP: test dopušta samo lokalni 127.0.0.1:5432/castme_test s PGSSL=false.');

  const database = new Pool({
    host: '127.0.0.1', port: 5432, database: 'castme_test',
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD || undefined,
    ssl: false,
    connectionTimeoutMillis: 3000,
  });
  const userIds = [];
  const orgIds = [];
  const projectIds = [];

  t.after(async () => {
    try {
      // Brisanje samo naših testnih zapisa, ne i stvarnih podataka u bazi.
      if (projectIds.length) {
        await database.query('DELETE FROM casting_calls WHERE project_id = ANY($1::int[])', [projectIds]);
        await database.query('DELETE FROM projects WHERE id = ANY($1::int[])', [projectIds]);
      }
      if (orgIds.length) await database.query('DELETE FROM organisations WHERE id = ANY($1::int[])', [orgIds]);
      if (userIds.length) await database.query('DELETE FROM users WHERE id = ANY($1::int[])', [userIds]);
    } finally {
      await database.end();
    }
  });

  const { rows: [server] } = await database.query(
    'SELECT current_database() AS db, host(inet_server_addr()) AS server'
  );
  assert.equal(server.db, 'castme_test', 'Zabranjena baza!');
  assert.ok(['127.0.0.1', '::1'].includes(server.server), 'Zabranjen udaljeni PostgreSQL!');

  const model = createEmployerCastingModel(database);

  async function employer() {
    const uuid = randomUUID();
    const { rows: [user] } = await database.query(`
      INSERT INTO users (auth_id, email, first_name, last_name, birth_date, role)
      VALUES ($1, $2, 'Test', 'Employer', '1990-01-01', 'employer')
      RETURNING id`, [`local-test-${uuid}`, `test-${uuid}@example.invalid`]);
    userIds.push(user.id);
    const { rows: [organisation] } = await database.query(`
      INSERT INTO organisations (owner_id, company_name, reg_num, contact_email)
      VALUES ($1, 'Testna organizacija', $2, $3) RETURNING id`,
      [user.id, `T-${uuid}`, `test-${uuid}@example.invalid`]);
    orgIds.push(organisation.id);
    return user.id;
  }

  const employer1 = await employer();
  const employer2 = await employer();

  await t.test('nacrt se stvarno sprema u obje tablice i može biti nepotpun', async () => {
    const result = await model.createDraft(employer1, {
      projectTitle: 'Testni film', projectType: 'film', roleTitle: null,
    });
    assert.equal(result.outcome, 'created');
    const { rows: [saved] } = await database.query(`
      SELECT c.id, c.status, c.max_applications, c.description, c.location,
             c.application_deadline, c.project_id, p.title, p.project_type,
             o.owner_id
      FROM casting_calls c
      JOIN projects p ON p.id = c.project_id
      JOIN organisations o ON o.id = p.org_id
      WHERE c.id = $1`, [result.id]);
    assert.ok(saved);
    projectIds.push(saved.project_id);
    assert.equal(saved.status, 'draft');
    assert.equal(saved.max_applications, 1000);
    assert.equal(saved.description, null);
    assert.equal(saved.location, null);
    assert.equal(saved.application_deadline, null);
    assert.equal(saved.title, 'Testni film');
    assert.equal(saved.project_type, 'film');
    assert.equal(saved.owner_id, employer1);
  });

  await t.test('popis vraća samo oglase pripadajućeg poslodavca', async () => {
    const mine = await model.listMine(employer1);
    const theirs = await model.listMine(employer2);
    assert.ok(mine.some(x => x.projectTitle === 'Testni film'));
    assert.ok(!theirs.some(x => x.projectTitle === 'Testni film'));
  });

  const getTestCastingId = async () => {
    const { rows: [record] } = await database.query(
      'SELECT id FROM casting_calls WHERE project_id = $1', [projectIds[0]]);
    return record.id;
  };

  await t.test('vlasnik može urediti nacrt i podatke projekta u jednoj transakciji', async () => {
    const id = await getTestCastingId();
    const result = await model.updateDraft(employer1, id, {
      projectTitle: 'Ažurirani film', roleTitle: 'Glavna uloga',
      roleDescription: 'Opis uloge', positionsCount: 2, minAge: 18, maxAge: 40,
      location: 'Zagreb', applicationDeadline: '2030-12-01T23:59:59.999Z',
    });
    assert.equal(result.outcome, 'updated');
    const { rows: [saved] } = await database.query(`
      SELECT c.title AS role_title, c.description AS role_description,
             c.positions_count, c.min_age, c.max_age, c.location, p.title AS project_title
      FROM casting_calls c JOIN projects p ON p.id=c.project_id WHERE c.id=$1`, [id]);
    assert.equal(saved.project_title, 'Ažurirani film');
    assert.equal(saved.role_title, 'Glavna uloga');
    assert.equal(saved.role_description, 'Opis uloge');
    assert.equal(saved.positions_count, 2);
    assert.equal(saved.min_age, 18);
    assert.equal(saved.max_age, 40);
    assert.equal(saved.location, 'Zagreb');
  });

  await t.test('drugi poslodavac ne može uređivati tuđi nacrt', async () => {
    const id = await getTestCastingId();
    const result = await model.updateDraft(employer2, id, { projectTitle: 'UKRADENO' });
    assert.equal(result.outcome, 'not_found');
    const { rows: [saved] } = await database.query(`
      SELECT p.title FROM casting_calls c JOIN projects p ON p.id=c.project_id WHERE c.id=$1`, [id]);
    assert.equal(saved.title, 'Ažurirani film');
  });

  await t.test('neispravan raspon godina odbija se bez promjene podataka', async () => {
    const id = await getTestCastingId();
    const result = await model.updateDraft(employer1, id, { minAge: 50 });
    assert.equal(result.outcome, 'invalid_ages');
    const { rows: [saved] } = await database.query('SELECT min_age, max_age FROM casting_calls WHERE id=$1', [id]);
    assert.equal(saved.min_age, 18);
    assert.equal(saved.max_age, 40);
  });

  await t.test('pogrešan SQL podatak vraća cijelu transakciju stvaranja', async () => {
    const { rows: [before] } = await database.query(`
      SELECT count(*)::int AS count FROM projects WHERE org_id=$1`, [orgIds[0]]);
    await assert.rejects(model.createDraft(employer1, {
      projectTitle: 'Ovaj projekt se ne smije spremiti',
      projectType: 'film', positionsCount: 0,
    }), (err) => err.code === '23514');
    const { rows: [after] } = await database.query(`
      SELECT count(*)::int AS count FROM projects WHERE org_id=$1`, [orgIds[0]]);
    assert.equal(after.count, before.count);
  });

  await t.test('objavljeni oglas nije moguće uređivati kao nacrt', async () => {
    const id = await getTestCastingId();
    await database.query(`UPDATE casting_calls SET status='published' WHERE id=$1`, [id]);
    const result = await model.updateDraft(employer1, id, { roleTitle: 'Nedopušteno' });
    assert.equal(result.outcome, 'not_draft');
    const { rows: [saved] } = await database.query('SELECT title FROM casting_calls WHERE id=$1', [id]);
    assert.equal(saved.title, 'Glavna uloga');
  });
});
