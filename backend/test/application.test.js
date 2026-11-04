
const test = require('node:test');
const assert = require('node:assert/strict');

const applicationModel = require('../src/models/applicationModel');

// TEST 1
test('Prijava se odbija ako casting ne postoji', () => {
  const result = applicationModel.canApplyToCasting(null);

  assert.equal(result.allowed, false);
  assert.equal(result.message, 'Casting oglas ne postoji.');
});

// TEST 2
test('Prijava se odbija ako casting nije objavljen', () => {
  const result = applicationModel.canApplyToCasting({
    status: 'draft',
    application_deadline: '2099-12-31'
  });

  assert.equal(result.allowed, false);
});

// TEST 3
test('Prijava se odbija ako je rok istekao', () => {
  const result = applicationModel.canApplyToCasting({
    status: 'published',
    application_deadline: '2020-01-01'
  });

  assert.equal(result.allowed, false);
});

// TEST 4
test('Prijava je dopuštena ako je casting otvoren', () => {
  const result = applicationModel.canApplyToCasting({
    status: 'published',
    application_deadline: '2099-12-31'
  });

  assert.equal(result.allowed, true);
});

// Pomoćna funkcija za simuliranje PostgreSQL baze
function createFakePool(options = {}) {
  const queries = [];
  let released = false;

  const fakeClient = {
    async query(sql) {
      queries.push(sql);

      if (sql.includes('FROM casting_calls')) {
        return {
          rows: options.castingExists === false
            ? []
            : [{
                id: 1,
                status: 'published',
                application_deadline: '2099-12-31',
                max_applications: options.maxApplications ?? 100
              }]
        };
      }

      // Regex prepoznaje i SQL upite s više razmaka i redaka.
      if (/FROM\s+applications\b/i.test(sql) &&
          /SELECT\s+id\b/i.test(sql)) {
        return {
          rows: options.alreadyApplied ? [{ id: 10 }] : []
        };
      }

      if (/COUNT\(\*\)/i.test(sql)) {
        return {
          rows: [{
            total: options.applicationCount ?? 0
          }]
        };
      }

      if (/INSERT\s+INTO\s+applications/i.test(sql)) {
        return {
          rows: [{
            id: 20,
            candidate_id: 1,
            casting_call_id: 1,
            status: 'SUBMITTED',
            submitted_at: new Date().toISOString()
          }]
        };
      }

      return { rows: [] };
    },

    release() {
      released = true;
    }
  };

  return {
    pool: {
      async connect() {
        return fakeClient;
      }
    },
    queries,
    wasReleased: () => released
  };
}

// TEST 5
test('Transakcija radi ROLLBACK ako casting ne postoji', async () => {
  const fake = createFakePool({
    castingExists: false
  });

  const result = await applicationModel.createApplicationTransaction(
    1, 999999, null, null, fake.pool
  );

  assert.equal(result.allowed, false);
  assert.equal(result.message, 'Casting oglas ne postoji.');
  assert.ok(fake.queries.includes('BEGIN'));
  assert.ok(fake.queries.includes('ROLLBACK'));
  assert.ok(!fake.queries.some(sql => /INSERT\s+INTO\s+applications/i.test(sql)));
  assert.equal(fake.wasReleased(), true);
});

// TEST 6
test('Transakcija odbija duplu prijavu', async () => {
  const fake = createFakePool({
    alreadyApplied: true,
    applicationCount: 5,
    maxApplications: 100
  });

  const result = await applicationModel.createApplicationTransaction(
    1, 1, null, null, fake.pool
  );

  assert.equal(result.allowed, false);
  assert.equal(result.message, 'Već ste prijavljeni na ovaj casting.');
  assert.ok(fake.queries.includes('ROLLBACK'));
  assert.ok(!fake.queries.some(sql => /INSERT\s+INTO\s+applications/i.test(sql)));
  assert.equal(fake.wasReleased(), true);
});

