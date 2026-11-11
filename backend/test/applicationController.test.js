
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  validateApplicationData,
  createApplicationHandler,
  createApplication
} = require('../src/controllers/applicationController');

// Lažni HTTP zahtjev
function fakeRequest(overrides = {}) {
  return {
    params: { id: '1' },
    user: { id: 10, role: 'candidate' },
    body: {
      coverLetter: 'Želim sudjelovati u castingu.',
      videoUrl: 'https://example.com/video'
    },
    ...overrides
  };
}

// Lažni HTTP odgovor
function fakeResponse() {
  return {
    statusCode: 200,
    body: null,

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

// Lažni model - ne koristi Supabase
function fakeModel(options = {}) {
  const calls = {
    profile: [],
    transaction: []
  };

  const model = {
    async getCandidateProfileByUserId(userId) {
      calls.profile.push(userId);

      if (options.profileError) {
        throw new Error('Simulirana greška baze');
      }

      return options.profile === undefined
        ? { id: 20 }
        : options.profile;
    },

    async createApplicationTransaction(...args) {
      calls.transaction.push(args);

      if (options.transactionError) {
        throw new Error('Simulirana SQL greška');
      }

      return options.result ?? {
        allowed: true,
        application: {
          id: 50,
          candidate_id: 20,
          casting_call_id: 1,
          status: 'SUBMITTED'
        }
      };
    }
  };

  return { model, calls };
}

// TEST 1
test('Odbija neispravno tijelo zahtjeva', () => {
  assert.equal(
    validateApplicationData(null),
    'Neispravni podaci prijave.'
  );

  assert.equal(
    validateApplicationData([]),
    'Neispravni podaci prijave.'
  );
});

// TEST 2
test('Odbija motivacijsko pismo dulje od 5000 znakova', () => {
  const error = validateApplicationData({
    coverLetter: 'a'.repeat(5001)
  });

  assert.match(error, /5000 znakova/);
});

// TEST 3
test('Prihvaća motivacijsko pismo od 5000 znakova', () => {
  assert.equal(
    validateApplicationData({
      coverLetter: 'a'.repeat(5000)
    }),
    null
  );
});

// TEST 4
test('Odbija video poveznicu dulju od 500 znakova', () => {
  const error = validateApplicationData({
    videoUrl: 'https://example.com/' + 'a'.repeat(500)
  });

  assert.match(error, /500 znakova/);
});

// TEST 5
test('Odbija neispravnu video poveznicu', () => {
  assert.match(
    validateApplicationData({
      videoUrl: 'nije-url'
    }),
    /nije ispravna/
  );
});

// TEST 6
test('Odbija nepodržani protokol video poveznice', () => {
  assert.match(
    validateApplicationData({
      videoUrl: 'ftp://example.com/video'
    }),
    /HTTP ili HTTPS/
  );
});

// TEST 7
test('Prihvaća valjane podatke', () => {
  assert.equal(
    validateApplicationData({
      coverLetter: 'Moja prijava.',
      videoUrl: 'https://example.com/video'
    }),
    null
  );
});

// TEST 8
test('Prihvaća prijavu bez opcionalnih podataka', () => {
  assert.equal(validateApplicationData({}), null);
});

// TEST 9
test('Odbija neispravan ID oglasa', async () => {
  const { model, calls } = fakeModel();
  const controller = createApplicationHandler({
    model,
    writesEnabled: true
  });

  const res = fakeResponse();

  await controller(
    fakeRequest({ params: { id: 'abc' } }),
    res
  );

  assert.equal(res.statusCode, 400);
  assert.equal(calls.transaction.length, 0);
});

// TEST 10
test('Odbija neprijavljenog korisnika', async () => {
  const { model, calls } = fakeModel();
  const controller = createApplicationHandler({
    model,
    writesEnabled: true
  });

  const res = fakeResponse();

  await controller(fakeRequest({ user: null }), res);

  assert.equal(res.statusCode, 401);
  assert.equal(calls.transaction.length, 0);
});

// TEST 11
test('Odbija korisnika koji nije kandidat', async () => {
  const { model, calls } = fakeModel();
  const controller = createApplicationHandler({
    model,
    writesEnabled: true
  });

  const res = fakeResponse();

  await controller(
    fakeRequest({
      user: { id: 10, role: 'employer' }
    }),
    res
  );

  assert.equal(res.statusCode, 403);
  assert.equal(calls.transaction.length, 0);
});

// TEST 12
test('Odbija pogrešne podatke prije pozivanja baze', async () => {
  const { model, calls } = fakeModel();
  const controller = createApplicationHandler({
    model,
    writesEnabled: true
  });

  const res = fakeResponse();

  await controller(
    fakeRequest({
      body: { coverLetter: 'a'.repeat(5001) }
    }),
    res
  );

  assert.equal(res.statusCode, 400);
  assert.equal(calls.profile.length, 0);
  assert.equal(calls.transaction.length, 0);
});

// TEST 13
test('Odbija korisnika bez profila kandidata', async () => {
  const { model, calls } = fakeModel({
    profile: null
  });

  const controller = createApplicationHandler({
    model,
    writesEnabled: true
  });

  const res = fakeResponse();

  await controller(fakeRequest(), res);

  assert.equal(res.statusCode, 403);
  assert.equal(calls.transaction.length, 0);
});

// TEST 14
test('Stvarna ruta ne sprema prijave dok je blokada uključena', async () => {
  const { model, calls } = fakeModel();
  const controller = createApplicationHandler({ model });

  const res = fakeResponse();

  await controller(fakeRequest(), res);

  assert.equal(res.statusCode, 503);
  assert.equal(calls.transaction.length, 0);

  assert.equal(typeof createApplication, 'function');
});

// TEST 15
test('Uspješna prijava vraća HTTP 201', async () => {
  const { model, calls } = fakeModel();

  const controller = createApplicationHandler({
    model,
    writesEnabled: true
  });

  const res = fakeResponse();

  await controller(fakeRequest(), res);

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.application.id, 50);
  assert.equal(res.body.application.status, 'SUBMITTED');

  assert.deepEqual(calls.transaction[0], [
    20,
    1,
    'Želim sudjelovati u castingu.',
    'https://example.com/video'
  ]);
});

// TEST 16
test('Odbija duplu prijavu s HTTP 409', async () => {
  const { model } = fakeModel({
    result: {
      allowed: false,
      message: 'Već ste prijavljeni na ovaj casting.'
    }
  });

  const controller = createApplicationHandler({
    model,
    writesEnabled: true
  });

  const res = fakeResponse();

  await controller(fakeRequest(), res);

  assert.equal(res.statusCode, 409);
  assert.match(res.body.error, /Već ste prijavljeni/);
});

// TEST 17
test('Odbija popunjen casting s HTTP 409', async () => {
  const { model } = fakeModel({
    result: {
      allowed: false,
      message: 'Dosegnut je maksimalan broj prijava.'
    }
  });

  const controller = createApplicationHandler({
    model,
    writesEnabled: true
  });

  const res = fakeResponse();

  await controller(fakeRequest(), res);

  assert.equal(res.statusCode, 409);
});

// TEST 18
test('Nepostojeći casting vraća HTTP 404', async () => {
  const { model } = fakeModel({
    result: {
      allowed: false,
      message: 'Casting oglas ne postoji.'
    }
  });

  const controller = createApplicationHandler({
    model,
    writesEnabled: true
  });

  const res = fakeResponse();

  await controller(fakeRequest(), res);

  assert.equal(res.statusCode, 404);
});

// TEST 19
test('Greška pri dohvaćanju profila vraća HTTP 500', async () => {
  const { model, calls } = fakeModel({
    profileError: true
  });

  const controller = createApplicationHandler({
    model,
    writesEnabled: true
  });

  const res = fakeResponse();

  const originalError = console.error;
  console.error = () => {};

  try {
    await controller(fakeRequest(), res);
  } finally {
    console.error = originalError;
  }

  assert.equal(res.statusCode, 500);
  assert.equal(calls.transaction.length, 0);
});

// TEST 20
test('Greška transakcije vraća HTTP 500', async () => {
  const { model } = fakeModel({
    transactionError: true
  });

  const controller = createApplicationHandler({
    model,
    writesEnabled: true
  });

  const res = fakeResponse();

  const originalError = console.error;
  console.error = () => {};

  try {
    await controller(fakeRequest(), res);
  } finally {
    console.error = originalError;
  }

  assert.equal(res.statusCode, 500);
  assert.match(res.body.error, /greške pri obradi prijave/);
});

// TEST 21
test('Opcionalna polja prenose se kao null', async () => {
  const { model, calls } = fakeModel();

  const controller = createApplicationHandler({
    model,
    writesEnabled: true
  });

  const res = fakeResponse();

  await controller(
    fakeRequest({ body: {} }),
    res
  );

  assert.equal(res.statusCode, 201);
  assert.deepEqual(calls.transaction[0], [
    20,
    1,
    null,
    null
  ]);
});
