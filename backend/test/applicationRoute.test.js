
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');

const session = require('express-session');

const { createApp } = require('../src/app');
const { loadAuthConfig } = require('../src/auth/config');
const { createPassport } = require('../src/auth/passport');

const config = loadAuthConfig({
  SESSION_SECRET: 'test-secret-with-at-least-thirty-two-characters',
  GOOGLE_CLIENT_ID: 'test-client',
  GOOGLE_CLIENT_SECRET: 'test-google-secret'
});

const path = '/api/castings/1/applications';
const validOrigin = 'http://localhost:5173';

const googleProfile = {
  id: 'test-google-subject',
  _json: {
    sub: 'test-google-subject',
    email_verified: true
  },
  emails: [{ value: 'test@example.test' }],
  name: {
    givenName: 'Test',
    familyName: 'Kandidat'
  }
};

async function createFixture(t, role = 'candidate') {
  const user = {
    id: 10,
    email: 'test@example.test',
    role
  };

  const users = {
    async findById(id) {
      return id === user.id ? user : null;
    },

    async findByAuthId(authId) {
      return authId === 'google:test-google-subject'
        ? user
        : null;
    }
  };

  const passport = createPassport(config, users);
  const google = passport._strategy('google');

  // Zamjenjujemo vanjsku Google komunikaciju.
  google._oauth2.getOAuthAccessToken = (
    code,
    params,
    done
  ) => {
    done(null, 'fake-access-token', 'fake-refresh-token');
  };

  google.userProfile = (token, done) => {
    done(null, googleProfile);
  };

  const store = new session.MemoryStore();

  let controllerCalls = 0;
  let lastRequest = null;

  const applicationHandler = (req, res) => {
    controllerCalls++;
    lastRequest = {
      user: req.user,
      castingId: req.params.id,
      body: req.body
    };

    return res.status(201).json({
      message: 'Testna prijava obrađena.',
      application: {
        id: 99,
        status: 'SUBMITTED'
      }
    });
  };

  const app = createApp({
    config,
    users,
    passport,
    store,
    applicationHandler
  });

  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');

  t.after(async () => {
    await new Promise(resolve => {
      server.close(resolve);
      server.closeAllConnections();
    });

    store.clear();
  });

  const base = `http://127.0.0.1:${server.address().port}`;

  let cookie = null;
  let csrfToken = null;

  async function request(url, options = {}) {
    const response = await fetch(base + url, {
      redirect: 'manual',
      ...options,
      headers: {
        ...(cookie ? { Cookie: cookie } : {}),
        ...options.headers
      }
    });

    const setCookie = response.headers.get('set-cookie');

    if (setCookie) {
      cookie = setCookie.split(';')[0];
    }

    return response;
  }

  async function signIn() {
    const start = await request('/api/auth/google');

    assert.equal(start.status, 302);

    const redirectUrl = new URL(
      start.headers.get('location')
    );

    const state = redirectUrl.searchParams.get('state');

    assert.ok(state);

    const callback = await request(
      '/api/auth/google/callback' +
      `?code=test-code&state=${encodeURIComponent(state)}`
    );

    assert.equal(callback.status, 302);

    const me = await request('/api/auth/me');

    assert.equal(me.status, 200);

    const data = await me.json();

    csrfToken = data.csrfToken;

    assert.equal(data.user.role, role);
    assert.ok(csrfToken);

    return data;
  }

  async function postApplication({
    origin = validOrigin,
    token = csrfToken,
    body = {}
  } = {}) {
    const headers = {
      'Content-Type': 'application/json'
    };

    if (origin !== null) {
      headers.Origin = origin;
    }

    if (token !== null) {
      headers['X-CSRF-Token'] = token;
    }

    return request(path, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });
  }

  return {
    request,
    signIn,
    postApplication,
    getControllerCalls: () => controllerCalls,
    getLastRequest: () => lastRequest,
    getCsrfToken: () => csrfToken
  };
}

