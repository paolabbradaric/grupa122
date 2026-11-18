# Vercel deployment

Project `grupa122`, team `grupa122`: use the repository root and the **Services**
framework preset. The root `vercel.json` builds Vite and Express together.
`/api` and `/api/*` reach Express with the original URL. Other paths reach Vite;
the frontend fallback serves SPA deep links such as `/admin`.

`backend/server.mjs` is the ESM adapter for the existing CommonJS app factory.
It imports Express for framework detection and exports the protected application.
Local `npm start` and `npm run dev` continue using `src/app.js`.
The backend includes `**/certs/**` so the public CA survives function packaging.

## Environment settings

Configure these in Vercel, without uploading or committing `.env`:

- Existing PostgreSQL credentials and `PGSSL=true`. TLS certificate verification
  remains enabled. Use `PGSSLROOTCERT=certs/supabase-ca.crt`, not a Windows path.
- `NODE_ENV=production` for deployed backends, including Preview.
- A separately managed `SESSION_SECRET` of at least 32 characters per environment;
  preserve an existing valid secret when fixing a callback.
- For the public app, `FRONTEND_URL=https://grupa122.vercel.app` and
  `GOOGLE_CALLBACK_URL=https://grupa122.vercel.app/api/auth/google/callback`.
  Register that exact URI in **Authorized redirect URIs** of the same Google
  web client identified by the deployed `/api/auth/google` response. Adding a
  JavaScript origin alone does not register the callback. Keep the local URI
  `http://localhost:3000/api/auth/google/callback` registered too.
- Existing `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and approved `ADMIN_EMAILS`.
- `TRUST_PROXY_HOPS=1` for the documented direct Vercel proxy setup; confirm the
  target topology and Secure cookie behavior before using it elsewhere.

The public app is `https://grupa122.vercel.app`. The documented Preview alias is
`https://grupa122-tin-preview-grupa122.vercel.app`; it is protected by Vercel
Authentication and is not the public app's domain. Configure Preview separately:
set its `FRONTEND_URL` to that stable alias and `GOOGLE_CALLBACK_URL` to
`https://grupa122-tin-preview-grupa122.vercel.app/api/auth/google/callback` only
when that alias is the intended OAuth test host. Register its exact callback in
the intended Google client before testing it; Preview login is not yet verified.
After a successful Git deployment, point that preview alias to the tested
deployment so its origin and OAuth callback stay consistent. Production values
are stored separately and must not be overwritten by preview configuration.
Start and finish login on the same host: the session cookie is host-only.
Do not derive callback URLs from request Host headers or register arbitrary
deployment URLs. Environment changes require a new deployment in the matching
environment. Adding a URI to the existing Google client alone needs no redeploy.

Keep the existing application and employer casting write gates disabled during
deployment verification. Do not enable remote writes or run migrations as part
of a build. Authentication writes sessions and can provision users; use only
accounts intended for the authorized login check, without unrelated DB writes.

## Candidate withdrawal activation

Before activating withdrawal, coordinate controlled execution of
`db/migrations/20261112_candidate_withdrawal_booking_guard.sql` with Mario.
Without the installed and enabled booking guards, the withdrawal PATCH fails
closed with 503. This deployment change does not execute that migration or
weaken authentication, Origin/CSRF checks, write protection, or database guards.

## Verification

Run `npm ci` in each package, `npm run build` in `frontend`, and `npm test` in
`backend`. Leave opt-in database test flags disabled unless an isolated local
test database has been confirmed. `test/vercel-entrypoint.test.js` verifies the
real deployment adapter with PostgreSQL access explicitly blocked.
`test/auth.test.js` also checks the configured HTTPS callback and return origin,
Secure/HttpOnly/SameSite cookie attributes behind a trusted proxy, onboarding,
session restoration, logout, and repeated login without duplicate registration.
Google HTTP responses and user/session stores in those tests are simulated.

For the public domain, check `/api/auth/google` without following its redirect
and compare only `client_id` and `redirect_uri` with the selected Google client.
Never publish the complete authorization URL, state, cookies, codes, or tokens.
Google must accept the URI before debugging later session or database steps.
After login, check `/api/auth/me`, refresh, logout and repeat login with the same
role, including `/admin` for an authorized administrator. Record actual browser
checks separately from mocked tests. The [18 November verification](verification/2026-11-18/deployed-google-auth.md)
records the public-domain fix and the remaining deployment metadata limitations.

For service routing, use Vercel CLI 65.17.0 in an isolated checkout without `.env`:

```sh
SESSION_SECRET=local-vercel-smoke-test-secret-32-characters \
APPLICATION_WRITES_ENABLED=false EMPLOYER_CASTING_WRITES_ENABLED=false \
PGHOST=127.0.0.1 PGPORT=1 PGDATABASE=castme_test PGSSL=false \
vercel dev --local --listen 127.0.0.1:4173
```

Check `/admin` returns frontend HTML, `/api/auth/me` and `/api/admin/session`
return 401 JSON for an anonymous user, and logout without Origin/CSRF returns 403.
The deliberately unreachable database is only for anonymous routing checks.
On Vercel, keep Deployment Protection enabled and distinguish its responses from
the application's authentication responses. A successful public castings GET is
a read-only database check; it does not verify Google/admin login or withdrawal.

References: [Services](https://vercel.com/docs/services/config-reference),
[Express entrypoints](https://vercel.com/docs/frameworks/backend/express).
