'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const session = require('express-session');
const pool = require('../src/config/db');
const { createApp } = require('../src/app');
const { loadAuthConfig } = require('../src/auth/config');
const { createPassport } = require('../src/auth/passport');

const path = '/api/employer/castings/1/applications/3/status';
const origin = 'http://localhost:5173';
const config = loadAuthConfig({
  SESSION_SECRET: 'test-secret-with-at-least-thirty-two-characters',
  GOOGLE_CLIENT_ID: 'test-client',
  GOOGLE_CLIENT_SECRET: 'test-google-secret'
});

async function fixture(t, { role = 'employer', writesEnabled = true,
  casting = { id: 1, status: 'published', positions_count: 2 },
  application = { id: 3, status: 'SUBMITTED' }, failHistory = false } = {}) {
  // Stvarna aplikacija i middleware, ali sve DB veze su zamijenjene mockom.
  // Postavke vrijede samo za ovaj proces; backend/.env se ne mijenja.
  const environment = {
    PGHOST: '127.0.0.1', PGPORT: '5432', PGDATABASE: 'castme_test',
    APPLICATION_WRITES_ENABLED: 'false',
    EMPLOYER_CASTING_WRITES_ENABLED: String(writesEnabled),
    EMPLOYER_CASTING_WRITES_CONFIRMED: 'true'
  };
  const previous = Object.fromEntries(Object.keys(environment).map(key => [key, process.env[key]]));
  Object.assign(process.env, environment);
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  const queries = [];
  let connections = 0;
  let releases = 0;
  t.mock.method(pool, 'query', () => { throw new Error('Unexpected database query'); });
  t.mock.method(pool, 'connect', async () => {
    connections++;
    return {
      async query(sql, params) {
        queries.push({ sql, params });
        if (sql.includes('FROM casting_calls')) return { rows: casting ? [casting] : [] };
        if (sql.includes('FOR UPDATE') && sql.includes('FROM applications')) {
          return { rows: application ? [application] : [] };
        }
        if (sql.includes('COUNT(*)::int')) return { rows: [{ total: 0 }] };
        if (failHistory && sql.includes('INSERT INTO application_status_history')) {
          throw new Error('History failure');
        }
        return { rows: [] };
      },
      release() { releases++; }
    };
  });

  const user = { id: 7, role, email: 'route@example.test' };
  const users = {
    async findById(id) { return id === user.id ? user : null; },
    async findByAuthId() { return user; }
  };
  const passport = createPassport(config, users);
  const google = passport._strategy('google');
  google._oauth2.getOAuthAccessToken = (_code, _params, done) => done(null, 'fake-access-token');
  google.userProfile = (_token, done) => done(null, {
    id: 'route-subject',
    _json: { sub: 'route-subject', email_verified: true },
    emails: [{ value: user.email }],
    name: { givenName: 'Route', familyName: 'Test' }
  });
  const store = new session.MemoryStore();
  const server = createApp({ config, users, passport, store }).listen(0, '127.0.0.1');
  t.after(async () => {
    await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
    store.clear();
  });
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  let cookie;
  let csrfToken;
  async function request(url, options = {}) {
    const result = await fetch(base + url, {
      redirect: 'manual', ...options,
      headers: { ...(cookie ? { Cookie: cookie } : {}), ...options.headers }
    });
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
  async function change({ url = path, method = 'PATCH', body = { status: 'UNDER_REVIEW' },
    token = csrfToken, requestOrigin = origin } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (token != null) headers['X-CSRF-Token'] = token;
    if (requestOrigin != null) headers.Origin = requestOrigin;
    return request(url, { method, headers, body: JSON.stringify(body) });
  }
  return { signIn, change, queries, connections: () => connections, releases: () => releases };
}

function assertNoWrites(f) {
  assert.equal(f.queries.some(q => /^\s*(UPDATE|INSERT)\b/.test(q.sql)), false);
  assert.equal(f.queries.some(q => q.sql === 'COMMIT'), false);
}

test('PATCH status: neprijavljeni korisnik nema pristup', async t => {
  const f = await fixture(t);
  const response = await f.change();
  assert.equal(response.status, 401);
  assert.equal((await response.json()).code, 'AUTH_REQUIRED');
  assert.equal(f.connections(), 0);
});

test('PATCH status: kandidat nema ovlasti ni uz valjani CSRF', async t => {
  const f = await fixture(t, { role: 'candidate' });
  await f.signIn();
  const response = await f.change();
  assert.equal(response.status, 403);
  assert.equal((await response.json()).code, 'FORBIDDEN');
  assert.equal(f.connections(), 0);
});

test('PATCH status: obavezni su valjani CSRF i dopusteni Origin', async t => {
  const f = await fixture(t);
  await f.signIn();
  for (const options of [{ token: null }, { token: 'wrong-token' },
    { requestOrigin: null }, { requestOrigin: 'https://attacker.example' }]) {
    const response = await f.change(options);
    assert.equal(response.status, 403);
    assert.equal((await response.json()).code, 'INVALID_CSRF');
  }
  assert.equal(f.connections(), 0);
});

test('PATCH status: iskljuceni upisi vracaju 503 bez DB veze', async t => {
  const f = await fixture(t, { writesEnabled: false });
  await f.signIn();
  assert.equal((await f.change()).status, 503);
  assert.equal(f.connections(), 0);
});

test('PATCH status: poslodavac mijenja status, biljezi povijest i potvrduje transakciju', async t => {
  const f = await fixture(t);
  await f.signIn();
  const response = await f.change();
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { applicationId: 3, oldStatus: 'SUBMITTED', status: 'UNDER_REVIEW' });
  const casting = f.queries.find(q => q.sql.includes('FROM casting_calls'));
  assert.match(casting.sql, /o\.owner_id = \$2/);
  assert.deepEqual(casting.params, [1, 7]);
  const application = f.queries.find(q => q.sql.includes('FROM applications'));
  assert.match(application.sql, /casting_call_id = \$2/);
  assert.deepEqual(application.params, [3, 1]);
  assert.deepEqual(f.queries.find(q => q.sql.includes('UPDATE applications')).params, ['UNDER_REVIEW', null, 3]);
  assert.deepEqual(f.queries.find(q => q.sql.includes('INSERT INTO application_status_history')).params,
    ['SUBMITTED', 'UNDER_REVIEW', null, 3, 7]);
  assert.equal(f.queries.at(-1).sql, 'COMMIT');
  assert.equal(f.releases(), 1);
});

