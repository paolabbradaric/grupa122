const { test } = require('node:test');
const assert = require('node:assert/strict');
const { httpFixture } = require('../test-utils/httpFixture');

test('only ten candidate submissions reach business writes; sessions and forged IPs do not reset quota', async t => {
  const fixture = await httpFixture(t, { writesEnabled: true });
  const cookie = await fixture.cookie(1);
  for (let i = 0; i < 10; i++) assert.equal((await fixture.post(cookie)).status, 201);
  const blocked = await fixture.post(await fixture.cookie(1), { 'X-Forwarded-For': '203.0.113.55' });
  assert.equal(blocked.status, 429);
  assert.equal((await blocked.json()).code, 'APPLICATION_RATE_LIMITED');
  assert.ok(Number(blocked.headers.get('retry-after')) > 0);
  assert.ok(blocked.headers.get('ratelimit'));
  assert.equal(blocked.headers.get('cache-control'), 'no-store');
  assert.equal(fixture.writes(), 10);
  assert.equal((await fixture.post(await fixture.cookie(2))).status, 201);
  assert.equal(fixture.writes(), 11);
});

test('authentication, role, Origin and CSRF reject before counting requests', async t => {
  const fixture = await httpFixture(t, { writesEnabled: true });
  const increment = t.mock.method(fixture.rateStore, 'increment');
  assert.equal((await fixture.post(null)).status, 401);
  for (const id of [3, 4]) assert.equal((await fixture.post(await fixture.cookie(id))).status, 403);
  const cookie = await fixture.cookie(1);
  for (const headers of [{ Origin: 'https://evil.example' }, { 'X-CSRF-Token': '' }, { Origin: '' }]) {
    assert.equal((await fixture.post(cookie, headers)).status, 403);
  }
  assert.equal(increment.mock.callCount(), 0);
  assert.equal(fixture.writes(), 0);
});

test('disabled writes do not touch the rate store; unavailable store fails closed with 503', async t => {
  const unavailable = { init() {}, async increment() { throw new Error('private storage failure'); },
    async decrement() {}, async resetKey() {} };
  const counter = t.mock.method(unavailable, 'increment');
  const disabled = await httpFixture(t, { writesEnabled: false, rateStore: unavailable });
  assert.equal((await disabled.post(await disabled.cookie())).status, 503);
  assert.equal(counter.mock.callCount(), 0);
  assert.equal(disabled.writes(), 0);
  const enabled = await httpFixture(t, { writesEnabled: true, rateStore: { ...unavailable, increment: unavailable.increment } });
  const response = await enabled.post(await enabled.cookie());
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { code: 'APPLICATION_RATE_LIMIT_UNAVAILABLE', error: 'Predaja prijava trenutačno nije dostupna.' });
  assert.equal(enabled.writes(), 0);
});
