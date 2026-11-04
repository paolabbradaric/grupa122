'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createEmployerCastingController } = require('../src/controllers/employerCastingController');
const { createEmployerCastingModel } = require('../src/models/employerCastingModel');

function response() {
  return { statusCode: 200, status(n) { this.statusCode = n; return this; },
    json(data) { this.body = data; return this; } };
}
function mockDatabase(casting, verification) {
  const queries = [];
  const client = {
    async query(sql, params) {
      queries.push({ sql, params });
      if (sql.includes('JOIN organisations')) return { rows: casting ? [casting] : [] };
      if (sql.includes('FROM verification')) return { rows: verification ? [verification] : [] };
      return { rows: [] };
    },
    release() { queries.push({ sql: 'RELEASE' }); }
  };
  return { queries, database: { connect: async () => client } };
}
const valid = {
  id: 10, status: 'draft', org_id: 2, project_title: 'Film', project_type: 'film',
  project_description: 'Opis projekta', title: 'Glavna uloga', description: 'Opis uloge',
  positions_count: 2, max_applications: 1000, min_age: 18, max_age: 50,
  location: 'Zagreb', application_deadline: '2035-01-01T12:00:00Z'
};

test('controller: odbija neispravan ID i isključeno objavljivanje', async () => {
  const controller = createEmployerCastingController({ writesEnabled: true, model: {} });
  const res = response();
  await controller.publish({ user: { id: 1 }, params: { id: 'abc' } }, res, assert.fail);
  assert.equal(res.statusCode, 400);
  const blocked = createEmployerCastingController({ writesEnabled: false, model: {} });
  const res2 = response();
  await blocked.publish({ user: { id: 1 }, params: { id: '10' } }, res2, assert.fail);
  assert.equal(res2.statusCode, 503);
});

test('controller: mapira sve poslovne ishode u HTTP statuse', async () => {
  for (const [outcome, statusCode] of [
    ['not_found', 404], ['not_draft', 409], ['not_verified', 403], ['incomplete', 400]
  ]) {
    const model = { publishDraft: async () => ({ outcome }) };
    const controller = createEmployerCastingController({ model, writesEnabled: true });
    const res = response();
    await controller.publish({ user: { id: 1 }, params: { id: '10' } }, res, assert.fail);
    assert.equal(res.statusCode, statusCode, outcome);
  }
});

test('controller: uspješna objava vraća published', async () => {
  const model = { publishDraft: async (userId, id) => {
    assert.equal(userId, 9); assert.equal(id, 10); return { outcome: 'published', id };
  } };
  const res = response();
  await createEmployerCastingController({ model, writesEnabled: true }).publish(
    { user: { id: 9 }, params: { id: '10' } }, res, assert.fail
  );
  assert.deepEqual(res.body, { id: 10, status: 'published', published: true });
});

test('model: nema pristupa tuđem oglasu i ne objavljuje dvaput', async () => {
  for (const [casting, outcome] of [[null, 'not_found'], [{ ...valid, status: 'published' }, 'not_draft']]) {
    const { database, queries } = mockDatabase(casting, { status: 'approved' });
    assert.equal((await createEmployerCastingModel(database).publishDraft(1, 10)).outcome, outcome);
    assert.ok(!queries.some(q => q.sql.includes('UPDATE casting_calls')));
    assert.ok(queries.some(q => q.sql === 'ROLLBACK'));
    assert.ok(queries.some(q => q.sql === 'RELEASE'));
  }
});

test('model: nema objave bez posljednje odobrene verifikacije', async () => {
  for (const verification of [null, { status: 'pending' }, { status: 'rejected' }]) {
    const { database, queries } = mockDatabase(valid, verification);
    assert.equal((await createEmployerCastingModel(database).publishDraft(1, 10)).outcome, 'not_verified');
    assert.ok(!queries.some(q => q.sql.includes('UPDATE casting_calls')));
  }
});

test('model: nepotpun oglas, istekao rok i neispravna dob odbijaju se', async () => {
  for (const patch of [
    { description: null }, { project_description: '   ' }, { location: '' },
    { application_deadline: '2020-01-01T00:00:00Z' }, { positions_count: null },
    { min_age: 17 }, { max_age: 16 }, { max_applications: 1001 }
  ]) {
    const { database, queries } = mockDatabase({ ...valid, ...patch }, { status: 'approved' });
    assert.equal((await createEmployerCastingModel(database).publishDraft(1, 10)).outcome, 'incomplete');
    assert.ok(!queries.some(q => q.sql.includes('UPDATE casting_calls')));
  }
});

test('model: objava je transakcijska i upisuje published', async () => {
  const { database, queries } = mockDatabase(valid, { status: 'approved' });
  assert.deepEqual(await createEmployerCastingModel(database).publishDraft(1, 10),
    { outcome: 'published', id: 10 });
  assert.equal(queries[0].sql, 'BEGIN');
  assert.ok(queries.some(q => q.sql.includes('FOR UPDATE OF c, p')));
  assert.ok(queries.some(q => q.sql.includes("status = 'published'")));
  assert.ok(queries.some(q => q.sql === 'COMMIT'));
  assert.ok(queries.some(q => q.sql === 'RELEASE'));
});

test('model: SQL greška rollback i release', async () => {
  const queries = [];
  const database = { connect: async () => ({
    async query(sql) { queries.push(sql); if (sql.includes('JOIN organisations')) throw new Error('DB error'); return { rows: [] }; },
    release() { queries.push('RELEASE'); }
  }) };
  await assert.rejects(createEmployerCastingModel(database).publishDraft(1, 10), /DB error/);
  assert.ok(queries.includes('ROLLBACK'));
  assert.ok(queries.includes('RELEASE'));
});
