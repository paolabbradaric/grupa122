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
const productionConfig = loadAuthConfig({
  NODE_ENV: 'production',
  SESSION_SECRET: config.secret,
  GOOGLE_CLIENT_ID: config.googleClientId,
  GOOGLE_CLIENT_SECRET: config.googleClientSecret,
  FRONTEND_URL: 'https://castme.example.test',
  GOOGLE_CALLBACK_URL: 'https://castme.example.test/api/auth/google/callback',
  TRUST_PROXY_HOPS: '1',
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

async function fixture(t, { existing = false, disabled = false, configured = true, role = 'candidate',
  authConfig = config, forwardedProto } = {}) {
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
    const user = { id: 1, email: 'candidate@example.test', ...candidate, role };
    usersById.set(1, user);
    authIds.set('google:google-subject', user);
  }
  const settings = configured ? authConfig : { ...authConfig, googleClientId: null, googleClientSecret: null };
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
      headers: { ...(cookie ? { Cookie: cookie } : {}),
        ...(forwardedProto ? { 'X-Forwarded-Proto': forwardedProto } : {}), ...options.headers },
    });
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.split(';')[0];
    return response;
  }
  async function signIn(headers = {}) {
    const start = await request('/api/auth/google', { headers });
    assert.equal(start.status, 302);
    const url = new URL(start.headers.get('location'));
    assert.equal(url.origin, 'https://accounts.google.com');
    assert.equal(url.searchParams.get('client_id'), settings.googleClientId);
    assert.equal(url.searchParams.get('redirect_uri'), settings.callbackUrl);
    assert.equal(url.searchParams.get('response_type'), 'code');
    assert.deepEqual(url.searchParams.get('scope').split(' ').sort(), ['email', 'openid', 'profile']);
    assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
    assert.ok(url.searchParams.get('state'));
    if (settings.production) assertSecureCookie(start);
    const callback = await request(`/api/auth/google/callback?code=test-code&state=${url.searchParams.get('state')}`, { headers });
    assert.equal(callback.status, 302);
    assert.equal(callback.headers.get('location'), settings.frontendUrl);
    if (settings.production) assertSecureCookie(callback);
    return request('/api/auth/me');
  }
  return { request, signIn, getCookie: () => cookie, registrations: () => registrations, exchanges: () => exchanges };
}

function assertSecureCookie(response) {
  const cookie = response.headers.get('set-cookie');
  assert.ok(cookie);
  for (const attribute of [/; Secure(?:;|$)/, /; HttpOnly(?:;|$)/, /; SameSite=Lax(?:;|$)/, /; Path=\/(?:;|$)/]) {
    assert.match(cookie, attribute);
  }
  assert.doesNotMatch(cookie, /; Domain=/i);
}

test('HTTPS iza proxyja: callback, onboarding, obnova i odjava zadržavaju sigurnu sesiju', async t => {
  for (const existing of [false, true]) {
    await t.test(existing ? 'postojeći poslodavac' : 'novi kandidat', async t => {
      const app = await fixture(t, { existing, role: 'employer', authConfig: productionConfig, forwardedProto: 'https' });
      const response = await app.signIn({ Host: 'attacker.example', 'X-Forwarded-Host': 'attacker.example' });
      let current = await response.json();
      assert.equal(current.onboardingRequired, !existing);
      if (!existing) {
        const pendingCookie = app.getCookie();
        const registration = await app.request('/api/auth/onboarding', {
          method: 'POST',
          headers: { Origin: new URL(productionConfig.frontendUrl).origin,
            'Content-Type': 'application/json', 'X-CSRF-Token': current.csrfToken },
          body: JSON.stringify(candidate),
        });
        assert.equal(registration.status, 201);
        assertSecureCookie(registration);
        assert.notEqual(app.getCookie(), pendingCookie);
        current = await registration.json();
      }
      const expectedRole = existing ? 'employer' : 'candidate';
      assert.equal(current.user.role, expectedRole);
      assert.equal(current.onboardingRequired, false);
      const refreshed = await (await app.request('/api/auth/me')).json();
      assert.equal(refreshed.user.id, current.user.id);
      assert.equal(refreshed.user.role, expectedRole);
      const signedInCookie = app.getCookie();
      const logout = await app.request('/api/auth/logout', { method: 'POST',
        headers: { Origin: new URL(productionConfig.frontendUrl).origin, 'X-CSRF-Token': refreshed.csrfToken } });
      assert.equal(logout.status, 200);
      assertSecureCookie(logout);
      assert.match(logout.headers.get('set-cookie'), /Expires=Thu, 01 Jan 1970/);
      assert.equal((await app.request('/api/auth/me', { headers: { Cookie: signedInCookie } })).status, 401);
      const repeated = await (await app.signIn()).json();
      assert.equal(repeated.user.id, current.user.id);
      assert.equal(repeated.user.role, expectedRole);
      assert.equal(repeated.onboardingRequired, false);
      assert.equal(app.registrations(), existing ? 0 : 1);
    });
  }
});

