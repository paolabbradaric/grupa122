const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');

test('Vercel exports the protected Express API without connecting to PostgreSQL', async t => {
  const env = {
    NODE_ENV: 'production',
    SESSION_SECRET: 'deployment-test-secret-with-at-least-32-characters',
    FRONTEND_URL: 'https://castme.example.test',
    GOOGLE_CALLBACK_URL: 'https://castme.example.test/api/auth/google/callback',
    TRUST_PROXY_HOPS: '1',
    PGSSL: 'false',
    APPLICATION_WRITES_ENABLED: 'false',
    EMPLOYER_CASTING_WRITES_ENABLED: 'false'
  };
  for (const [key, value] of Object.entries(env)) {
    const previous = process.env[key];
    process.env[key] = value;
    t.after(() => {
      if (previous === undefined) delete process.env[key];
      else process.env[key] = previous;
    });
  }
  const pool = require('../src/config/db');
  const forbidDatabase = () => { throw new Error('Deployment smoke test must not access PostgreSQL'); };
  t.mock.method(pool, 'query', forbidDatabase);
  t.mock.method(pool, 'connect', forbidDatabase);

  const { default: app } = await import('../server.mjs');
  assert.equal(typeof app, 'function');
  assert.equal(app.get('trust proxy'), 1);
  const server = app.listen(0, '127.0.0.1');
  t.after(() => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;

  for (const path of ['/api/auth/me', '/api/admin/session']) {
    const response = await fetch(base + path);
    assert.equal(response.status, 401);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('set-cookie'), null);
    assert.equal((await response.json()).code, 'AUTH_REQUIRED');
  }
  const mutation = await fetch(base + '/api/auth/logout', { method: 'POST' });
  assert.equal(mutation.status, 403);
  assert.equal((await mutation.json()).code, 'INVALID_CSRF');
  assert.equal(pool.query.mock.callCount(), 0);
  assert.equal(pool.connect.mock.callCount(), 0);
});
