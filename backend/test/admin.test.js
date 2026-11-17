const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const session = require('express-session');
const { loadAuthConfig } = require('../src/auth/config');
const { parseAdminEmails } = require('../src/auth/adminPolicy');
const { createPassport } = require('../src/auth/passport');
const { createApp } = require('../src/app');
const { AuthError } = require('../src/auth/errors');

// Local verification can supply the real private list; CI uses five fictitious accounts.
const emails = [...parseAdminEmails(process.env.ADMIN_TEST_EMAILS ||
  'admin.one@example.test,admin.two@example.test,admin.three@example.test,admin.four@example.test,admin.five@example.test')];
const sample = email => ({ id: 'subject', _json: { sub: 'subject', email_verified: true },
  emails: [{ value: email }], name: { givenName: 'Test', familyName: 'Admin' } });

async function fixture(t, { email = emails[0], role, storedEmail = email, allowlist = emails.join(','),
  authId = 'google:subject', disabled = false, verified = true, provisionError } = {}) {
  const config = loadAuthConfig({ SESSION_SECRET: 'admin-test-secret-with-at-least-thirty-two-characters',
    GOOGLE_CLIENT_ID: 'test-client', GOOGLE_CLIENT_SECRET: 'test-secret', ADMIN_EMAILS: allowlist });
  const account = (data, subject) => Object.defineProperty(data, 'googleAuthId', { value: subject, writable: true });
  let current = role ? account({ id: 49, email: storedEmail, role }, authId) : null;
  let provisioned = 0;
  let ordinaryRegistrations = 0;
  const users = {
    async findById() { return disabled ? null : current; },
    async findByAuthId(id) {
      if (disabled) throw new AuthError(403, 'ACCOUNT_DISABLED', 'Disabled');
      return current?.googleAuthId === id ? current : null;
    },
    async provisionAdmin(identity) {
      if (provisionError) throw provisionError;
      if (disabled) throw new AuthError(403, 'ACCOUNT_DISABLED', 'Disabled');
      provisioned++;
      current = account({ id: current?.id || 50, role: 'admin', email: identity.email }, identity.authId);
      return current;
    },
    async register() { ordinaryRegistrations++; throw new Error('Unexpected ordinary registration'); },
  };
  const passport = createPassport(config, users);
  const google = passport._strategy('google');
  let profile = sample(email);
  profile._json.email_verified = verified;
  google._oauth2.getOAuthAccessToken = (_code, params, done) => {
    assert.ok(params.code_verifier);
    done(null, 'test-token');
  };
  google.userProfile = (_token, done) => done(null, profile);
  const store = new session.MemoryStore();
  const server = createApp({ config, users, passport, store }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
    store.clear();
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  let cookie;
  async function request(path, options = {}) {
    const response = await fetch(base + path, { redirect: 'manual', ...options,
      headers: { ...(cookie ? { Cookie: cookie } : {}), ...options.headers } });
    if (response.headers.get('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
    if (path.startsWith('/api/admin')) assert.equal(response.headers.get('cache-control'), 'no-store');
    return response;
  }
  async function signIn() {
    const start = await request('/api/auth/google');
    const state = new URL(start.headers.get('location')).searchParams.get('state');
    return request(`/api/auth/google/callback?code=test-code&state=${state}`);
  }
  function editSession(edit) {
    for (const key of Object.keys(store.sessions)) {
      const data = JSON.parse(store.sessions[key]);
      edit(data);
      store.sessions[key] = JSON.stringify(data);
    }
  }
  return { request, signIn, config, editSession, cookie: () => cookie,
    current: () => current, disable: () => { disabled = true; },
    setProfile: value => { profile = value; },
    provisioned: () => provisioned, registrations: () => ordinaryRegistrations };
}

test('admin configuration fails closed and only normalizes trim/case', () => {
  assert.equal(parseAdminEmails().size, 0);
  assert.equal(parseAdminEmails('  ').size, 0);
  assert.deepEqual([...parseAdminEmails(' Admin.One@Example.test ')], ['admin.one@example.test']);
  for (const invalid of ['*', '*@example.test', '@example.test', 'example.test', 'a@example.test,', 'a b@example.test']) {
    assert.throws(() => parseAdminEmails(invalid), /ADMIN_EMAILS/);
  }
});

test('every configured administrator enters through verified Google callback without onboarding', async t => {
  assert.equal(emails.length, 5);
  for (let index = 0; index < emails.length; index++) {
    await t.test(`configured administrator ${index + 1}`, async t => {
      const app = await fixture(t, { email: ` ${emails[index].toUpperCase()} `,
        ...(index === 0 ? { role: 'candidate' } : {}) });
      const callback = await app.signIn();
      assert.equal(callback.headers.get('location'), 'http://localhost:5173/admin');
      const me = await (await app.request('/api/auth/me')).json();
      assert.equal(me.admin, true);
      assert.equal(me.user.role, 'admin');
      assert.equal(me.onboardingRequired, false);
      assert.equal(JSON.stringify(me).includes('google:'), false);
      assert.equal(JSON.stringify(me).includes('test-token'), false);
      if (index === 0) assert.equal(me.user.id, 49);
      assert.equal(app.provisioned(), 1);
      assert.equal(app.registrations(), 0);
      assert.equal((await app.request('/api/admin/session')).status, 200);
    });
  }
});

test('guest and forged headers, URL and body never authorize admin access', async t => {
  const app = await fixture(t);
  const result = await app.request(`/api/admin/session?email=${emails[0]}&role=admin`, {
    headers: { 'X-User-Email': emails[0], 'X-User-Role': 'admin' },
  });
  assert.equal(result.status, 401);
  assert.deepEqual(Object.keys(await result.json()).sort(), ['code', 'error']);
  assert.equal((await app.request('/api/admin/session', { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: emails[0], role: 'admin' }) })).status, 401);
});

test('candidate, employer, nonlisted DB admin and nonlisted aliases receive 403', async t => {
  const [local, domain] = emails[0].split('@');
  for (const [index, email] of [`other@${domain}`, `${local}+alias@${domain}`, `${local}x@${domain}`,
    `${local.replaceAll('.', '')}x@${domain}`].entries()) {
    for (const role of ['candidate', 'employer', 'admin']) {
      await t.test(`nonlisted identity ${index + 1}, ${role}`, async t => {
        const app = await fixture(t, { email, role });
        await app.signIn();
        assert.equal((await app.request('/api/admin/session')).status, 403);
        assert.equal((await (await app.request('/api/auth/me')).json()).admin, false);
        assert.equal(app.provisioned(), 0);
      });
    }
  }
});

test('unverified Google email cannot provision or open a session', async t => {
  for (const verified of [false, 'true', undefined]) {
    const app = await fixture(t, { verified });
    if (verified === undefined) app.setProfile({ ...sample(emails[0]), _json: { sub: 'subject' } });
    assert.match((await app.signIn()).headers.get('location'), /oauth_failed/);
    assert.equal(app.provisioned(), 0);
    assert.equal((await app.request('/api/admin/session')).status, 401);
  }
});

test('next request denies role, email, subject, allowlist and account revocation', async t => {
  for (const change of ['role', 'email', 'subject', 'non-google', 'allowlist', 'disabled', 'proof', 'expiry']) {
    await t.test(change, async t => {
      const app = await fixture(t);
      await app.signIn();
      assert.equal((await app.request('/api/admin/session')).status, 200);
      if (change === 'role') app.current().role = 'candidate';
      if (change === 'email') app.current().email = 'changed@example.test';
      if (change === 'subject') app.current().googleAuthId = 'google:changed';
      if (change === 'non-google') app.current().googleAuthId = 'local:subject';
      if (change === 'allowlist') app.config.adminEmails.clear();
      if (change === 'disabled') app.disable();
      if (change === 'proof') app.editSession(data => { delete data.googleIdentity; });
      if (change === 'expiry') app.editSession(data => { data.cookie.expires = '2000-01-01T00:00:00Z'; });
      assert.equal((await app.request('/api/admin/session')).status, ['disabled', 'expiry'].includes(change) ? 401 : 403);
    });
  }
});

test('stale DB address cannot override the current verified Google address', async t => {
  const app = await fixture(t, { email: 'changed@example.test', storedEmail: emails[0], role: 'admin' });
  const callback = await app.signIn();
  assert.equal(callback.headers.get('location'), 'http://localhost:5173/');
  assert.equal((await app.request('/api/admin/session')).status, 403);
  assert.equal(app.provisioned(), 0);
});

test('empty list denies an existing admin and permits ordinary onboarding only', async t => {
  const app = await fixture(t, { role: 'admin', allowlist: '' });
  await app.signIn();
  assert.equal((await app.request('/api/admin/session')).status, 403);
  const fresh = await fixture(t, { allowlist: '' });
  await fresh.signIn();
  const pending = await (await fresh.request('/api/auth/me')).json();
  assert.equal(pending.onboardingRequired, true);
  assert.equal((await fresh.request('/api/auth/onboarding', { method: 'POST',
    headers: { Origin: 'http://localhost:5173', 'X-CSRF-Token': pending.csrfToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'admin' }) })).status, 400);
  assert.equal(fresh.registrations(), 0);
});

