'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const session = require('express-session');
const pool = require('../src/config/db');
const { createApp } = require('../src/app');
const { loadAuthConfig } = require('../src/auth/config');
const { createPassport } = require('../src/auth/passport');
const { createCandidateApplicationsModel } = require('../src/models/candidateApplicationsModel');

const path = '/api/candidate/applications';
const config = loadAuthConfig({
  SESSION_SECRET: 'test-secret-with-at-least-thirty-two-characters',
  GOOGLE_CLIENT_ID: 'test-client', GOOGLE_CLIENT_SECRET: 'test-google-secret'
});

async function fixture(t, { role = 'candidate', writesEnabled = true, casting = { id: 1 },
  application = { id: 3, status: 'SUBMITTED' }, activeBookings = false, guardsReady = true, failHistory = false,
  failList = false, rows = [{ id: 3, status: 'SUBMITTED', castingId: 1, projectTitle: 'Film', roleTitle: 'Uloga' }] } = {}) {
  const environment = {
    PGHOST: '127.0.0.1', PGPORT: '5432', PGDATABASE: 'castme_test',
    APPLICATION_WRITES_ENABLED: String(writesEnabled), APPLICATION_WRITES_CONFIRMED: 'true',
    APPLICATION_WRITES_ALLOW_REMOTE: 'false', EMPLOYER_CASTING_WRITES_ENABLED: 'false'
  };
  const previous = Object.fromEntries(Object.keys(environment).map(key => [key, process.env[key]]));
  Object.assign(process.env, environment);
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  // Sve nove rute koriste injektirani model; neocekivana stvarna DB veza je zabranjena.
  t.mock.method(pool, 'query', () => { throw new Error('Unexpected real database query'); });
  t.mock.method(pool, 'connect', () => { throw new Error('Unexpected real database connection'); });
  const queries = [];
  let releases = 0;
  const database = {
    async query(sql, params) {
      queries.push({ sql, params });
      if (failList) throw new Error('Private database failure');
      return { rows };
    },
    async connect() {
      return {
        async query(sql, params) {
          queries.push({ sql, params });
          if (sql.includes('FOR UPDATE OF c')) return { rows: casting ? [casting] : [] };
          if (sql.includes('FOR UPDATE OF a')) return { rows: application ? [application] : [] };
          if (sql.includes('withdrawal_guards_ready')) return { rows: [{ withdrawal_guards_ready: guardsReady }] };
          if (sql.includes('has_active_bookings')) return { rows: [{ has_active_bookings: activeBookings }] };
          if (failHistory && sql.includes('INSERT INTO application_status_history')) throw new Error('Private history failure');
          return { rows: [] };
        },
        release() { releases++; }
      };
    }
  };
  const user = { id: 7, role, email: 'candidate-route@example.test' };
  const users = { async findById(id) { return id === user.id ? user : null; }, async findByAuthId() { return user; } };
  const passport = createPassport(config, users);
  const google = passport._strategy('google');
  google._oauth2.getOAuthAccessToken = (_code, _params, done) => done(null, 'fake-access-token');
  google.userProfile = (_token, done) => done(null, {
    id: 'candidate-route-subject', _json: { sub: 'candidate-route-subject', email_verified: true },
    emails: [{ value: user.email }], name: { givenName: 'Candidate', familyName: 'Test' }
  });
  const store = new session.MemoryStore();
  const app = createApp({ config, users, passport, store,
    candidateApplicationsModel: createCandidateApplicationsModel(database) });
  const server = app.listen(0, '127.0.0.1');
  t.after(async () => {
    await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
    store.clear();
  });
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  let cookie;
  let csrfToken;
  async function request(url, options = {}) {
    const result = await fetch(base + url, { redirect: 'manual', ...options,
      headers: { ...(cookie ? { Cookie: cookie } : {}), ...options.headers } });
    const setCookie = result.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.split(';')[0];
    return result;
  }
  async function signIn() {
    const start = await request('/api/auth/google');
    assert.equal(start.status, 302);
    const state = new URL(start.headers.get('location')).searchParams.get('state');
    assert.ok(state);
    const callback = await request(`/api/auth/google/callback?code=test-code&state=${encodeURIComponent(state)}`);
    assert.equal(callback.status, 302);
    const me = await request('/api/auth/me');
    assert.equal(me.status, 200);
    const data = await me.json();
    assert.equal(data.user.role, role);
    csrfToken = data.csrfToken;
    assert.ok(csrfToken);
  }
  async function withdraw({ id = '3', token = csrfToken, origin = 'http://localhost:5173', body = '{}' } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (token != null) headers['X-CSRF-Token'] = token;
    if (origin != null) headers.Origin = origin;
    return request(`${path}/${id}/withdraw`, { method: 'PATCH', headers, body });
  }
  return { request, signIn, withdraw, queries, releases: () => releases };
}

test('kandidatove rute zahtijevaju prijavu prije pristupa modelu', async t => {
  const f = await fixture(t);
  for (const response of [await f.request(path), await f.withdraw()]) {
    assert.equal(response.status, 401);
    assert.equal((await response.json()).code, 'AUTH_REQUIRED');
  }
  assert.deepEqual(f.queries, []);
});

