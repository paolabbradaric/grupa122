const { test } = require('node:test');
const assert = require('node:assert/strict');
const { httpFixture } = require('../test-utils/httpFixture');
const { validateCastingFilters } = require('../src/controllers/castingController');

test('public filters validate types, lengths and adult age without coercing arrays', () => {
  assert.deepEqual(validateCastingFilters({ search: '  Glumac ', location: '', age: '18', projectType: 'film', requirements: ' ples ' }),
    { filters: { search: 'Glumac', age: 18, projectType: 'film', requirements: 'ples' } });
  for (const query of [{ age: '17' }, { age: '18.5' }, { age: '1e2' }, { age: '2147483648' },
    { age: '-20' }, { age: ['20', '30'] }, { search: {} }, { location: ['Zagreb'] },
    { search: 'a'.repeat(201) }, { requirements: 'a'.repeat(1001) }, { projectType: 'a'.repeat(21) },
    { unrecognized: 'x' }, { search: ' '.repeat(201) }]) {
    assert.ok(validateCastingFilters(query).error, JSON.stringify(query));
  }
});

test('anonymous public GET preserves JSON shape, legacy fields and passes combined filters', async t => {
  const row = { id: 1, title: 'Uloga', description: 'Opis', location: 'Zagreb', positions_count: 2,
    application_deadline: '2030-01-01T00:00:00.000Z', project_title: 'Film', project_type: 'film',
    project_description: 'Opis projekta', min_age: 18, max_age: 30, appearance_req: null, exp_req: 'ples' };
  const calls = [];
  const fixture = await httpFixture(t, { publicModel: {
    async getPublishedCastings(...args) { calls.push(args); return [row]; },
    async getCastingById(id) { return id === 1 ? row : null; }
  } });
  const list = await fixture.request('/api/castings?location=Zagreb&search=Uloga&projectType=film&age=25&requirements=ples');
  assert.equal(list.status, 200);
  assert.deepEqual(await list.json(), [row]);
  assert.deepEqual(calls[0], ['Zagreb', 'Uloga', { location: 'Zagreb', search: 'Uloga', projectType: 'film', age: 25, requirements: 'ples' }]);
  const detail = await fixture.request('/api/castings/1');
  assert.equal(detail.status, 200);
  assert.deepEqual(await detail.json(), row);
  assert.equal(detail.headers.get('set-cookie'), null);
  assert.equal((await fixture.request('/api/castings/999')).status, 404);
  for (const path of ['/api/castings?age=abc', '/api/castings?location=x&location=y',
    '/api/castings?location[city]=Zagreb', '/api/castings/0', '/api/castings/1e0',
    '/api/castings/2147483648', '/api/castings/-1']) {
    assert.equal((await fixture.request(path)).status, 400, path);
  }
  assert.equal(calls.length, 1);
  await fixture.request('/api/castings?location=&search=%20');
  assert.deepEqual(calls[1], [undefined, undefined, {}]);
});

test('empty lists stay arrays and database failures expose only the existing generic error', async t => {
  let fail = false;
  const fixture = await httpFixture(t, { publicModel: {
    async getPublishedCastings() { if (fail) throw new Error('private database details'); return []; },
    async getCastingById() { throw new Error('private database details'); }
  } });
  assert.deepEqual(await (await fixture.request('/api/castings')).json(), []);
  fail = true;
  t.mock.method(console, 'error', () => {});
  for (const path of ['/api/castings', '/api/castings/1']) {
    const response = await fixture.request(path);
    assert.equal(response.status, 500);
    assert.ok(!(await response.text()).includes('private database details'));
  }
});
