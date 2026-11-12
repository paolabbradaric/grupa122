
const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  createEmployerApplicationsModel
} = require('../src/models/employerApplicationsModel');

const {
  createEmployerApplicationsController
} = require('../src/controllers/employerApplicationsController');

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

test('poslodavac može dohvatiti prijave vlastitog oglasa', async () => {
  const queries = [];

  const database = {
    async query(sql, params) {
      queries.push({ sql, params });

      if (sql.includes('FROM casting_calls')) {
        return {
          rows: [{ id: 10, title: 'Glavna uloga', status: 'published' }]
        };
      }

      return {
        rows: [{
          id: 25,
          status: 'SUBMITTED',
          firstName: 'Ana',
          lastName: 'Horvat'
        }]
      };
    }
  };

  const model = createEmployerApplicationsModel(database);
  const result = await model.listByCasting(5, 10);

  assert.equal(result.outcome, 'success');
  assert.equal(result.applications.length, 1);
  assert.equal(result.applications[0].firstName, 'Ana');

  assert.deepEqual(queries[0].params, [10, 5]);
  assert.deepEqual(queries[1].params, [10]);
});

test('poslodavac ne može pristupiti tuđem oglasu', async () => {
  let brojUpita = 0;

  const database = {
    async query() {
      brojUpita++;
      return { rows: [] };
    }
  };

  const model = createEmployerApplicationsModel(database);
  const result = await model.listByCasting(5, 99);

  assert.equal(result.outcome, 'not_found');
  assert.equal(brojUpita, 1);
});

test('oglas bez prijava vraća prazan popis', async () => {
  let call = 0;

  const database = {
    async query() {
      call++;

      if (call === 1) {
        return {
          rows: [{ id: 10, title: 'Glavna uloga', status: 'published' }]
        };
      }

      return { rows: [] };
    }
  };

  const result = await createEmployerApplicationsModel(database)
    .listByCasting(5, 10);

  assert.equal(result.outcome, 'success');
  assert.deepEqual(result.applications, []);
});

test('controller odbija neispravan ID oglasa', async () => {
  const controller = createEmployerApplicationsController({
    model: {
      async listByCasting() {
        throw new Error('Model se ne smije pozvati');
      }
    }
  });

  const res = response();

  await controller.list({
    params: { id: 'abc' },
    user: { id: 5 }
  }, res, assert.fail);

  assert.equal(res.statusCode, 400);
});

test('controller vraća 404 za tuđi ili nepostojeći oglas', async () => {
  const controller = createEmployerApplicationsController({
    model: {
      async listByCasting() {
        return { outcome: 'not_found' };
      }
    }
  });

  const res = response();

  await controller.list({
    params: { id: '99' },
    user: { id: 5 }
  }, res, assert.fail);

  assert.equal(res.statusCode, 404);
});

test('controller uspješno vraća prijave', async () => {
  const controller = createEmployerApplicationsController({
    model: {
      async listByCasting() {
        return {
          outcome: 'success',
          casting: { id: 10, title: 'Glavna uloga' },
          applications: [{ id: 25, status: 'SUBMITTED' }]
        };
      }
    }
  });

  const res = response();

  await controller.list({
    params: { id: '10' },
    user: { id: 5 }
  }, res, assert.fail);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.applications.length, 1);
  assert.equal(res.body.applications[0].status, 'SUBMITTED');
});
