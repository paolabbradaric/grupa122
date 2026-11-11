const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const session = require('express-session');
const { loadAuthConfig } = require('../src/auth/config');
const { googleIdentity, createPassport } = require('../src/auth/passport');
const { validateProfile } = require('../src/auth/validation');
const { requireRole } = require('../src/auth/middleware');
const { AuthError } = require('../src/auth/errors');
const { createApp } = require('../src/app');

const config = loadAuthConfig({
  SESSION_SECRET: 'test-secret-with-at-least-thirty-two-characters',
  GOOGLE_CLIENT_ID: 'test-client',
  GOOGLE_CLIENT_SECRET: 'test-google-secret',
});
const profile = {
  id: 'google-subject',
  _json: { sub: 'google-subject', email_verified: true },
  emails: [{ value: 'Candidate@example.test' }],
  name: { givenName: 'Iva', familyName: 'Ivić' },
};
const candidate = { role: 'candidate', firstName: 'Iva', lastName: 'Ivić', birthDate: '2000-04-12' };
const employer = {
  ...candidate, role: 'employer', companyName: 'Test produkcija', regNum: '33392005961',
  contactEmail: 'produkcija@example.test', phone: '+385 1 1234567', location: 'Zagreb',
};

test('validira točnu dob, kalendarski datum, ulogu i OIB na serveru', () => {
  const today = new Date('2026-11-03T12:00:00Z');
  assert.equal(validateProfile({ ...candidate, birthDate: '2008-11-03' }, today).role, 'candidate');
  for (const body of [
    { ...candidate, birthDate: '2008-11-04' },
    { ...candidate, birthDate: '2000-02-30' },
    { ...candidate, role: 'admin' },
    { ...candidate, firstName: ' ' },
    { ...employer, regNum: '33392005962' },
  ]) assert.throws(() => validateProfile(body, today), error => error.status === 400);
  assert.equal(validateProfile(employer, today).location, 'Zagreb');
});

test('Google identitet zahtijeva potvrđen e-mail i koristi google:sub', () => {
  assert.equal(googleIdentity(profile).authId, 'google:google-subject');
  assert.equal(googleIdentity(profile).email, 'candidate@example.test');
  for (const verified of [false, undefined, 'true']) {
    assert.throws(() => googleIdentity({ ...profile, _json: { sub: profile.id, email_verified: verified } }), AuthError);
  }
});

test('provjera ovlasti vraća 401 gostu, 403 kandidatu i propušta poslodavca', () => {
  for (const [user, expected] of [[null, 401], [{ role: 'candidate' }, 403], [{ role: 'employer' }, undefined]]) {
    let called = false;
    requireRole('employer')({ user, isAuthenticated: () => Boolean(user) }, {}, error => {
      called = true;
      assert.equal(error?.status, expected);
    });
    assert.ok(called);
  }
});

async function fixture(t, { existing = false, disabled = false, configured = true } = {}) {
  const usersById = new Map();
  const authIds = new Map();
  let registrations = 0;
  const users = {
    async findById(id) { return disabled ? null : usersById.get(id) || null; },
    async findByAuthId(id) { return authIds.get(id) || null; },
    async register(identity, data) {
      registrations++;
      const user = { id: 1, email: identity.email, ...data };
      usersById.set(1, user);
      authIds.set(identity.authId, user);
      return user;
    },
  };
  if (existing) {
    const user = { id: 1, email: 'candidate@example.test', ...candidate };
    usersById.set(1, user);
    authIds.set('google:google-subject', user);
  }
  const settings = configured ? config : { ...config, googleClientId: null, googleClientSecret: null };
  const passport = createPassport(settings, users);
  let exchanges = 0;
  if (configured) {
    const google = passport._strategy('google');
    // Mock samo Google HTTP granicu; Passport provjera state/PKCE ostaje stvarna.
    google._oauth2.getOAuthAccessToken = (code, params, done) => {
      exchanges++;
      assert.ok(params.code_verifier);
      done(null, 'mock-access-token', 'mock-refresh-token');
    };
    google.userProfile = (token, done) => done(null, profile);
  }
  const store = new session.MemoryStore();
  const app = createApp({ config: settings, users, passport, store });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
    store.clear();
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  let cookie;
  async function request(path, options = {}) {
    const response = await fetch(base + path, {
      redirect: 'manual', ...options,
      headers: { ...(cookie ? { Cookie: cookie } : {}), ...options.headers },
    });
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.split(';')[0];
    return response;
  }
  async function signIn() {
    const start = await request('/api/auth/google');
    assert.equal(start.status, 302);
    const url = new URL(start.headers.get('location'));
    assert.equal(url.origin, 'https://accounts.google.com');
    assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
    assert.ok(url.searchParams.get('state'));
    const callback = await request(`/api/auth/google/callback?code=test-code&state=${url.searchParams.get('state')}`);
    assert.equal(callback.status, 302);
    assert.equal(callback.headers.get('location'), config.frontendUrl);
    return request('/api/auth/me');
  }
  return { request, signIn, getCookie: () => cookie, registrations: () => registrations, exchanges: () => exchanges };
}