for (const role of ['employer', 'admin']) {
  test(`kandidatove rute odbijaju ulogu ${role}`, async t => {
    const f = await fixture(t, { role });
    await f.signIn();
    for (const response of [await f.request(path), await f.withdraw()]) {
      assert.equal(response.status, 403);
      assert.equal((await response.json()).code, 'FORBIDDEN');
    }
    assert.deepEqual(f.queries, []);
  });
}

test('GET vlastitih prijava radi i kad su upisi iskljuceni; identitet dolazi iz sesije', async t => {
  const f = await fixture(t, { writesEnabled: false });
  await f.signIn();
  const response = await f.request(path + '?userId=99&candidateId=99');
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { applications: [
    { id: 3, status: 'SUBMITTED', castingId: 1, projectTitle: 'Film', roleTitle: 'Uloga' }
  ] });
  assert.deepEqual(f.queries[0].params, [7]);
});

test('GET vlastitih prijava vraca prazan popis', async t => {
  const f = await fixture(t, { rows: [] });
  await f.signIn();
  const response = await f.request(path);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { applications: [] });
});

test('PATCH povlacenja zahtijeva dopusteni Origin i valjani CSRF', async t => {
  const f = await fixture(t);
  await f.signIn();
  for (const options of [{ token: null }, { token: 'wrong-token' },
    { origin: null }, { origin: 'https://attacker.example' }]) {
    const response = await f.withdraw(options);
    assert.equal(response.status, 403);
    assert.equal((await response.json()).code, 'INVALID_CSRF');
  }
  assert.deepEqual(f.queries, []);
});

test('PATCH povlacenja postuje postojecu blokadu upisa prije DB veze', async t => {
  const f = await fixture(t, { writesEnabled: false });
  await f.signIn();
  assert.equal((await f.withdraw()).status, 503);
  assert.deepEqual(f.queries, []);
});

test('PATCH povlacenja validira ID prije DB veze', async t => {
  const f = await fixture(t);
  await f.signIn();
  for (const id of ['abc', '0', '-1', '1.5', '2147483648', '9007199254740992']) {
    assert.equal((await f.withdraw({ id })).status, 400);
  }
  assert.deepEqual(f.queries, []);
});

test('PATCH povlacenja sprema vlasniku iz sesije i vraca WITHDRAWN', async t => {
  const f = await fixture(t);
  await f.signIn();
  const response = await f.withdraw({ body: JSON.stringify({ userId: 99, candidateId: 99, status: 'ACCEPTED' }) });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { applicationId: 3, oldStatus: 'SUBMITTED', status: 'WITHDRAWN' });
  assert.deepEqual(f.queries.find(q => q.sql.includes('FOR UPDATE OF c')).params, [3, 7]);
  assert.deepEqual(f.queries.find(q => q.sql.includes('INSERT INTO application_status_history')).params,
    ['SUBMITTED', 'Prijavu povukao kandidat.', 3, 7]);
  assert.equal(f.queries.at(-1).sql, 'COMMIT');
  assert.equal(f.releases(), 1);
});

for (const [name, options, code] of [
  ['tuda ili nepostojeca prijava', { casting: null }, 404],
  ['nestala prijava', { application: null }, 404],
  ['zavrsena audicija', { application: { id: 3, status: 'AUDITIONED' } }, 409],
  ['ponovljeno povlacenje', { application: { id: 3, status: 'WITHDRAWN' } }, 409],
  ['aktivna rezervacija', { activeBookings: true }, 409],
  ['nedostupna DB zastita', { guardsReady: false }, 503]
]) {
  test(`PATCH: ${name} odbija upis i radi rollback`, async t => {
    const f = await fixture(t, options);
    await f.signIn();
    assert.equal((await f.withdraw()).status, code);
    assert.equal(f.queries.some(q => /^\s*(UPDATE|INSERT|DELETE)\b/.test(q.sql)), false);
    assert.equal(f.queries.at(-1).sql, 'ROLLBACK');
    assert.equal(f.releases(), 1);
  });
}

test('HTTP pogreske baze ne iznose privatne detalje i rollback radi', async t => {
  const f = await fixture(t, { failHistory: true, failList: true });
  await f.signIn();
  for (const response of [await f.request(path), await f.withdraw()]) {
    assert.equal(response.status, 500);
    assert.doesNotMatch(JSON.stringify(await response.json()), /Private|SELECT|INSERT/);
  }
  assert.equal(f.queries.at(-1).sql, 'ROLLBACK');
  assert.equal(f.queries.some(q => q.sql === 'COMMIT'), false);
  assert.equal(f.releases(), 1);
});

test('neispravan i prevelik JSON odbijaju se prije modela', async t => {
  const f = await fixture(t);
  await f.signIn();
  assert.equal((await f.withdraw({ body: '{' })).status, 400);
  assert.equal((await f.withdraw({ body: JSON.stringify({ text: 'x'.repeat(17000) }) })).status, 413);
  assert.deepEqual(f.queries, []);
});
