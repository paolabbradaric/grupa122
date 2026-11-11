'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Pool } = require('pg');
const { createEmployerCastingModel } = require('../src/models/employerCastingModel');

const enabled = process.env.EMPLOYER_CASTING_PUBLISH_DB_TESTS === '1';

test('Objavljivanje oglasa: ISKLJUČIVO lokalni castme_test', {
  skip: !enabled ? 'Pokreni s EMPLOYER_CASTING_PUBLISH_DB_TESTS=1.' : false
}, async t => {
  assert.equal(process.env.PGHOST, '127.0.0.1');
  assert.equal(process.env.PGPORT, '5432');
  assert.equal(process.env.PGDATABASE, 'castme_test');
  assert.equal(process.env.PGSSL, 'false');

  const database = new Pool({
    host: '127.0.0.1', port: 5432, database: 'castme_test',
    user: process.env.PGUSER, password: process.env.PGPASSWORD || undefined,
    ssl: false, connectionTimeoutMillis: 3000,
  });
  const users = [], organisations = [], projects = [];
  t.after(async () => {
    try {
      if (organisations.length) {
        await database.query('DELETE FROM verification WHERE org_id = ANY($1::int[])', [organisations]);
      }
      if (projects.length) {
        await database.query('DELETE FROM casting_calls WHERE project_id = ANY($1::int[])', [projects]);
        await database.query('DELETE FROM projects WHERE id = ANY($1::int[])', [projects]);
      }
      if (organisations.length) await database.query('DELETE FROM organisations WHERE id = ANY($1::int[])', [organisations]);
      if (users.length) await database.query('DELETE FROM users WHERE id = ANY($1::int[])', [users]);
    } finally {
      await database.end();
    }
  });

  const { rows: [server] } = await database.query(
    'SELECT current_database() AS db, host(inet_server_addr()) AS server');
  assert.equal(server.db, 'castme_test');
  assert.ok(['127.0.0.1', '::1'].includes(server.server));
  const model = createEmployerCastingModel(database);

  async function employer() {
    const uuid = randomUUID();
    const { rows: [user] } = await database.query(`
      INSERT INTO users (auth_id, email, first_name, last_name, birth_date, role)
      VALUES ($1, $2, 'Test', 'Employer', '1990-01-01', 'employer') RETURNING id`,
      [`publish-test-${uuid}`, `publish-${uuid}@example.invalid`]);
    users.push(user.id);
    const { rows: [org] } = await database.query(`
      INSERT INTO organisations (owner_id, company_name, reg_num, contact_email)
      VALUES ($1, 'Publish test', $2, $3) RETURNING id`,
      [user.id, `P-${uuid}`, `publish-${uuid}@example.invalid`]);
    organisations.push(org.id);
    return { userId: user.id, orgId: org.id };
  }
  const first = await employer();
  const other = await employer();
  const draft = await model.createDraft(first.userId, {
    projectTitle: 'Test projekt objave', projectType: 'film'
  });
  assert.equal(draft.outcome, 'created');
  const { rows: [record] } = await database.query(
    'SELECT project_id FROM casting_calls WHERE id=$1', [draft.id]);
  projects.push(record.project_id);

  await t.test('bez verifikacije nema objave', async () => {
    assert.equal((await model.publishDraft(first.userId, draft.id)).outcome, 'not_verified');
  });

  await database.query(`INSERT INTO verification (status, org_id) VALUES ('approved', $1)`, [first.orgId]);

  await t.test('verificiran poslodavac ne može objaviti nepotpun nacrt', async () => {
    assert.equal((await model.publishDraft(first.userId, draft.id)).outcome, 'incomplete');
    const { rows: [r] } = await database.query('SELECT status FROM casting_calls WHERE id=$1', [draft.id]);
    assert.equal(r.status, 'draft');
  });

  await model.updateDraft(first.userId, draft.id, {
    projectDescription: 'Opis projekta', roleTitle: 'Glavna uloga',
    roleDescription: 'Opis uloge', positionsCount: 2, minAge: 18, maxAge: 45,
    location: 'Zagreb', applicationDeadline: '2035-12-01T12:00:00.000Z'
  });

  await t.test('drugi poslodavac ne može objaviti tuđi oglas', async () => {
    assert.equal((await model.publishDraft(other.userId, draft.id)).outcome, 'not_found');
  });

  await t.test('odobrena verifikacija omogućuje objavu', async () => {
    assert.equal((await model.publishDraft(first.userId, draft.id)).outcome, 'published');
    const { rows: [r] } = await database.query(
      'SELECT status, published_at FROM casting_calls WHERE id=$1', [draft.id]);
    assert.equal(r.status, 'published');
    assert.ok(r.published_at);
  });

  await t.test('već objavljeni oglas ne može ponovno biti objavljen', async () => {
    assert.equal((await model.publishDraft(first.userId, draft.id)).outcome, 'not_draft');
  });
});
