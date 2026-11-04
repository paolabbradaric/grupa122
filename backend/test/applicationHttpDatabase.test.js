
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { randomUUID } = require('node:crypto');

const session = require('express-session');

const enabled =
  process.env.APPLICATION_HTTP_DB_TESTS === '1';

test(
  'HTTP prijava kandidata sa stvarnim lokalnim PostgreSQL-om',
  {
    skip: enabled
      ? false
      : 'Pokreni zasebni lokalni HTTP DB test.'
  },
  async (t) => {
    // Zaštita prije učitavanja backenda.
    assert.equal(process.env.PGHOST, '127.0.0.1');
    assert.equal(process.env.PGPORT, '5432');
    assert.equal(process.env.PGDATABASE, 'castme_test');
    assert.equal(process.env.PGSSL, 'false');
    assert.equal(process.env.APPLICATION_WRITES_ENABLED, 'true');
    assert.equal(process.env.APPLICATION_WRITES_CONFIRMED, 'true');

    const pool = require('../src/config/db');
    const { createApp } = require('../src/app');
    const { loadAuthConfig } = require('../src/auth/config');
    const { createPassport } = require('../src/auth/passport');

    const store = new session.MemoryStore();

    const ids = {};
    let server = null;

    // Čišćenje nakon testiranja.
    t.after(async () => {
      try {
        if (server) {
          await new Promise(resolve => {
            server.close(resolve);
            server.closeAllConnections();
          });
        }

        if (ids.casting) {
          await pool.query(
            'DELETE FROM applications WHERE casting_call_id = $1',
            [ids.casting]
          );

          await pool.query(
            'DELETE FROM casting_calls WHERE id = $1',
            [ids.casting]
          );
        }

        if (ids.project) {
          await pool.query(
            'DELETE FROM projects WHERE id = $1',
            [ids.project]
          );
        }

        if (ids.organisation) {
          await pool.query(
            'DELETE FROM organisations WHERE id = $1',
            [ids.organisation]
          );
        }

        if (ids.profile) {
          await pool.query(
            'DELETE FROM candidate_profiles WHERE id = $1',
            [ids.profile]
          );
        }

        for (const id of [ids.candidate, ids.employer]) {
          if (id) {
            await pool.query(
              'DELETE FROM users WHERE id = $1',
              [id]
            );
          }
        }
      } finally {
        store.clear();
        await pool.end();
      }
    });

    // Potvrđujemo stvarni server, ne samo env postavke.
    
        const connection = await pool.query(`
        SELECT current_database() AS db,
                host(inet_server_addr()) AS server
        `);


    assert.equal(connection.rows[0].db, 'castme_test');
    assert.equal(connection.rows[0].server, '127.0.0.1');

    const unique = randomUUID();

    // Testni kandidat.
    const candidateUser = await pool.query(
      `INSERT INTO users
        (auth_id, email, first_name, last_name,
         birth_date, role)
       VALUES ($1, $2, 'Test', 'Kandidat',
               '2000-01-01', 'candidate')
       RETURNING id`,
      [
        `google:${unique}`,
        `candidate-${unique}@example.test`
      ]
    );

    ids.candidate = candidateUser.rows[0].id;

    const candidateProfile = await pool.query(
      `INSERT INTO candidate_profiles (user_id)
       VALUES ($1)
       RETURNING id`,
      [ids.candidate]
    );

    ids.profile = candidateProfile.rows[0].id;

    // Testni poslodavac.
    const employerUser = await pool.query(
      `INSERT INTO users
        (auth_id, email, first_name, last_name,
         birth_date, role)
       VALUES ($1, $2, 'Test', 'Poslodavac',
               '1990-01-01', 'employer')
       RETURNING id`,
      [
        `test-employer:${unique}`,
        `employer-${unique}@example.test`
      ]
    );

    ids.employer = employerUser.rows[0].id;

    const organisation = await pool.query(
      `INSERT INTO organisations
        (company_name, reg_num, contact_email,
         location, owner_id)
       VALUES ($1, $2, $3, 'Zagreb', $4)
       RETURNING id`,
      [
        'Test produkcija',
        unique,
        `contact-${unique}@example.test`,
        ids.employer
      ]
    );

    ids.organisation = organisation.rows[0].id;

    const project = await pool.query(
      `INSERT INTO projects
        (title, project_type, org_id)
       VALUES ('HTTP test projekt', 'film', $1)
       RETURNING id`,
      [ids.organisation]
    );

    ids.project = project.rows[0].id;

    const casting = await pool.query(
      `INSERT INTO casting_calls
        (title, description, positions_count,
         max_applications, min_age, max_age,
         location, application_deadline,
         status, project_id)
       VALUES
        ('HTTP test casting', 'Testni oglas',
         1, 1, 18, 80, 'Zagreb',
         '2099-12-31', 'published', $1)
       RETURNING id`,
      [ids.project]
    );

    ids.casting = casting.rows[0].id;

    // Lažni korisnički model samo za OAuth.
    // Prijave se spremaju kroz pravi applicationModel.
    const user = {
      id: ids.candidate,
      role: 'candidate',
      email: `candidate-${unique}@example.test`
    };

    const users = {
      async findById(id) {
        return id === user.id ? user : null;
      },

      async findByAuthId(authId) {
        return authId === `google:${unique}`
          ? user
          : null;
      }
    };

    const config = loadAuthConfig({
      SESSION_SECRET:
        'test-secret-with-at-least-thirty-two-characters',
      GOOGLE_CLIENT_ID: 'test-client',
      GOOGLE_CLIENT_SECRET: 'test-google-secret'
    });

    const passport = createPassport(config, users);

    const google = passport._strategy('google');

    // Google API ne pozivamo stvarno.
    google._oauth2.getOAuthAccessToken = (
      code,
      params,
      done
    ) => {
      done(null, 'fake-access-token', 'fake-refresh-token');
    };

    google.userProfile = (token, done) => {
      done(null, {
        id: unique,
        _json: {
          sub: unique,
          email_verified: true
        },
        emails: [{
          value: user.email
        }],
        name: {
          givenName: 'Test',
          familyName: 'Kandidat'
        }
      });
    };

    // Ovdje namjerno NE zamjenjujemo applicationHandler.
    // Koristimo stvarni controller i stvarni SQL model.
    const app = createApp({
      config,
      users,
      passport,
      store
    });

    server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');

    const base =
      `http://127.0.0.1:${server.address().port}`;

    let cookie = null;

    async function request(path, options = {}) {
      const response = await fetch(base + path, {
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

    // Simulirana Google prijava.
    const start = await request('/api/auth/google');

    assert.equal(start.status, 302);

    const state = new URL(
      start.headers.get('location')
    ).searchParams.get('state');

    assert.ok(state);

    const callback = await request(
      '/api/auth/google/callback' +
      `?code=test-code&state=${encodeURIComponent(state)}`
    );

    assert.equal(callback.status, 302);

    const me = await request('/api/auth/me');
    assert.equal(me.status, 200);

    const identity = await me.json();

    assert.equal(identity.user.id, ids.candidate);
    assert.equal(identity.user.role, 'candidate');

    const path =
      `/api/castings/${ids.casting}/applications`;

    const body = JSON.stringify({
      coverLetter: 'Testna prijava preko HTTP API-ja.',
      videoUrl: 'https://example.com/video'
    });

    const validHeaders = {
      Origin: 'http://localhost:5173',
      'Content-Type': 'application/json',
      'X-CSRF-Token': identity.csrfToken
    };

    // TEST 1: Bez CSRF tokena nema prijave.
    await t.test('Odbija zahtjev bez CSRF tokena', async () => {
      const response = await request(path, {
        method: 'POST',
        headers: {
          Origin: 'http://localhost:5173',
          'Content-Type': 'application/json'
        },
        body
      });

      assert.equal(response.status, 403);
    });

    // TEST 2: Stvarno spremanje kroz HTTP.
    await t.test('Sprema prijavu i vraća HTTP 201', async () => {
      const response = await request(path, {
        method: 'POST',
        headers: validHeaders,
        body
      });

      assert.equal(response.status, 201);

      const data = await response.json();

      assert.equal(
        data.application.status,
        'SUBMITTED'
      );

      const saved = await pool.query(
        `SELECT candidate_id, casting_call_id,
                cover_letter, video_url, status
         FROM applications
         WHERE id = $1`,
        [data.application.id]
      );

      assert.equal(saved.rows.length, 1);
      assert.equal(
        saved.rows[0].candidate_id,
        ids.profile
      );
      assert.equal(
        saved.rows[0].casting_call_id,
        ids.casting
      );
      assert.equal(
        saved.rows[0].cover_letter,
        'Testna prijava preko HTTP API-ja.'
      );
      assert.equal(
        saved.rows[0].status,
        'SUBMITTED'
      );
    });

    // TEST 3: Drugi pokušaj mora biti odbijen.
    await t.test('Odbija ponovljenu prijavu', async () => {
      const response = await request(path, {
        method: 'POST',
        headers: validHeaders,
        body
      });

      assert.equal(response.status, 409);

      const data = await response.json();

      assert.match(
        data.error,
        /Već ste prijavljeni/
      );

      const count = await pool.query(
        `SELECT COUNT(*)::int AS total
         FROM applications
         WHERE casting_call_id = $1`,
        [ids.casting]
      );

      assert.equal(count.rows[0].total, 1);
    });
  }
);