test('novi račun: OAuth → nepotpuna registracija → validacija → nova sesija → odjava', async t => {
  const app = await fixture(t);
  assert.equal((await app.request('/api/auth/me')).status, 401);
  const me = await app.signIn();
  const pendingCookie = app.getCookie();
  const pending = await me.json();
  assert.equal(pending.onboardingRequired, true);
  assert.equal(pending.user, null);
  assert.equal(pending.identity.email, 'candidate@example.test');
  assert.equal(JSON.stringify(pending).includes('mock-access-token'), false);
  const headers = { Origin: 'http://localhost:5173', 'Content-Type': 'application/json', 'X-CSRF-Token': pending.csrfToken };
  const escalation = await app.request('/api/auth/onboarding', { method: 'POST', headers, body: JSON.stringify({ ...candidate, role: 'admin' }) });
  assert.equal(escalation.status, 400);
  assert.equal(app.registrations(), 0);
  const registration = await app.request('/api/auth/onboarding', { method: 'POST', headers, body: JSON.stringify(candidate) });
  assert.equal(registration.status, 201);
  assert.notEqual(app.getCookie(), pendingCookie);
  const registered = await registration.json();
  assert.equal(registered.user.role, 'candidate');
  assert.equal(registered.onboardingRequired, false);
  assert.notEqual(registered.csrfToken, pending.csrfToken);
  const authenticatedCookie = app.getCookie();
  const repeat = await app.request('/api/auth/me');
  assert.equal((await repeat.json()).user.id, 1);
  const logoutHeaders = { Origin: 'http://localhost:5173', 'X-CSRF-Token': registered.csrfToken };
  const logout = await app.request('/api/auth/logout', { method: 'POST', headers: logoutHeaders });
  assert.equal(logout.status, 200);
  assert.match(logout.headers.get('set-cookie'), /Expires=Thu, 01 Jan 1970/);
  assert.equal((await app.request('/api/auth/me', { headers: { Cookie: authenticatedCookie } })).status, 401);
});

test('ponovna prijava prepoznaje postojeći račun bez registracije', async t => {
  const app = await fixture(t, { existing: true });
  const response = await app.signIn();
  const current = await response.json();
  assert.equal(current.user.id, 1);
  assert.equal(current.onboardingRequired, false);
  assert.equal(app.registrations(), 0);
  assert.equal(app.exchanges(), 1);
});

test('OAuth odbija pogrešan ili odsutan state prije razmjene tokena', async t => {
  const app = await fixture(t);
  await app.request('/api/auth/google');
  const callback = await app.request('/api/auth/google/callback?code=forged&state=wrong');
  assert.equal(callback.status, 302);
  assert.match(callback.headers.get('location'), /authError=oauth_failed/);
  assert.equal(app.exchanges(), 0);
  assert.equal((await app.request('/api/auth/me')).status, 401);
  const missing = await app.request('/api/auth/google/callback?code=forged');
  assert.equal(missing.status, 302);
  assert.equal(app.exchanges(), 0);
});

test('otkazana Google prijava vraća razumljivu šifru greške', async t => {
  const app = await fixture(t);
  const response = await app.request('/api/auth/google/callback?error=access_denied');
  assert.match(response.headers.get('location'), /authError=access_denied/);
  assert.equal(app.exchanges(), 0);
});

test('CSRF štiti odjavu i registraciju čak i kada napadač ima cookie', async t => {
  const app = await fixture(t);
  const me = await app.signIn();
  const data = await me.json();
  for (const headers of [
    { Origin: 'https://attacker.example', 'X-CSRF-Token': data.csrfToken },
    { Origin: 'http://localhost:5173' },
    { 'X-CSRF-Token': data.csrfToken },
    { Origin: 'http://localhost:5173', 'X-CSRF-Token': 'wrong' },
  ]) {
    for (const path of ['/logout', '/onboarding']) {
      assert.equal((await app.request(`/api/auth${path}`, { method: 'POST', headers })).status, 403);
    }
  }
  assert.equal((await app.request('/api/auth/me')).status, 200);
});

test('onemogućen račun ne prihvaća prethodno otvorenu sesiju', async t => {
  const app = await fixture(t, { existing: true, disabled: true });
  assert.equal((await app.signIn()).status, 401);
});

test('bez Google ključeva auth vraća 503, a bez SESSION_SECRET konfiguracija ne prolazi', async t => {
  const app = await fixture(t, { configured: false });
  assert.equal((await app.request('/api/auth/google')).status, 503);
  assert.throws(() => loadAuthConfig({}), /SESSION_SECRET/);
  assert.throws(() => loadAuthConfig({ SESSION_SECRET: config.secret, NODE_ENV: 'production' }), /HTTPS/);
});

test('ograničenje pokušaja vraća 429 i Retry-After', async t => {
  const app = await fixture(t);
  for (let i = 0; i < 20; i++) assert.equal((await app.request('/api/auth/google')).status, 302);
  const rejected = await app.request('/api/auth/google');
  assert.equal(rejected.status, 429);
  assert.ok(Number(rejected.headers.get('retry-after')) > 0);
});
