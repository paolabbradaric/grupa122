const express = require('express');
const session = require('express-session');
const PgStore = require('connect-pg-simple')(session);
const pool = require('./config/db');

const { createCastingRouter } = require('./routes/castingRoutes');
const { createApplicationRateLimiter } = require('./middleware/applicationRateLimit');
const { createProfileRouter } = require('./profiles/routes');
const { createAuditionRouter } = require('./routes/auditionRoutes');
const applicationController = require('./controllers/applicationController');
const { createEmployerCastingRouter } = require('./routes/employerCastingRoutes');
const { createCandidateApplicationsRouter } = require('./routes/candidateApplicationsRoutes');

const { loadAuthConfig } = require('./auth/config');
const { createUserModel } = require('./auth/userModel');
const { createPassport } = require('./auth/passport');
const { createAuthRouter } = require('./auth/routes');
const { createAdminRouter } = require('./admin/routes');
const { createModerationRouter } = require('./admin/publicRoutes');
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
    throw new Error('Spremanje prijava je blokirano: dopuštena je samo lokalna baza castme_test bez dodatne potvrde za udaljenu bazu.');
  }
  if (env.APPLICATION_WRITES_CONFIRMED !== 'true') {
    throw new Error('Spremanje prijava nije potvrdeno. Potrebna je izrazita potvrda konfiguracije.');
  }
  return true;
}

// Upisi su zadano isključeni. Udaljena aktivacija traži zasebnu potvrdu i TLS.
function getEmployerCastingWritesEnabled(env = process.env) {
  if (env.EMPLOYER_CASTING_WRITES_ENABLED !== 'true') return false;
  if (env.EMPLOYER_CASTING_WRITES_CONFIRMED !== 'true') {
    throw new Error('Spremanje oglasa nije izričito potvrđeno konfiguracijom.');
  }
  if (!isLocalTestDatabase(env)) {
    if (env.EMPLOYER_CASTING_WRITES_ALLOW_REMOTE !== 'true') {
      throw new Error('Spremanje oglasa u udaljenu bazu nije izričito dopušteno.');
    }
    if (env.PGSSL !== 'true') {
      throw new Error('Spremanje oglasa u udaljenu bazu zahtijeva TLS.');
    }
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
  // I greške parsiranja i obnove sesije moraju imati zabranu predmemoriranja.
  app.use('/api/admin', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  app.use(express.json({ limit: '16kb' }));

  // Javni pregled objavljenih oglasa.
  app.use('/api/castings', createCastingRouter({ model: options.publicCastingModel }));

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

  const moderationOptions = { config, pool: options.moderationPool || pool, model: options.moderationModel };
  app.use('/api/admin', createAdminRouter(moderationOptions));
  app.use('/api', createModerationRouter(moderationOptions));

  app.use('/api', createProfileRouter({
    config, pool: options.profilePool || pool,
    storage: options.profileStorage, model: options.profileModel
  }));

  // Rute poslodavca moraju biti nakon sesija/Passporta.
  app.use('/api/employer', createEmployerCastingRouter({
    config,
    writesEnabled: employerCastingWritesEnabled
  }));

  app.use('/api/candidate', createCandidateApplicationsRouter({
    config, writesEnabled: applicationWritesEnabled, model: options.candidateApplicationsModel
  }));

  app.post('/api/castings/:id/applications',
    requireRole('candidate'), protectMutation(config),
    createApplicationRateLimiter({ writesEnabled: applicationWritesEnabled, store: options.applicationRateLimitStore }),
    applicationHandler);
  // Rute za audicije.
  app.use('/api/auditions', createAuditionRouter({ config, controller: options.auditionController }));

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
    return res.status(500).json({ error: 'Zahtjev nije moguće obraditi. Pokušaj ponovno.' });
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
