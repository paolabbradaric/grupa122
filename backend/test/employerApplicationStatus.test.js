
const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  createEmployerApplicationStatusModel,
  allowedTransitions
} = require('../src/models/employerApplicationStatusModel');

const {
  createEmployerApplicationStatusController
} = require('../src/controllers/employerApplicationStatusController');

function mockDatabase(casting, application) {
  const queries = [];

  const client = {
    async query(sql, params) {
      queries.push({ sql, params });

      if (sql.includes('FROM casting_calls')) {
        return { rows: casting ? [casting] : [] };
      }

      if (sql.includes('FROM applications')) {
        return { rows: application ? [application] : [] };
      }

      return { rows: [] };
    },
    release() {}
  };

  return {
    queries,
    database: {
      async connect() {
        return client;
      }
    }
  };
}

function response() {
  return {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    }
  };
}

test('dopušteni prijelazi statusa su ispravno definirani', () => {
  assert.deepEqual(allowedTransitions.SUBMITTED, [
    'UNDER_REVIEW', 'REJECTED'
  ]);

  assert.deepEqual(allowedTransitions.UNDER_REVIEW, [
    'SHORTLISTED', 'REJECTED'
  ]);

  assert.deepEqual(allowedTransitions.SHORTLISTED, [
    'INVITED', 'REJECTED'
  ]);

  assert.deepEqual(allowedTransitions.INVITED, [
    'AUDITIONED', 'REJECTED'
  ]);
});

test('poslodavac može promijeniti status prijave', async () => {
  const { database, queries } = mockDatabase(
    { id: 10, status: 'published' },
    { id: 25, status: 'SUBMITTED' }
  );

  const result = await createEmployerApplicationStatusModel(database)
    .changeStatus(5, 10, 25, 'UNDER_REVIEW');

  assert.equal(result.outcome, 'updated');
  assert.equal(result.newStatus, 'UNDER_REVIEW');

  assert.ok(queries.some(q => q.sql.includes('UPDATE applications')));
  assert.ok(queries.some(q => q.sql.includes('INSERT INTO application_status_history')));
  assert.ok(queries.some(q => q.sql === 'COMMIT'));

  assert.deepEqual(
    queries.find(q => q.sql.includes('FROM casting_calls')).params,
    [10, 5]
  );
});

test('tuđi oglas ne dopušta promjenu statusa', async () => {
  const { database, queries } = mockDatabase(
    null,
    { id: 25, status: 'SUBMITTED' }
  );

  const result = await createEmployerApplicationStatusModel(database)
    .changeStatus(5, 99, 25, 'UNDER_REVIEW');

  assert.equal(result.outcome, 'not_found');
  assert.ok(queries.some(q => q.sql === 'ROLLBACK'));
  assert.ok(!queries.some(q => q.sql.includes('UPDATE applications')));
});

test('nedopušten prijelaz statusa je blokiran', async () => {
  const { database, queries } = mockDatabase(
    { id: 10, status: 'published' },
    { id: 25, status: 'SUBMITTED' }
  );

  const result = await createEmployerApplicationStatusModel(database)
    .changeStatus(5, 10, 25, 'AUDITIONED');

  assert.equal(result.outcome, 'invalid_transition');
  assert.ok(!queries.some(q => q.sql.includes('UPDATE applications')));
});

test('odbijanje kandidata zahtijeva razlog', async () => {
  const { database } = mockDatabase(
    { id: 10, status: 'published' },
    { id: 25, status: 'SHORTLISTED' }
  );

  const result = await createEmployerApplicationStatusModel(database)
    .changeStatus(5, 10, 25, 'REJECTED', '  ');

  assert.equal(result.outcome, 'reason_required');
});

test('odbijanje kandidata sprema razlog', async () => {
  const { database, queries } = mockDatabase(
    { id: 10, status: 'published' },
    { id: 25, status: 'SHORTLISTED' }
  );

  const result = await createEmployerApplicationStatusModel(database)
    .changeStatus(5, 10, 25, 'REJECTED', 'Ne odgovara ulozi.');

  assert.equal(result.outcome, 'updated');

  const update = queries.find(q => q.sql.includes('UPDATE applications'));
  assert.equal(update.params[0], 'REJECTED');
  assert.equal(update.params[1], 'Ne odgovara ulozi.');
});

test('controller odbija neispravan ID', async () => {
  const controller = createEmployerApplicationStatusController({
    model: {}
  });

  const res = response();

  await controller.changeStatus({
    params: { id: 'abc', applicationId: '25' },
    body: { status: 'UNDER_REVIEW' },
    user: { id: 5 }
  }, res, assert.fail);

  assert.equal(res.statusCode, 400);
});

test('controller odbija nepoznati status', async () => {
  const controller = createEmployerApplicationStatusController({
    model: {}
  });

  const res = response();

  await controller.changeStatus({
    params: { id: '10', applicationId: '25' },
    body: { status: 'SELECTED' },
    user: { id: 5 }
  }, res, assert.fail);

  assert.equal(res.statusCode, 400);
});

test('controller vraća 404 za nepostojeći oglas', async () => {
  
const controller = createEmployerApplicationStatusController({
  writesEnabled: true,
  model: {
    async changeStatus() {
      return { outcome: 'not_found' };
    }
  }
});


  const res = response();

  await controller.changeStatus({
    params: { id: '10', applicationId: '25' },
    body: { status: 'UNDER_REVIEW' },
    user: { id: 5 }
  }, res, assert.fail);

  assert.equal(res.statusCode, 404);
});


test('controller blokira upise kada nisu omogućeni', async () => {
  const controller = createEmployerApplicationStatusController({
    writesEnabled: false,
    model: {
      async changeStatus() {
        throw new Error('Model se ne smije pozvati');
      }
    }
  });

  const res = response();

  await controller.changeStatus({
    params: { id: '10', applicationId: '25' },
    body: { status: 'UNDER_REVIEW' },
    user: { id: 5 }
  }, res, assert.fail);

  assert.equal(res.statusCode, 503);
});

