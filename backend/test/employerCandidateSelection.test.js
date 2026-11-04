'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createEmployerCandidateSelectionModel } = require('../src/models/employerCandidateSelectionModel');
const { createEmployerCandidateSelectionController } = require('../src/controllers/employerCandidateSelectionController');

function mock({ casting = { id: 1, status: 'published', positions_count: 2 },
                application = { id: 3, status: 'SUBMITTED' }, count = 0, failAt = '' } = {}) {
  const calls = [];
  let released = false;
  const client = {
    async query(sql, values) {
      calls.push({ sql, values });
      if (failAt && sql.includes(failAt)) throw new Error('DB failure');
      if (sql.includes('JOIN organisations')) return { rows: casting ? [casting] : [] };
      if (sql.includes('FROM applications') && sql.includes('FOR UPDATE')) return { rows: application ? [application] : [] };
      if (sql.includes('COUNT(*)::int')) return { rows: [{ total: count }] };
      return { rows: [] };
    },
    release() { released = true; }
  };
  return { database: { connect: async () => client }, calls, released: () => released };
}
const exec = (m) => createEmployerCandidateSelectionModel(m.database).select(7, 1, 3);
const has = (m, s) => m.calls.some(c => c.sql.includes(s));
function response() {
  return { statusCode: 200, status(n) { this.statusCode = n; return this; }, json(x) { this.body = x; return this; } };
}

test('odabir prvog kandidata ne popunjava oglas', async () => {
  const m = mock();
  assert.deepEqual(await exec(m), { outcome: 'selected', id: 3, status: 'SELECTED',
    castingStatus: 'published', selectedCount: 1, positionsCount: 2 });
  assert.ok(has(m, 'FOR UPDATE OF c'));
  assert.ok(has(m, 'UPDATE applications'));
  assert.ok(has(m, 'INSERT INTO application_status_history'));
  assert.equal(has(m, 'UPDATE casting_calls'), false);
  assert.ok(has(m, 'COMMIT'));
  assert.equal(m.released(), true);
});

test('zadnji odabrani kandidat automatski postavlja filled i zapisuje povijest', async () => {
  const m = mock({ count: 1 });
  assert.equal((await exec(m)).castingStatus, 'filled');
  assert.ok(has(m, "status = 'filled'"));
  assert.ok(has(m, 'INSERT INTO casting_call_status_history'));
  assert.ok(has(m, 'COMMIT'));
});

test('odabir na closed oglasu radi i posljednji odabir ga popunjava', async () => {
  const m = mock({ casting: { id: 1, status: 'closed', positions_count: 1 } });
  assert.equal((await exec(m)).castingStatus, 'filled');
});

test('tudi ili nepostojeci oglas ne moze se mijenjati', async () => {
  const m = mock({ casting: null });
  assert.equal((await exec(m)).outcome, 'not_found');
  assert.equal(has(m, 'UPDATE applications'), false);
  assert.ok(has(m, 'ROLLBACK'));
});

test('zabranjen odabir na draft, filled i cancelled oglase', async () => {
  for (const status of ['draft', 'filled', 'cancelled']) {
    const m = mock({ casting: { id: 1, status, positions_count: 2 } });
    assert.equal((await exec(m)).outcome, 'invalid_status');
    assert.equal(has(m, 'UPDATE applications'), false);
  }
});

test('prijava iz drugog oglasa nije dostupna', async () => {
  const m = mock({ application: null });
  assert.equal((await exec(m)).outcome, 'application_not_found');
  assert.equal(has(m, 'UPDATE applications'), false);
});

test('isti kandidat ne moze biti ponovno odabran', async () => {
  const m = mock({ application: { id: 3, status: 'SELECTED' } });
  assert.equal((await exec(m)).outcome, 'already_selected');
  assert.equal(has(m, 'UPDATE applications'), false);
});

test('odbijene ili druge prijave nisu dostupne za odabir', async () => {
  const m = mock({ application: { id: 3, status: 'REJECTED' } });
  assert.equal((await exec(m)).outcome, 'invalid_application_status');
});

test('ne moze se odabrati vise kandidata od positions_count', async () => {
  const m = mock({ count: 2 });
  assert.equal((await exec(m)).outcome, 'positions_filled');
  assert.equal(has(m, 'UPDATE applications'), false);
});

test('greska pri upisu povijesti radi rollback i release', async () => {
  const m = mock({ failAt: 'INSERT INTO application_status_history' });
  await assert.rejects(exec(m), /DB failure/);
  assert.ok(has(m, 'ROLLBACK'));
  assert.equal(has(m, 'COMMIT'), false);
  assert.equal(m.released(), true);
});

test('neispravni ID-jevi i iskljuceni upisi su odbijeni', async () => {
  const c = createEmployerCandidateSelectionController({ model: {}, writesEnabled: true });
  const r = response();
  await c.select({ params: { id: 'abc', applicationId: '3' } }, r, assert.fail);
  assert.equal(r.statusCode, 400);
  const disabled = createEmployerCandidateSelectionController({ model: {}, writesEnabled: false });
  const d = response();
  await disabled.select({ params: { id: '1', applicationId: '3' } }, d, assert.fail);
  assert.equal(d.statusCode, 503);
});

test('controller ispravno mapira poslovne ishode', async () => {
  for (const outcome of ['not_found', 'application_not_found', 'invalid_status', 'already_selected',
    'invalid_application_status', 'positions_filled']) {
    const c = createEmployerCandidateSelectionController({ writesEnabled: true, model: {
      select: async () => ({ outcome })
    } });
    const r = response();
    await c.select({ user: { id: 7 }, params: { id: '1', applicationId: '3' } }, r, assert.fail);
    assert.equal(r.statusCode, outcome.includes('not_found') ? 404 : 409);
  }
});

test('controller vraca rezultat i prosljeduje korisnika', async () => {
  const c = createEmployerCandidateSelectionController({ writesEnabled: true, model: {
    select: async (u, casting, application) => {
      assert.deepEqual([u, casting, application], [7, 1, 3]);
      return { outcome: 'selected', status: 'SELECTED', castingStatus: 'filled', selectedCount: 2, positionsCount: 2 };
    }
  } });
  const r = response();
  await c.select({ user: { id: 7 }, params: { id: '1', applicationId: '3' } }, r, assert.fail);
  assert.deepEqual(r.body, { castingId: 1, applicationId: 3, applicationStatus: 'SELECTED',
    castingStatus: 'filled', selectedCount: 2, positionsCount: 2 });
});

test('greske idu u Express error middleware', async () => {
  const c = createEmployerCandidateSelectionController({ writesEnabled: true, model: {
    select: async () => { throw new Error('fail'); }
  } });
  let passed;
  await c.select({ user: { id: 7 }, params: { id: '1', applicationId: '3' } }, response(), e => { passed = e; });
  assert.match(passed.message, /fail/);
});
