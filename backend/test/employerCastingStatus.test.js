const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createEmployerCastingStatusModel } = require('../src/models/employerCastingStatusModel');
const { createEmployerCastingStatusController } = require('../src/controllers/employerCastingStatusController');

function mockDb({ casting = { id: 9, status: 'published' }, activeBookings = false, failAt = null } = {}) {
  const calls = [];
  let released = false;
  const client = {
    async query(sql, args) {
      const normalized = sql.trim();
      calls.push({ sql: normalized, args });
      if (failAt && normalized.includes(failAt)) throw new Error('DB failure');
      if (normalized.includes('FROM casting_calls c')) return { rows: casting ? [casting] : [] };
      if (normalized.includes('AS has_active_bookings')) return { rows: [{ has_active_bookings: activeBookings }] };
      return { rows: [] };
    },
    release() { released = true; }
  };
  return { db: { connect: async () => client }, calls, isReleased: () => released };
}
function res() { return { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; } }; }

test('zatvaranje objavljenog oglasa zapisuje closed i povijest u transakciji', async () => {
  const m = mockDb();
  const result = await createEmployerCastingStatusModel(m.db).close(4, 9);
  assert.deepEqual(result, { outcome: 'updated', id: 9, status: 'closed' });
  assert.equal(m.calls[0].sql, 'BEGIN');
  assert.ok(m.calls.some(x => x.sql.includes('FOR UPDATE OF c') && x.args[1] === 4));
  assert.ok(m.calls.some(x => x.sql.includes('UPDATE casting_calls') && x.args[0] === 'closed'));
  assert.ok(m.calls.some(x => x.sql.includes('INSERT INTO casting_call_status_history')));
  assert.equal(m.calls.at(-1).sql, 'COMMIT');
  assert.equal(m.isReleased(), true);
});

test('zatvaranje nepoznatog ili tuđeg oglasa ne radi promjene', async () => {
  const m = mockDb({ casting: null });
  assert.equal((await createEmployerCastingStatusModel(m.db).close(4, 9)).outcome, 'not_found');
  assert.equal(m.calls.at(-1).sql, 'ROLLBACK');
  assert.equal(m.isReleased(), true);
});

test('zatvaranje nacrta ili već zatvorenog oglasa nije dopušteno', async () => {
  for (const status of ['draft', 'closed', 'cancelled', 'filled']) {
    const m = mockDb({ casting: { id: 9, status } });
    assert.equal((await createEmployerCastingStatusModel(m.db).close(4, 9)).outcome, 'invalid_status');
    assert.ok(!m.calls.some(x => x.sql.includes('UPDATE casting_calls')));
  }
});

test('otkazivanje objavljenog oglasa otkazuje buduće termine bez rezervacija', async () => {
  const m = mockDb();
  assert.equal((await createEmployerCastingStatusModel(m.db).cancel(4, 9)).status, 'cancelled');
  assert.ok(m.calls.some(x => x.sql.includes('UPDATE audition_slots')));
  assert.ok(m.calls.some(x => x.sql.includes('INSERT INTO casting_call_status_history')));
  assert.equal(m.calls.at(-1).sql, 'COMMIT');
});

test('otkazivanje zatvorenog oglasa je dopušteno', async () => {
  const m = mockDb({ casting: { id: 9, status: 'closed' } });
  assert.equal((await createEmployerCastingStatusModel(m.db).cancel(4, 9)).status, 'cancelled');
});

test('otkazivanje nije dopušteno kod aktivnih budućih rezervacija audicija', async () => {
  const m = mockDb({ activeBookings: true });
  assert.equal((await createEmployerCastingStatusModel(m.db).cancel(4, 9)).outcome, 'active_bookings');
  assert.ok(!m.calls.some(x => x.sql.includes('UPDATE casting_calls')));
  assert.ok(!m.calls.some(x => x.sql.includes('UPDATE audition_slots')));
  assert.equal(m.calls.at(-1).sql, 'ROLLBACK');
});

test('otkazivanje nacrta, popunjenog i već otkazanog oglasa nije dopušteno', async () => {
  for (const status of ['draft', 'filled', 'cancelled']) {
    const m = mockDb({ casting: { id: 9, status } });
    assert.equal((await createEmployerCastingStatusModel(m.db).cancel(4, 9)).outcome, 'invalid_status');
  }
});

test('SQL greška pokreće rollback i release', async () => {
  const m = mockDb({ failAt: 'UPDATE casting_calls' });
  await assert.rejects(createEmployerCastingStatusModel(m.db).close(4, 9), /DB failure/);
  assert.equal(m.calls.at(-1).sql, 'ROLLBACK');
  assert.equal(m.isReleased(), true);
});

test('controller odbija neispravan ID i isključene upise', async () => {
  const c = createEmployerCastingStatusController({ writesEnabled: true, model: {} });
  const r = res();
  await c.close({ params: { id: 'abc' } }, r, assert.fail);
  assert.equal(r.statusCode, 400);
  const d = createEmployerCastingStatusController({ writesEnabled: false, model: {} });
  const s = res();
  await d.cancel({ params: { id: '5' } }, s, assert.fail);
  assert.equal(s.statusCode, 503);
});

test('controller mapira poslovne ishode u HTTP statuse', async () => {
  for (const [outcome, status] of [['not_found',404],['invalid_status',409],['active_bookings',409]]) {
    const c = createEmployerCastingStatusController({ writesEnabled: true, model: { cancel: async () => ({ outcome }) } });
    const r = res();
    await c.cancel({ user: { id: 3 }, params: { id: '5' } }, r, assert.fail);
    assert.equal(r.statusCode, status, outcome);
  }
});

test('controller uspješno mijenja status', async () => {
  const c = createEmployerCastingStatusController({ writesEnabled: true, model: {
    close: async (userId, id) => {
      assert.equal(userId, 3); assert.equal(id, 5);
      return { outcome: 'updated', status: 'closed' };
    }
  } });
  const r = res();
  await c.close({ user: { id: 3 }, params: { id: '5' } }, r, assert.fail);
  assert.deepEqual(r.body, { id: 5, status: 'closed' });
});

test('controller prosljeđuje neočekivane pogreške middlewareu', async () => {
  const c = createEmployerCastingStatusController({ writesEnabled: true, model: {
    close: async () => { throw new Error('upit'); }
  } });
  let captured;
  await c.close({ user: { id: 3 }, params: { id: '5' } }, res(), e => { captured = e; });
  assert.match(captured.message, /upit/);
});