// TEST 7
test('Transakcija odbija prijavu kada je limit dosegnut', async () => {
  const fake = createFakePool({
    alreadyApplied: false,
    applicationCount: 100,
    maxApplications: 100
  });

  const result = await applicationModel.createApplicationTransaction(
    1, 1, null, null, fake.pool
  );

  assert.equal(result.allowed, false);
  assert.equal(result.message, 'Dosegnut je maksimalan broj prijava.');
  assert.ok(fake.queries.includes('ROLLBACK'));
  assert.ok(!fake.queries.some(sql => /INSERT\s+INTO\s+applications/i.test(sql)));
  assert.equal(fake.wasReleased(), true);

});


test('Transakcija uspješno sprema prijavu i radi COMMIT', async () => {
  const fake = createFakePool({
    alreadyApplied: false,
    applicationCount: 5,
    maxApplications: 100
  });

  const result = await applicationModel.createApplicationTransaction(
    1,
    1,
    'Želim sudjelovati u castingu.',
    'https://example.com/video',
    fake.pool
  );

  assert.equal(result.allowed, true);
  assert.equal(result.application.id, 20);
  assert.equal(result.application.status, 'SUBMITTED');

  // Provjeravamo je li izvršen INSERT.
  const insertIndex = fake.queries.findIndex(sql =>
    /INSERT\s+INTO\s+applications/i.test(sql)
  );

  assert.ok(insertIndex !== -1);

  // COMMIT mora doći nakon INSERT-a.
  const commitIndex = fake.queries.indexOf('COMMIT');

  assert.ok(commitIndex > insertIndex);

  // Ne smije se izvršiti ROLLBACK.
  assert.ok(!fake.queries.includes('ROLLBACK'));

  // Veza mora biti oslobođena.
  assert.equal(fake.wasReleased(), true);
});

test('Transakcija radi ROLLBACK ako INSERT ne uspije', async () => {
  const queries = [];
  let released = false;

  const fakePool = {
    async connect() {
      return {
        async query(sql) {
          queries.push(sql);

          if (sql.includes('FROM casting_calls')) {
            return {
              rows: [{
                id: 1,
                status: 'published',
                application_deadline: '2099-12-31',
                max_applications: 100
              }]
            };
          }

          if (/SELECT\s+id\s+FROM\s+applications/i.test(sql)) {
            return { rows: [] };
          }

          if (/COUNT\(\*\)/i.test(sql)) {
            return { rows: [{ total: 0 }] };
          }

          if (/INSERT\s+INTO\s+applications/i.test(sql)) {
            throw new Error('Simulirana SQL greška');
          }

          return { rows: [] };
        },

        release() {
          released = true;
        }
      };
    }
  };

  await assert.rejects(
    applicationModel.createApplicationTransaction(
      1, 1, null, null, fakePool
    ),
    /Simulirana SQL greška/
  );

  assert.ok(queries.includes('ROLLBACK'));
  assert.ok(!queries.includes('COMMIT'));
  assert.equal(released, true);
});


test('Transakcija obrađuje PostgreSQL grešku za duplu prijavu', async () => {
  const queries = [];
  let released = false;

  const fakePool = {
    async connect() {
      return {
        async query(sql) {
          queries.push(sql);

          if (sql.includes('FROM casting_calls')) {
            return {
              rows: [{
                id: 1,
                status: 'published',
                application_deadline: '2099-12-31',
                max_applications: 100
              }]
            };
          }

          if (/SELECT\s+id\s+FROM\s+applications/i.test(sql)) {
            return { rows: [] };
          }

          if (/COUNT\(\*\)/i.test(sql)) {
            return { rows: [{ total: 0 }] };
          }

          if (/INSERT\s+INTO\s+applications/i.test(sql)) {
            const error = new Error('Duplicate application');
            error.code = '23505';
            error.constraint = 'application_unique';
            throw error;
          }

          return { rows: [] };
        },

        release() {
          released = true;
        }
      };
    }
  };

  const result = await applicationModel.createApplicationTransaction(
    1, 1, null, null, fakePool
  );

  assert.equal(result.allowed, false);
  assert.equal(result.message, 'Već ste prijavljeni na ovaj casting.');
  assert.ok(queries.includes('ROLLBACK'));
  assert.ok(!queries.includes('COMMIT'));
  assert.equal(released, true);
});


