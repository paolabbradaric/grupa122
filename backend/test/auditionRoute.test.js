const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');

const session = require('express-session');

const { createApp } = require('../src/app');
const { loadAuthConfig } = require('../src/auth/config');
const { createPassport } = require('../src/auth/passport');
const { getAuditionSlots, createAuditionSlot, cancelAuditionSlot } = require('../src/models/auditionModels');
const { resolve } = require('node:dns');

const config = loadAuthConfig({
    SESSION_SECRET: 'test-secret-with-at-least-thirty-two-characters',
    GOOGLE_CLIENT_ID: 'test-client',
    GOOGLE_CLIENT_SECRET: 'test-google-secret'
});

async function createFixture(t, role = 'employer'){
    const user ={
        id:10,
        email:'test@example.test',
        role
    };

    const users = {
        async findById(id){
            return id === user.id ? user : null;
        },
        async findByAuthId(){
            return user;
        }
    };

    const passport = createPassport(config, users);

    const google = passport._strategy('google');

    google._oauth2.getOAuthAccessToken = (
        code,
        params,
        done
    ) => {
        done(null, 'fake-access-token', 'fake-refresh-token');
    };

    google.userProfile = (token, done) => {
        done(null, {
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
        });
    };

    const store = new session.MemoryStore();

    let controllerCalls = 0;

    const auditionController = {
        getAuditionSlots(req, res){
            res.json([]);
        },

        createAuditionSlot(req, res){
            res.status(201).json({});
        },

        cancelAuditionSlot(req,res){
            controllerCalls++;

            res.json({
                message: 'Termin je otkazan.'
            });
        }
    };

    const app = createApp({
        config,
        users,
        passport,
        store,
        auditionController
    });

    const server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');

    t.after(async()=> {
        await new Promise(resolve => {
            server.close(resolve);
            server.closeAllConnections();
        });

        store.clear();
    });

    const base = `http://127.0.0.1:${server.address().port}`;

    let cookie = null;

    async function request(path, options = {}){
        const response = await fetch(base + path, {
            redirect: 'manual',
            ...options,
            headers: {
                ...(cookie ? { Cookie: cookie } : {}),
                ...options.headers
            }
        });

        const setCookie = response.headers.get('set-cookie');

        if(setCookie){
            cookie = setCookie.split(';')[0];
        }

        return response;
    }

    async function signIn(){
        const start = await request('/api/auth/google');
        assert.equal(start.status, 302);

        const redirectUrl = new URL(start.headers.get('location'));
        const state = redirectUrl.searchParams.get('state');

        assert.ok(state);

        const callback = await request(
            '/api/auth/google/callback' +
            `?code=test-code&state=${encodeURIComponent(state)}`
        );

        assert.equal(callback.status, 302);

        const me = await request('/api/auth/me');
        assert.equal(me.status, 200);

        const meDate = await me.json();
        assert.equal(meDate.user.role, role);
        assert.ok(meDate.csrfToken);

        return meDate.csrfToken;
    }

    async function cancelSlot(
        token = null,
        origin = 'http://localhost:5173'
    ) {
        const headers = {};

        if (origin !== null) {
            headers.Origin = origin;
        }

        if (token !== null) {
            headers['X-CSRF-Token'] = token;
        }

        return request(
            '/api/auditions/1/slots/7/cancel',
            {
              method: 'PATCH',
              headers
            }
        );
    }

    return {
        signIn,
        cancelSlot,
        getControllerCalls: () => controllerCalls
    };
}


test('Neprijavljeni korisnik ne može otkazati termin', async t => {
    const fixture = await createFixture(t);

    const response = await fixture.cancelSlot();

    assert.equal(response.status, 401);

    const data = await response.json();
    assert.equal(data.code, 'AUTH_REQUIRED');
    assert.equal(fixture.getControllerCalls(), 0);
});

test('Kandidat ne može otkazati termin', async t => {
    const fixture = await createFixture(t, 'candidate');

    await fixture.signIn();

    const response = await fixture.cancelSlot();

    assert.equal(response.status, 403);

    const data = await response.json();
    assert.equal(data.code, 'FORBIDDEN');
    assert.equal(fixture.getControllerCalls(), 0);
});

test('Poslodavac bez CSRF tokena ne može otkazati termin', async t => {
    const fixture = await createFixture(t);

    await fixture.signIn();

    const response = await fixture.cancelSlot();

    assert.equal(response.status, 403);

    const data = await response.json();
    assert.equal(data.code, 'INVALID_CSRF');
    assert.equal(fixture.getControllerCalls(), 0);
});

test('Poslodavac s valjanim CSRF tokenom može otkazati termin', async t => {
    const fixture = await createFixture(t);

    const csrfToken = await fixture.signIn();

    const response = await fixture.cancelSlot(csrfToken);

    assert.equal(response.status, 200);

    const data = await response.json();
    assert.equal(data.message, 'Termin je otkazan.');
    assert.equal(fixture.getControllerCalls(), 1);
});

test('Poslodavac s pogrešnim CSRF tokenom ne može otkazati termin', async t =>{
    const fixture = await createFixture(t);

    await fixture.signIn();

    const response = await fixture.cancelSlot('wrong-token');

    assert.equal(response.status, 403);

    const data = await response.json();

    assert.equal(data.code, 'INVALID_CSRF');
    assert.equal(fixture.getControllerCalls(), 0);
});

test('Poslodavac s nedopuštenog Origina ne može otkazati termin', async t => {
    const fixture = await createFixture(t);

    const csrfToken = await fixture.signIn();

    const response = await fixture.cancelSlot(
        csrfToken,
        'https://attacker.example'
    );

    assert.equal(response.status, 403);

    const data = await response.json();

    assert.equal(data.code, 'INVALID_CSRF');
    assert.equal(fixture.getControllerCalls(), 0);
});