test('PATCH status: validira ID, status i razlog te ne dopusta izravni ACCEPTED ili SELECTED', async t => {
  const f = await fixture(t);
  await f.signIn();
  for (const options of [
    { url: path.replace('/castings/1/', '/castings/abc/') },
    { url: path.replace('/applications/3/', '/applications/0/') },
    ...['ACCEPTED', 'SELECTED', 'UNKNOWN'].map(status => ({ body: { status } })),
    { body: {} },
    { body: { status: 'REJECTED' } },
    { body: { status: 'REJECTED', rejectionReason: '  ' } },
    { body: { status: 'REJECTED', rejectionReason: 42 } },
    { body: { status: 'REJECTED', rejectionReason: 'x'.repeat(2001) } }
  ]) assert.equal((await f.change(options)).status, 400);
  assert.equal(f.connections(), 0);
});

for (const [name, options, status] of [
  ['tudi ili nepostojeci oglas', { casting: null }, 404],
  ['prijava iz drugog oglasa', { application: null }, 404],
  ['zatvoren tijek oglasa', { casting: { id: 1, status: 'filled' } }, 409],
  ['nedopusten prijelaz', { application: { id: 3, status: 'AUDITIONED' } }, 409],
  ['prihvacena prijava', { application: { id: 3, status: 'ACCEPTED' } }, 409]
]) {
  test(`PATCH status: ${name} odbija promjenu i radi rollback`, async t => {
    const f = await fixture(t, options);
    await f.signIn();
    assert.equal((await f.change()).status, status);
    assertNoWrites(f);
    assert.equal(f.queries.at(-1).sql, 'ROLLBACK');
    assert.equal(f.releases(), 1);
  });
}

test('PATCH status: odbijanje sprema ocisceni razlog u prijavu i povijest', async t => {
  const f = await fixture(t);
  await f.signIn();
  const response = await f.change({ body: { status: 'REJECTED', rejectionReason: '  Ne odgovara ulozi.  ' } });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).status, 'REJECTED');
  assert.deepEqual(f.queries.find(q => q.sql.includes('UPDATE applications')).params,
    ['REJECTED', 'Ne odgovara ulozi.', 3]);
  assert.deepEqual(f.queries.find(q => q.sql.includes('INSERT INTO application_status_history')).params,
    ['SUBMITTED', 'REJECTED', 'Ne odgovara ulozi.', 3, 7]);
});

test('PATCH status: greska povijesti vraca 500 uz rollback i release', async t => {
  const f = await fixture(t, { failHistory: true });
  await f.signIn();
  assert.equal((await f.change()).status, 500);
  assert.equal(f.queries.at(-1).sql, 'ROLLBACK');
  assert.equal(f.queries.some(q => q.sql === 'COMMIT'), false);
  assert.equal(f.releases(), 1);
});

test('PATCH status: audicija se oznacava AUDITIONED, a konacni odabir koristi zasebnu rutu', async t => {
  const application = { id: 3, status: 'INVITED' };
  const f = await fixture(t, { application });
  await f.signIn();
  const audition = await f.change({ body: { status: 'AUDITIONED' } });
  assert.equal(audition.status, 200);
  assert.deepEqual(await audition.json(), { applicationId: 3, oldStatus: 'INVITED', status: 'AUDITIONED' });
  // Sljedeci zahtjev cita stanje nakon uspjesno zavrsene audicije.
  application.status = 'AUDITIONED';
  const selection = await f.change({ url: path.replace('/status', '/select'), method: 'POST', body: {} });
  assert.equal(selection.status, 200);
  assert.deepEqual(await selection.json(), { applicationId: 3, applicationStatus: 'ACCEPTED',
    castingId: 1, castingStatus: 'published', selectedCount: 1, positionsCount: 2 });
  assert.equal(f.connections(), 2);
  assert.equal(f.releases(), 2);
});
