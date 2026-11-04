const express = require('express');
const session = require('express-session');
const PgStore = require('connect-pg-simple')(session);
const pool = require('./config/db');

const castingRoutes = require('./routes/castingRoutes');
const applicationController = require('./controllers/applicationController');
const { createEmployerCastingRouter } = require('./routes/employerCastingRoutes');

const { loadAuthConfig } = require('./auth/config');
const { createUserModel } = require('./auth/userModel');
const { createPassport } = require('./auth/passport');
const { createAuthRouter } = require('./auth/routes');
const { AuthError } = require('./auth/errors');
const { requireRole, protectMutation } = require('./auth/middleware');

function isLocalTestDatabase(env = process.env) {
  return ['localhost', '127.0.0.1'].includes(env.PGHOST) &&
    Number(env.PGPORT) === 5432 && env.PGDATABASE === 'castme_test';
}

function getApplicationWritesEnabled(env = process.env) {
  const requested = env.APPLICATION_WRITES_ENABLED === 'true';
  if (!requested) return false;
  const allowRemote = env.APPLICATION_WRITES_ALLOW_REMOTE === 'true';
  if (!isLocalTestDatabase(env) && !allowRemote) {
    throw new Error('Spremanje prijava je blokirano: dopuÅ¡tena je samo lokalna baza castme_test bez dodatne potvrde za udaljenu bazu.');
  }
  if (env.APPLICATION_WRITES_CONFIRMED !== 'true') {
    throw new Error('Spremanje prijava nije potvrÄ‘eno. Potrebna je izriÄita potvrda konfiguracije.');
  }
  return true;
}

// Prva verzija upravljanja nacrtima: samo lokalna testna baza.
// Upisi su iskljuÄeni Äak i lokalno, osim uz obje izriÄite potvrde.
function getEmployerCastingWritesEnabled(env = process.env) {
  if (env.EMPLOYER_CASTING_WRITES_ENABLED !== 'true') return false;
  if (!isLocalTestDatabase(env) || env.EMPLOYER_CASTING_WRITES_CONFIRMED !== 'true') {
    throw new Error('Spremanje nacrta dopuÅ¡teno je samo na potvrÄ‘enoj lokalnoj bazi castme_test.');
  }
  return true;
}

function createApp(options = {}) {
  const config = options.config || loadAuthConfig();
  const users = options.users || createUserModel(pool);
  const passport = options.passport || createPassport(config, users);

  const applicationWritesEnabled = getApplicationWritesEnabled();
  const applicationHandler = options.applicationHandler ||
    applicationController.createApplicationHandler({ writesEnabled: applicationWritesEnabled });

  const employerCastingWritesEnabled = getEmployerCastingWritesEnabled();

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);
  app.use(express.json({ limit: '16kb' }));

  // Javni pregled objavljenih oglasa.
  app.use('/api/castings', castingRoutes);

  app.use('/api',
    session({
      name: config.cookieName,
      secret: config.secret,
      resave: false,
      saveUninitialized: false,
      store: options.store || new PgStore({
        pool, schemaName: 'app_private', tableName: 'sessions', createTableIfMissing: false
      }),
      cookie: config.cookie
    }),
    passport.initialize(),
    passport.session()
  );

  app.use('/api/auth', createAuthRouter({
    config, users, passport, authLimiter: options.authLimiter
  }));

  // Rute poslodavca moraju biti nakon sesija/Passporta.
  app.use('/api/employer', createEmployerCastingRouter({
    config,
    writesEnabled: employerCastingWritesEnabled
  }));

  app.post('/api/castings/:id/applications',
    requireRole('candidate'), protectMutation(config), applicationHandler);

  app.use((error, req, res, _next) => {
    if (error instanceof AuthError) {
      return res.status(error.status).json({ code: error.code, error: error.message });
    }
    if (error.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'Neispravan JSON zahtjev.' });
    }
    if (error.type === 'entity.too.large') {
      return res.status(413).json({ error: 'Zahtjev je prevelik.' });
    }
    console.error('API zahtjev nije uspio:', error.code || 'INTERNAL_ERROR');
    return res.status(500).json({ error: 'Zahtjev nije moguÄ‡e obraditi. PokuÅ¡aj ponovno.' });
  });
  return app;
}

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  createApp().listen(port, () => {
    console.log(`Server radi na http://localhost:${port}`);
  });
}

module.exports = { createApp, getApplicationWritesEnabled, getEmployerCastingWritesEnabled };