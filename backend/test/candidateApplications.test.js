'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createCandidateApplicationsModel } = require('../src/models/candidateApplicationsModel');
const { createCandidateApplicationsController } = require('../src/controllers/candidateApplicationsController');

function mock({ casting = { id: 1 }, application = { id: 3, status: 'SUBMITTED' },
  activeBookings = false, guardsReady = true, rows = [], failAt, rollbackFails = false } = {}) {
  const calls = [];
  let released = false;
  const client = {
    async query(sql, params) {
      calls.push({ sql, params });
      if (failAt && (failAt === 'COMMIT' ? sql === 'COMMIT' : sql.includes(failAt))) throw new Error('DB failure');
      if (rollbackFails && sql === 'ROLLBACK') throw new Error('Rollback failure');
      if (sql.includes('FOR UPDATE OF c')) return { rows: casting ? [casting] : [] };
      if (sql.includes('FOR UPDATE OF a')) return { rows: application ? [application] : [] };
      if (sql.includes('withdrawal_guards_ready')) return { rows: [{ withdrawal_guards_ready: guardsReady }] };
      if (sql.includes('has_active_bookings')) return { rows: [{ has_active_bookings: activeBookings }] };
      return { rows: [] };
    },
    release() { released = true; }
  };
  const database = {
    connect: async () => client,
    async query(sql, params) { calls.push({ sql, params }); return { rows }; }
  };
  return { calls, database, released: () => released, model: createCandidateApplicationsModel(database) };
}

function assertNoWrites(m) {
  assert.equal(m.calls.some(q => /^\s*(UPDATE|INSERT|DELETE)\b/.test(q.sql)), false);
  assert.equal(m.calls.at(-1).sql, 'ROLLBACK');
  assert.equal(m.calls.some(q => q.sql === 'COMMIT'), false);
  assert.equal(m.released(), true);
}

test('Moje prijave: upit filtrira po korisniku i vraca podatke oglasa bez filtriranja statusa', async () => {
  const rows = [{ id: 3, status: 'WITHDRAWN', castingId: 1, castingStatus: 'cancelled', projectTitle: 'Film' }];
  const m = mock({ rows });
  assert.deepEqual(await m.model.listMine(7), rows);
  assert.deepEqual(m.calls[0].params, [7]);
  assert.match(m.calls[0].sql, /WHERE cp\.user_id = \$1/);
  assert.match(m.calls[0].sql, /JOIN casting_calls/);
  assert.match(m.calls[0].sql, /JOIN projects/);
  assert.match(m.calls[0].sql, /ORDER BY a\.submitted_at DESC, a\.id DESC/);
  assert.doesNotMatch(m.calls[0].sql, /status\s*=/);
});

test('Moje prijave: prazan popis', async () => {
  assert.deepEqual(await mock().model.listMine(7), []);
});

for (const status of ['SUBMITTED', 'UNDER_REVIEW', 'SHORTLISTED', 'INVITED']) {
  test(`povlacenje iz ${status} atomicki sprema WITHDRAWN i povijest kandidata`, async () => {
    const m = mock({ application: { id: 3, status } });
    assert.deepEqual(await m.model.withdraw(7, 3), {
      outcome: 'withdrawn', applicationId: 3, oldStatus: status, status: 'WITHDRAWN'
    });
    const locks = m.calls.filter(q => q.sql.includes('FOR UPDATE'));
    assert.match(locks[0].sql, /FOR UPDATE OF c/);
    assert.match(locks[0].sql, /cp\.user_id = \$2/);
    assert.deepEqual(locks[0].params, [3, 7]);
    assert.match(locks[1].sql, /FOR UPDATE OF a/);
    assert.match(locks[1].sql, /cp\.user_id = \$3/);
    assert.deepEqual(locks[1].params, [3, 1, 7]);
    const update = m.calls.find(q => q.sql.includes('UPDATE applications'));
    assert.match(update.sql, /status = 'WITHDRAWN'/);
    assert.deepEqual(update.params, [3]);
    const history = m.calls.find(q => q.sql.includes('INSERT INTO application_status_history'));
    assert.deepEqual(history.params, [status, 'Prijavu povukao kandidat.', 3, 7]);
    assert.match(history.sql, /'WITHDRAWN'/);
    assert.equal(m.calls[0].sql, 'BEGIN ISOLATION LEVEL READ COMMITTED');
    assert.equal(m.calls.at(-1).sql, 'COMMIT');
    assert.equal(m.released(), true);
    assert.equal(m.calls.some(q => /^\s*(UPDATE|DELETE)\s+(audition_|casting_calls)/.test(q.sql)), false);
  });
}

for (const status of ['AUDITIONED', 'ACCEPTED', 'SELECTED', 'REJECTED', 'WITHDRAWN', 'CANCELLED', 'UNKNOWN']) {
  test(`povlacenje odbija ${status} bez upisa`, async () => {
    const m = mock({ application: { id: 3, status } });
    assert.deepEqual(await m.model.withdraw(7, 3), { outcome: 'invalid_status' });
    assertNoWrites(m);
  });
}

test('povlacenje tuđe ili nepostojece prijave vraca isti ishod', async () => {
  const m = mock({ casting: null });
  assert.deepEqual(await m.model.withdraw(7, 3), { outcome: 'not_found' });
  assertNoWrites(m);
  assert.equal(m.calls.some(q => q.sql.includes('FOR UPDATE OF a')), false);
});