test('produkcija ne šalje Secure cookie bez HTTPS-a ili uz nepouzdani proxy', async t => {
  for (const options of [
    {},
    { forwardedProto: 'http' },
    { forwardedProto: 'https', authConfig: { ...productionConfig, trustProxy: 0 } },
  ]) {
    const app = await fixture(t, { authConfig: productionConfig, ...options });
    const start = await app.request('/api/auth/google');
    assert.equal(start.status, 302);
    assert.equal(start.headers.get('set-cookie'), null);
    const state = new URL(start.headers.get('location')).searchParams.get('state');
    const callback = await app.request(`/api/auth/google/callback?code=test-code&state=${state}`);
    assert.equal(new URL(callback.headers.get('location')).origin, new URL(productionConfig.frontendUrl).origin);
    assert.equal(new URL(callback.headers.get('location')).searchParams.get('authError'), 'oauth_failed');
    assert.equal(app.exchanges(), 0);
    assert.equal((await app.request('/api/auth/me')).status, 401);
  }
});

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
  const again = await app.signIn();
  assert.equal((await again.json()).user.id, current.user.id);
  assert.equal(app.registrations(), 0);
  assert.equal(app.exchanges(), 2);
});

test('postojeći poslodavac zadržava spremljenu ulogu pri ponovnoj prijavi', async t => {
  const app = await fixture(t, { existing: true, role: 'employer' });
  const me = await app.signIn();
  assert.equal((await me.json()).user.role, 'employer');
  assert.equal(app.registrations(), 0);
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
  assert.equal((await app.request('/api/auth/me')).status, 401);
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
  for (const accept of ['application/json', '*/*']) {
    const response = await app.request('/api/auth/google', { headers: { Accept: accept } });
    assert.equal(response.status, 503);
    assert.equal((await response.json()).code, 'GOOGLE_NOT_CONFIGURED');
  }
  assert.throws(() => loadAuthConfig({}), /SESSION_SECRET/);
  assert.throws(() => loadAuthConfig({ SESSION_SECRET: config.secret, NODE_ENV: 'production' }), /HTTPS/);
});

test('bez Google ključeva preglednik se vraća u aplikaciju bez nove sesije', async t => {
  const app = await fixture(t, { configured: false });
  for (const path of ['/api/auth/google', '/api/auth/google/callback?code=unused']) {
    const response = await app.request(path, { headers: { Accept: 'text/html' } });
    assert.equal(response.status, 302);
    const url = new URL(response.headers.get('location'));
    assert.equal(url.origin, new URL(config.frontendUrl).origin);
    assert.equal(url.searchParams.get('authError'), 'google_not_configured');
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('set-cookie'), null);
  }
  assert.equal((await app.request('/api/auth/me')).status, 401);
  assert.equal(app.registrations(), 0);
});

test('ograničenje pokušaja vraća 429 i Retry-After', async t => {
  const app = await fixture(t);
  for (let i = 0; i < 20; i++) assert.equal((await app.request('/api/auth/google')).status, 302);
  const rejected = await app.request('/api/auth/google', { headers: { Accept: 'application/json' } });
  assert.equal(rejected.status, 429);
  assert.ok(Number(rejected.headers.get('retry-after')) > 0);
  assert.equal((await rejected.json()).code, 'AUTH_RATE_LIMITED');
});

test('ograničenje OAuth navigacije vraća preglednik u aplikaciju, a onboarding zadržava JSON', async t => {
  const app = await fixture(t);
  for (let i = 0; i < 20; i++) await app.request('/api/auth/google');
  for (const path of ['/api/auth/google', '/api/auth/google/callback?code=unused']) {
    const response = await app.request(path, { headers: { Accept: 'text/html' } });
    assert.equal(response.status, 302);
    assert.equal(new URL(response.headers.get('location')).searchParams.get('authError'), 'rate_limited');
    assert.ok(Number(response.headers.get('retry-after')) > 0);
  }
  const onboarding = await app.request('/api/auth/onboarding', { method: 'POST', headers: { Accept: 'text/html' } });
  assert.equal(onboarding.status, 429);
  assert.equal((await onboarding.json()).code, 'AUTH_RATE_LIMITED');
  assert.equal(app.exchanges(), 0);
  assert.equal((await app.request('/api/auth/me')).status, 401);
});
