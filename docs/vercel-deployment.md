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
- A separately managed `SESSION_SECRET` of at least 32 characters.
- `FRONTEND_URL=https://<chosen-preview-host>` and
  `GOOGLE_CALLBACK_URL=https://<chosen-preview-host>/api/auth/google/callback`.
  Both must use HTTPS. Register the exact callback URI with the Google OAuth client.
- Existing `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and approved `ADMIN_EMAILS`.
- `TRUST_PROXY_HOPS=1` for Vercel's HTTPS proxy; review if another proxy is added.

Preview currently uses `https://grupa122-tin-preview-grupa122.vercel.app`.
After a successful Git deployment, point that preview alias to the tested
deployment so its origin and OAuth callback stay consistent. Production values
are stored separately and must not be overwritten by preview configuration.

Keep the existing application and employer casting write gates disabled during
deployment verification. Do not enable remote writes or run migrations as part
of a build. Authentication can write sessions and provision users; full Google
login checks therefore require separately approved database writes.

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