test('povlacenje ponovno provjerava prijavu nakon zakljucavanja oglasa', async () => {
  const m = mock({ application: null });
  assert.deepEqual(await m.model.withdraw(7, 3), { outcome: 'not_found' });
  assertNoWrites(m);
});

test('nedostupna ili iskljucena DB zastita blokira povlacenje bez upisa', async () => {
  const m = mock({ guardsReady: false });
  assert.deepEqual(await m.model.withdraw(7, 3), { outcome: 'integration_unavailable' });
  assertNoWrites(m);
  assert.equal(m.calls.some(q => q.sql.includes('AS has_active_bookings')), false);
});

test('aktivna rezervacija blokira povlacenje bez promjene Lucijinih tablica', async () => {
  const m = mock({ application: { id: 3, status: 'INVITED' }, activeBookings: true });
  assert.deepEqual(await m.model.withdraw(7, 3), { outcome: 'active_bookings' });
  const query = m.calls.find(q => q.sql.includes('has_active_bookings'));
  assert.deepEqual(query.params, [3]);
  assert.match(query.sql, /status NOT IN \('cancelled', 'canceled'\)/);
  assertNoWrites(m);
});

for (const failAt of ['FOR UPDATE OF c', 'FOR UPDATE OF a', 'has_active_bookings',
  'withdrawal_guards_ready', 'UPDATE applications', 'INSERT INTO application_status_history', 'COMMIT']) {
  test(`greska u ${failAt} pokrece rollback i release`, async () => {
    const m = mock({ failAt });
    await assert.rejects(m.model.withdraw(7, 3), /DB failure/);
    assert.equal(m.calls.at(-1).sql, 'ROLLBACK');
    assert.equal(m.released(), true);
  });
}

test('rollback greska ne skriva izvornu gresku', async () => {
  const m = mock({ failAt: 'INSERT INTO application_status_history', rollbackFails: true });
  await assert.rejects(m.model.withdraw(7, 3), /^Error: DB failure$/);
  assert.equal(m.released(), true);
});

test('neuspjeli BEGIN oslobada vezu bez rollbacka neotvorene transakcije', async () => {
  const m = mock({ failAt: 'BEGIN' });
  await assert.rejects(m.model.withdraw(7, 3), /DB failure/);
  assert.equal(m.calls.length, 1);
  assert.equal(m.released(), true);
});

test('nedostupna veza prosljeduje izvornu gresku', async () => {
  const error = new Error('Connection failure');
  const model = createCandidateApplicationsModel({ connect: async () => { throw error; } });
  await assert.rejects(model.withdraw(7, 3), e => e === error);
});

function response() {
  return { statusCode: 200, status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; } };
}

test('controller popisa koristi samo ID iz autentificiranog korisnika', async () => {
  const controller = createCandidateApplicationsController({ model: {
    async listMine(id) { assert.equal(id, 7); return [{ id: 3, status: 'SUBMITTED' }]; }
  } });
  const res = response();
  await controller.list({ user: { id: 7 }, query: { userId: 99 } }, res, assert.fail);
  assert.deepEqual(res.body, { applications: [{ id: 3, status: 'SUBMITTED' }] });
});

test('controller odbija neispravan ID i blokirane upise bez poziva modela', async () => {
  const controller = createCandidateApplicationsController({ model: {} });
  for (const id of ['abc', '0', '-1', '1.5', '2147483648', '9007199254740992']) {
    const res = response();
    await controller.withdraw({ params: { applicationId: id } }, res, assert.fail);
    assert.equal(res.statusCode, 400);
  }
  const res = response();
  await controller.withdraw({ params: { applicationId: '3' } }, res, assert.fail);
  assert.equal(res.statusCode, 503);
});

test('controller povlacenja koristi sesiju, mapira ishode i vraca novi status', async () => {
  for (const [outcome, code] of [['not_found', 404], ['invalid_status', 409],
    ['active_bookings', 409], ['integration_unavailable', 503], ['unknown', 500], ['withdrawn', 200]]) {
    const controller = createCandidateApplicationsController({ writesEnabled: true, model: {
      async withdraw(userId, id) {
        assert.deepEqual([userId, id], [7, 3]);
        return { outcome, applicationId: id, oldStatus: 'SUBMITTED', status: 'WITHDRAWN' };
      }
    } });
    const res = response();
    await controller.withdraw({ user: { id: 7 }, params: { applicationId: '3' }, body: { userId: 99 } }, res, assert.fail);
    assert.equal(res.statusCode, code);
    if (code === 200) assert.deepEqual(res.body, { applicationId: 3, oldStatus: 'SUBMITTED', status: 'WITHDRAWN' });
  }
});

test('controller prosljeduje pogreske popisa i povlacenja error middlewareu', async () => {
  const error = new Error('DB failure');
  const controller = createCandidateApplicationsController({ writesEnabled: true, model: {
    async listMine() { throw error; }, async withdraw() { throw error; }
  } });
  for (const action of ['list', 'withdraw']) {
    let passed;
    await controller[action]({ user: { id: 7 }, params: { applicationId: '3' } }, response(), e => { passed = e; });
    assert.equal(passed, error);
  }
});