test('admin router enforces origin and CSRF on every mutation without fake business endpoints', async t => {
  const app = await fixture(t);
  await app.signIn();
  const me = await (await app.request('/api/auth/me')).json();
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    for (const headers of [{}, { Origin: 'http://localhost:5173' },
      { Origin: 'https://attacker.test', 'X-CSRF-Token': me.csrfToken },
      { Origin: 'http://localhost:5173', 'X-CSRF-Token': 'wrong' }]) {
      assert.equal((await app.request('/api/admin/future-operation', { method, headers })).status, 403);
    }
    assert.equal((await app.request('/api/admin/future-operation', { method,
      headers: { Origin: 'http://localhost:5173', 'X-CSRF-Token': me.csrfToken } })).status, 404);
  }
  assert.equal((await app.request('/api/admin/future-operation')).status, 404);
  assert.equal((await app.request('/api/admin/session', { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: '{' })).status, 400);
});

test('logout destroys admin proof and old cookies; admin gains no candidate/employer permission', async t => {
  const app = await fixture(t);
  await app.signIn();
  const cookie = app.cookie();
  const me = await (await app.request('/api/auth/me')).json();
  assert.equal((await app.request('/api/castings/1/applications', { method: 'POST' })).status, 403);
  assert.equal((await app.request('/api/employer/castings')).status, 403);
  assert.equal((await app.request('/api/auth/logout', { method: 'POST',
    headers: { Origin: 'http://localhost:5173', 'X-CSRF-Token': me.csrfToken } })).status, 200);
  assert.equal((await app.request('/api/admin/session', { headers: { Cookie: cookie } })).status, 401);
});

test('provision conflicts and disabled accounts leave no authenticated session', async t => {
  for (const options of [{ disabled: true }, { provisionError: new AuthError(409, 'ACCOUNT_CONFLICT', 'Conflict') }]) {
    const app = await fixture(t, options);
    assert.match((await app.signIn()).headers.get('location'), /oauth_failed/);
    assert.equal((await app.request('/api/admin/session')).status, 401);
  }
});