// TEST 1
test('POST ruta odbija neprijavljenog korisnika', async t => {
  const fixture = await createFixture(t);

  const response = await fixture.postApplication({
    token: 'invalid'
  });

  assert.equal(response.status, 401);

  const data = await response.json();

  assert.equal(data.code, 'AUTH_REQUIRED');
  assert.equal(fixture.getControllerCalls(), 0);
});

// TEST 2
test('Poslodavac ne može poslati prijavu', async t => {
  const fixture = await createFixture(t, 'employer');

  await fixture.signIn();

  const response = await fixture.postApplication();

  assert.equal(response.status, 403);

  const data = await response.json();

  assert.equal(data.code, 'FORBIDDEN');
  assert.equal(fixture.getControllerCalls(), 0);
});

// TEST 3
test('Kandidat bez CSRF tokena dobiva 403', async t => {
  const fixture = await createFixture(t);

  await fixture.signIn();

  const response = await fixture.postApplication({
    token: null
  });

  assert.equal(response.status, 403);

  const data = await response.json();

  assert.equal(data.code, 'INVALID_CSRF');
  assert.equal(fixture.getControllerCalls(), 0);
});

// TEST 4
test('Kandidat s pogrešnim CSRF tokenom dobiva 403', async t => {
  const fixture = await createFixture(t);

  await fixture.signIn();

  const response = await fixture.postApplication({
    token: 'wrong-token'
  });

  assert.equal(response.status, 403);
  assert.equal(fixture.getControllerCalls(), 0);
});

// TEST 5
test('Zahtjev s nedopuštenog Origina dobiva 403', async t => {
  const fixture = await createFixture(t);

  await fixture.signIn();

  const response = await fixture.postApplication({
    origin: 'https://attacker.example'
  });

  assert.equal(response.status, 403);
  assert.equal(fixture.getControllerCalls(), 0);
});

// TEST 6
test('Zahtjev bez Origina dobiva 403', async t => {
  const fixture = await createFixture(t);

  await fixture.signIn();

  const response = await fixture.postApplication({
    origin: null
  });

  assert.equal(response.status, 403);
  assert.equal(fixture.getControllerCalls(), 0);
});

// TEST 7
test('Prijavljeni kandidat s valjanim CSRF tokenom prolazi', async t => {
  const fixture = await createFixture(t);

  await fixture.signIn();

  const response = await fixture.postApplication({
    body: {
      coverLetter: 'Želim sudjelovati.',
      videoUrl: 'https://example.com/video'
    }
  });

  assert.equal(response.status, 201);
  assert.equal(fixture.getControllerCalls(), 1);

  const data = await response.json();

  assert.equal(data.application.status, 'SUBMITTED');

  const received = fixture.getLastRequest();

  assert.equal(received.user.id, 10);
  assert.equal(received.user.role, 'candidate');
  assert.equal(received.castingId, '1');
  assert.equal(
    received.body.coverLetter,
    'Želim sudjelovati.'
  );
});

// TEST 8
test('Neispravan JSON vraća 400 prije controllera', async t => {
  const fixture = await createFixture(t);

  await fixture.signIn();

  const response = await fixture.request(path, {
    method: 'POST',
    headers: {
      Origin: validOrigin,
      'Content-Type': 'application/json',
      'X-CSRF-Token': fixture.getCsrfToken()
    },
    body: '{neispravan-json'
  });

  assert.equal(response.status, 400);
  assert.equal(fixture.getControllerCalls(), 0);
});

// TEST 9
test('Prevelik JSON zahtjev vraća 413', async t => {
  const fixture = await createFixture(t);

  await fixture.signIn();

  const response = await fixture.request(path, {
    method: 'POST',
    headers: {
      Origin: validOrigin,
      'Content-Type': 'application/json',
      'X-CSRF-Token': fixture.getCsrfToken()
    },
    body: JSON.stringify({
      coverLetter: 'a'.repeat(20000)
    })
  });

  assert.equal(response.status, 413);
  assert.equal(fixture.getControllerCalls(), 0);
});
