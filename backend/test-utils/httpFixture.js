const assert = require('node:assert/strict');
const { once } = require('node:events');
const { createHmac, randomUUID } = require('node:crypto');
const session = require('express-session');
const { MemoryStore } = require('express-rate-limit');
const { createApp } = require('../src/app');
const { loadAuthConfig } = require('../src/auth/config');
const { createApplicationHandler } = require('../src/controllers/applicationController');
const pool = require('../src/config/db');

async function httpFixture(t, { writesEnabled = false, rateStore = new MemoryStore(), publicModel,
  applicationModel: providedApplicationModel, employerWrites = false, allowAdmin = false, appOptions = {} } = {}) {
  const changes = { APPLICATION_WRITES_ENABLED: String(writesEnabled), APPLICATION_WRITES_CONFIRMED: 'true',
    EMPLOYER_CASTING_WRITES_ENABLED: String(employerWrites), EMPLOYER_CASTING_WRITES_CONFIRMED:'true',
    PGHOST: '127.0.0.1', PGPORT: '5432', PGDATABASE: 'castme_test' };
  for (const [key, value] of Object.entries(changes)) {
    const before = process.env[key];
    process.env[key] = value;
    t.after(() => { if (before === undefined) delete process.env[key]; else process.env[key] = before; });
  }
  t.mock.method(pool, 'query', () => assert.fail('HTTP test must not query PostgreSQL'));
  t.mock.method(pool, 'connect', () => assert.fail('HTTP test must not connect to PostgreSQL'));
  const config = loadAuthConfig({ SESSION_SECRET: 'http-test-secret-with-at-least-thirty-two-characters',
    ADMIN_EMAILS:allowAdmin?'admin@example.invalid':'' });
  const users = new Map([
    [1, { id: 1, role: 'candidate' }], [2, { id: 2, role: 'candidate' }],
    [3, { id: 3, role: 'employer' }], [4, { id: 4, role: 'admin',email:'admin@example.invalid',googleAuthId:'google:test-admin' }]
  ]);
  const sessionStore = new session.MemoryStore();
  let applicationWrites = 0;
  const applicationModel = providedApplicationModel || {
    async getCandidateProfileByUserId(id) { return { id: id + 100 }; },
    async createApplicationTransaction() {
      applicationWrites++;
      return { allowed: true, application: { id: applicationWrites, status: 'SUBMITTED' } };
    }
  };
  const app = createApp({ config, store: sessionStore, users: { async findById(id) { return users.get(id); } },
    publicCastingModel: publicModel, applicationRateLimitStore: rateStore,
    applicationHandler: createApplicationHandler({ model: applicationModel, writesEnabled }), ...appOptions });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
    rateStore.shutdown?.();
    sessionStore.clear();
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  async function cookie(userId = 1) {
    const id = randomUUID();
    await new Promise((resolve, reject) => sessionStore.set(id, {
      cookie: { ...config.cookie, expires: new Date(Date.now() + 60000) },
      passport: { user: userId }, csrfToken: 'valid-test-token',
      ...(userId===4?{googleIdentity:{verified:true,authId:'google:test-admin',email:'admin@example.invalid'}}:{})
    }, error => error ? reject(error) : resolve()));
    const signature = createHmac('sha256', config.secret).update(id).digest('base64').replace(/=+$/, '');
    return `${config.cookieName}=${encodeURIComponent(`s:${id}.${signature}`)}`;
  }
  return { app, rateStore, cookie, writes: () => applicationWrites,
    request: (path, options) => fetch(base + path, options),
    post: (cookieValue, headers = {}) => fetch(base + '/api/castings/1/applications', {
      method: 'POST', headers: { Cookie: cookieValue || '', Origin: 'http://localhost:5173',
        'X-CSRF-Token': 'valid-test-token', 'Content-Type': 'application/json', ...headers }, body: '{}'
    }) };
}

module.exports = { httpFixture };
