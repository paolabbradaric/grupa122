
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const os = require('node:os');
const { Pool } = require('pg');

const {
  createApplicationTransaction
} = require('../src/models/applicationModel');

// Ovaj test se pokreće samo na izričit zahtjev.
const enabled = process.env.APPLICATION_DATABASE_TESTS === '1';

test(
  'Lokalni PostgreSQL - integracija prijava kandidata',
  {
    skip: enabled
      ? false
      : 'Pokreni s APPLICATION_DATABASE_TESTS=1.'
  },
  async (t) => {
    // Namjerno NE koristimo backend/.env.
    // Veza je ograničena na lokalni PostgreSQL.
    const localPool = new Pool({
      host: '127.0.0.1',
      port: 5432,
      database: 'castme_test',
      user: os.userInfo().username,
      max: 5,
      connectionTimeoutMillis: 5000
    });

    const ids = {
      users: [],
      profiles: [],
      organisations: [],
      projects: [],
      castings: []
    };

    // Čišćenje testnih podataka po završetku.
    t.after(async () => {
      try {
        if (ids.castings.length > 0) {
          await localPool.query(
            `DELETE FROM applications
             WHERE casting_call_id = ANY($1::int[])`,
            [ids.castings]
          );

          await localPool.query(
            `DELETE FROM casting_calls
             WHERE id = ANY($1::int[])`,
            [ids.castings]
          );
        }

        if (ids.projects.length > 0) {
          await localPool.query(
            `DELETE FROM projects
             WHERE id = ANY($1::int[])`,
            [ids.projects]
          );
        }

        if (ids.organisations.length > 0) {
          await localPool.query(
            `DELETE FROM organisations
             WHERE id = ANY($1::int[])`,
            [ids.organisations]
          );
        }

        if (ids.profiles.length > 0) {
          await localPool.query(
            `DELETE FROM candidate_profiles
             WHERE id = ANY($1::int[])`,
            [ids.profiles]
          );
        }

        if (ids.users.length > 0) {
          await localPool.query(
            `DELETE FROM users
             WHERE id = ANY($1::int[])`,
            [ids.users]
          );
        }
      } finally {
        await localPool.end();
      }
    });

    // Dodatna sigurnosna provjera identiteta baze.
    const connection = await localPool.query(
      `SELECT current_database() AS database_name,
              current_user AS user_name`
    );

    assert.equal(
      connection.rows[0].database_name,
      'castme_test'
    );

    assert.equal(
      connection.rows[0].user_name,
      os.userInfo().username
    );

    const prefix = randomUUID();

    // Kreiranje testnog korisnika.
    async function createUser(role, number) {
      const result = await localPool.query(
        `INSERT INTO users
          (auth_id, email, first_name, last_name,
           birth_date, role)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [
          `test:${prefix}:${number}`,
          `test-${prefix}-${number}@example.test`,
          'Test',
          'Korisnik',
          '2000-01-01',
          role
        ]
      );

      const id = result.rows[0].id;
      ids.users.push(id);
      return id;
    }

    // Kreiranje testnog profila kandidata.
    async function createCandidate(number) {
      const userId = await createUser('candidate', number);

      const result = await localPool.query(
        `INSERT INTO candidate_profiles (user_id)
         VALUES ($1)
         RETURNING id`,
        [userId]
      );

      const id = result.rows[0].id;
      ids.profiles.push(id);
      return id;
    }

    const candidate1 = await createCandidate(1);
    const candidate2 = await createCandidate(2);
    const employerId = await createUser('employer', 3);

    // Testna organizacija.
    const organisationResult = await localPool.query(
      `INSERT INTO organisations
        (company_name, reg_num, contact_email,
         location, owner_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [
        'Test produkcija',
        `test-${prefix}`,
        `production-${prefix}@example.test`,
        'Zagreb',
        employerId
      ]
    );

    const organisationId = organisationResult.rows[0].id;
    ids.organisations.push(organisationId);

    // Svaki casting treba zaseban projekt
    // jer schema.sql ima UNIQUE(project_id).
    async function createCasting({
      status = 'published',
      maxApplications = 100,
      expired = false
    } = {}) {
      const project = await localPool.query(
        `INSERT INTO projects
          (title, project_type, org_id)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [
          `Test projekt ${randomUUID()}`,
          'film',
          organisationId
        ]
      );

      const projectId = project.rows[0].id;
      ids.projects.push(projectId);

      const deadline = expired
        ? '2020-01-01T00:00:00Z'
        : '2099-12-31T23:59:59Z';

      const result = await localPool.query(
        `INSERT INTO casting_calls
          (title, description, positions_count,
           max_applications, min_age, max_age,
           location, application_deadline,
           status, project_id)
         VALUES
          ($1, $2, $3, $4, $5,
           $6, $7, $8, $9, $10)
         RETURNING id`,
        [
          'Test casting',
          'Integracijski test prijave.',
          1,
          maxApplications,
          18,
          80,
          'Zagreb',
          deadline,
          status,
          projectId
        ]
      );

      const castingId = result.rows[0].id;
      ids.castings.push(castingId);
      return castingId;
    }

    async function applicationCount(castingId) {
      const result = await localPool.query(
        `SELECT COUNT(*)::int AS total
         FROM applications
         WHERE casting_call_id = $1`,
        [castingId]
      );

      return result.rows[0].total;
    }

    // TEST 1
    await t.test('Odbija nepostojeći casting', async () => {
      const result = await createApplicationTransaction(
        candidate1,
        -1,
        null,
        null,
        localPool
      );

      assert.equal(result.allowed, false);
      assert.equal(
        result.message,
        'Casting oglas ne postoji.'
      );
    });

    // TEST 2
    await t.test('Odbija neobjavljeni casting', async () => {
      const castingId = await createCasting({
        status: 'draft'
      });

      const result = await createApplicationTransaction(
        candidate1, castingId, null, null, localPool
      );

      assert.equal(result.allowed, false);
      assert.equal(await applicationCount(castingId), 0);
    });

    // TEST 3
    await t.test('Odbija casting s isteklim rokom', async () => {
      const castingId = await createCasting({
        expired: true
      });

      const result = await createApplicationTransaction(
        candidate1, castingId, null, null, localPool
      );

      assert.equal(result.allowed, false);
      assert.equal(await applicationCount(castingId), 0);
    });

    // TEST 4
    await t.test('Uspješno sprema prijavu u PostgreSQL', async () => {
      const castingId = await createCasting();

      const result = await createApplicationTransaction(
        candidate1,
        castingId,
        'Moja testna prijava',
        'https://example.com/video',
        localPool
      );

      assert.equal(result.allowed, true);
      assert.equal(result.application.status, 'SUBMITTED');

      const saved = await localPool.query(
        `SELECT candidate_id, cover_letter, video_url
         FROM applications
         WHERE id = $1`,
        [result.application.id]
      );

      assert.equal(saved.rows.length, 1);
      assert.equal(saved.rows[0].candidate_id, candidate1);
      assert.equal(
        saved.rows[0].cover_letter,
        'Moja testna prijava'
      );
      assert.equal(
        saved.rows[0].video_url,
        'https://example.com/video'
      );
    });

    // TEST 5
    await t.test('Odbija duplu prijavu', async () => {
      const castingId = await createCasting();

      const first = await createApplicationTransaction(
        candidate1, castingId, null, null, localPool
      );

      const second = await createApplicationTransaction(
        candidate1, castingId, null, null, localPool
      );

      assert.equal(first.allowed, true);
      assert.equal(second.allowed, false);
      assert.equal(await applicationCount(castingId), 1);
    });

    // TEST 6
    await t.test('Poštuje maksimalan broj prijava', async () => {
      const castingId = await createCasting({
        maxApplications: 1
      });

      const first = await createApplicationTransaction(
        candidate1, castingId, null, null, localPool
      );

      const second = await createApplicationTransaction(
        candidate2, castingId, null, null, localPool
      );

      assert.equal(first.allowed, true);
      assert.equal(second.allowed, false);
      assert.equal(await applicationCount(castingId), 1);
    });

    // TEST 7
    await t.test('Dvije istovremene prijave ne prelaze limit', async () => {
      const castingId = await createCasting({
        maxApplications: 1
      });

      const results = await Promise.all([
        createApplicationTransaction(
          candidate1, castingId, null, null, localPool
        ),
        createApplicationTransaction(
          candidate2, castingId, null, null, localPool
        )
      ]);

      const successful = results.filter(r => r.allowed);
      const rejected = results.filter(r => !r.allowed);

      assert.equal(successful.length, 1);
      assert.equal(rejected.length, 1);
      assert.equal(await applicationCount(castingId), 1);
    });

    // TEST 8
    await t.test('SQL greška poništava transakciju', async () => {
      const castingId = await createCasting();

      // Nepostojeći profil izaziva FOREIGN KEY grešku.
      await assert.rejects(
        createApplicationTransaction(
          2147483647,
          castingId,
          null,
          null,
          localPool
        ),
        error => error.code === '23503'
      );

      assert.equal(await applicationCount(castingId), 0);

      // Nakon ROLLBACK-a valjana prijava mora uspjeti.
      const valid = await createApplicationTransaction(
        candidate1, castingId, null, null, localPool
      );

      assert.equal(valid.allowed, true);
      assert.equal(await applicationCount(castingId), 1);
    });
  }
);
