const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateDraft, createEmployerCastingController } = require('../src/controllers/employerCastingController');
const { createEmployerCastingModel } = require('../src/models/employerCastingModel');

function response() {
  return {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; }
  };
}

function mockDb(handler) {
  const queries = [];
  const client = {
    async query(sql, params) { queries.push({ sql, params }); return handler(sql, params); },
    release() { queries.push({ sql: 'RELEASE' }); }
  };
  return { queries, client, db: { connect: async () => client, query: client.query } };
}

test('nacrt zahtijeva naziv i vrstu projekta', () => {
  assert.match(validateDraft({}, true).error, /Naziv/);
  assert.deepEqual(validateDraft({ projectTitle: 'Film', projectType: 'film' }, true).data,
    { projectTitle: 'Film', projectType: 'film' });
});

test('sprječava nedopuštena polja i neispravne vrijednosti', () => {
  for (const body of [
    { status: 'published' }, { orgId: 3 }, { maxApplications: 0 },
    { maxApplications: 1001 }, { positionsCount: -2 }, { minAge: 17 },
    { maxAge: 20, minAge: 30 }, { roleTitle: 12 }, { projectType: 'x'.repeat(21) },
    { applicationDeadline: '2026-02-30' }, { applicationDeadline: 'tomorrow' }
  ]) assert.ok(validateDraft(body).error, JSON.stringify(body));
  assert.match(validateDraft({}).error, /Nema promjena/);
});

test('prihvaća nepotpun nacrt i normalizira datum', () => {
  const result = validateDraft({ roleTitle: '', applicationDeadline: '2030-12-01', maxApplications: 1000 });
  assert.equal(result.error, undefined);
  assert.equal(result.data.roleTitle, null);
  assert.equal(result.data.applicationDeadline, '2030-12-01T23:59:59.999Z');
});

test('isključeni upisi vraćaju 503', async () => {
  const controller = createEmployerCastingController({ writesEnabled: false, model: {} });
  const req = { user: { id: 7 }, body: { projectTitle: 'Film', projectType: 'film' }, params: { id: '1' } };
  const created = response();
  await controller.create(req, created, assert.fail);
  assert.equal(created.statusCode, 503);
  const updated = response();
  await controller.update({ ...req, body: { roleTitle: 'Uloga' } }, updated, assert.fail);
  assert.equal(updated.statusCode, 503);
});

test('controller stvara nacrt i vraća 201', async () => {
  const controller = createEmployerCastingController({ writesEnabled: true,
    model: { createDraft: async (id, data) => { assert.equal(id, 7); assert.equal(data.projectTitle, 'Film'); return { outcome: 'created', id: 22 }; } }
  });
  const res = response();
  await controller.create({ user: { id: 7 }, body: { projectTitle: 'Film', projectType: 'film' } }, res, assert.fail);
  assert.equal(res.statusCode, 201);
  assert.deepEqual(res.body, { id: 22, status: 'draft' });
});

test('controller skriva tuđi oglas i ne uređuje objavljeni', async () => {
  for (const [outcome, code] of [['not_found', 404], ['not_draft', 409], ['invalid_ages', 400]]) {
    const controller = createEmployerCastingController({ writesEnabled: true,
      model: { updateDraft: async () => ({ outcome }) } });
    const res = response();
    await controller.update({ user: { id: 7 }, params: { id: '15' }, body: { roleTitle: 'A' } }, res, assert.fail);
    assert.equal(res.statusCode, code);
  }
});

test('dohvat ograničen na korisnika', async () => {
  const { db, queries } = mockDb(async () => ({ rows: [{ id: 1 }] }));
  assert.deepEqual(await createEmployerCastingModel(db).listMine(7), [{ id: 1 }]);
  assert.deepEqual(queries[0].params, [7]);
  assert.match(queries[0].sql, /o\.owner_id = \$1/);
});

test('stvaranje sprema projekt i oglas u transakciji', async () => {
  const { db, queries } = mockDb(async (sql) => {
    if (sql.includes('FROM organisations')) return { rows: [{ id: 8 }] };
    if (sql.includes('INSERT INTO projects')) return { rows: [{ id: 9 }] };
    if (sql.includes('INSERT INTO casting_calls')) return { rows: [{ id: 10 }] };
    return { rows: [] };
  });
  const result = await createEmployerCastingModel(db).createDraft(7, { projectTitle: 'Film', projectType: 'film' });
  assert.deepEqual(result, { outcome: 'created', id: 10 });
  assert.equal(queries[0].sql, 'BEGIN');
  assert.ok(queries.some(q => q.sql === 'COMMIT'));
  assert.ok(queries.some(q => q.sql === 'RELEASE'));
  assert.equal(queries.find(q => q.sql.includes('INSERT INTO casting_calls')).params[4], 1000);
});

test('ako organizacija nedostaje, nema unosa', async () => {
  const { db, queries } = mockDb(async () => ({ rows: [] }));
  assert.deepEqual(await createEmployerCastingModel(db).createDraft(7, { projectTitle: 'A', projectType: 'film' }),
    { outcome: 'no_organisation' });
  assert.ok(queries.some(q => q.sql === 'ROLLBACK'));
  assert.ok(!queries.some(q => q.sql.includes('INSERT INTO')));
});

test('SQL greška vraća rollback i oslobađa klijenta', async () => {
  const { db, queries } = mockDb(async sql => {
    if (sql.includes('FROM organisations')) return { rows: [{ id: 8 }] };
    if (sql.includes('INSERT INTO projects')) throw new Error('database error');
    return { rows: [] };
  });
  await assert.rejects(createEmployerCastingModel(db).createDraft(7, { projectTitle: 'A', projectType: 'film' }), /database error/);
  assert.ok(queries.some(q => q.sql === 'ROLLBACK'));
  assert.ok(queries.some(q => q.sql === 'RELEASE'));
});

test('uređivanje postojećeg nacrta zadržava ostale podatke', async () => {
  const original = { id: 4, project_id: 6, status: 'draft', projectTitle: 'Stari', projectType: 'film',
    projectDescription: null, roleTitle: null, roleDescription: null, positionsCount: null,
    maxApplications: 1000, minAge: 18, maxAge: 70, location: null,
    applicationDeadline: null, auditionText: null, appearanceReq: null, experienceReq: null };
  const { db, queries } = mockDb(async sql => {
    if (sql.includes('FOR UPDATE')) return { rows: [original] };
    return { rows: [] };
  });
  assert.deepEqual(await createEmployerCastingModel(db).updateDraft(7, 4, { roleTitle: 'Nova uloga' }),
    { outcome: 'updated', id: 4 });
  assert.deepEqual(queries.find(q => q.sql.includes('UPDATE projects')).params,
    ['Stari', 'film', null, 6]);
  assert.equal(queries.find(q => q.sql.includes('UPDATE casting_calls')).params[0], 'Nova uloga');
  assert.ok(queries.some(q => q.sql === 'COMMIT'));
});

test('ne dopušta uređivanje tuđeg ni objavljenog oglasa', async () => {
  for (const [rows, expected] of [[[], 'not_found'], [[{ status: 'published' }], 'not_draft']]) {
    const { db, queries } = mockDb(async sql => sql.includes('FOR UPDATE') ? { rows } : { rows: [] });
    assert.equal((await createEmployerCastingModel(db).updateDraft(7, 4, { roleTitle: 'A' })).outcome, expected);
    assert.ok(!queries.some(q => q.sql.includes('UPDATE projects')));
    assert.ok(queries.some(q => q.sql === 'ROLLBACK'));
  }
});
