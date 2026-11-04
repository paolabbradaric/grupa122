
const express = require('express');
const session = require('express-session');
const PgStore = require('connect-pg-simple')(session);
const pool = require('./config/db');

const castingRoutes = require('./routes/castingRoutes');
const applicationController = require('./controllers/applicationController');

const { loadAuthConfig } = require('./auth/config');
const { createUserModel } = require('./auth/userModel');
const { createPassport } = require('./auth/passport');
const { createAuthRouter } = require('./auth/routes');
const { AuthError } = require('./auth/errors');
const { requireRole, protectMutation } = require('./auth/middleware');

// Provjera je li uključeno spremanje prijava.
function getApplicationWritesEnabled(env = process.env) {
  const requested =
    env.APPLICATION_WRITES_ENABLED === 'true';

  // Spremanje je po zadanim postavkama isključeno.
  if (!requested) {
    return false;
  }

  const isLocalTestDatabase =
    ['localhost', '127.0.0.1'].includes(env.PGHOST) &&
    Number(env.PGPORT) === 5432 &&
    env.PGDATABASE === 'castme_test';

  const allowRemote =
    env.APPLICATION_WRITES_ALLOW_REMOTE === 'true';

  // Udaljena baza zahtijeva dodatnu dozvolu.
  if (!isLocalTestDatabase && !allowRemote) {
    throw new Error(
      'Spremanje prijava je blokirano: ' +
      'dopuštena je samo lokalna baza castme_test ' +
      'bez dodatne potvrde za udaljenu bazu.'
    );
  }

  // Obavezna potvrda u svakom okruženju.
  if (env.APPLICATION_WRITES_CONFIRMED !== 'true') {
    throw new Error(
      'Spremanje prijava nije potvrđeno. ' +
      'Potrebna je izričita potvrda konfiguracije.'
    );
  }

  return true;
}

function createApp(options = {}) {
  const config = options.config || loadAuthConfig();
  const users = options.users || createUserModel(pool);
  const passport = options.passport || createPassport(config, users);

  const applicationWritesEnabled =
    getApplicationWritesEnabled();

  // Testovi mogu zamijeniti controller lažnim.
  // U stvarnoj aplikaciji koristi se pravi controller.
  const applicationHandler =
    options.applicationHandler ||
    applicationController.createApplicationHandler({
      writesEnabled: applicationWritesEnabled
    });

  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);

  app.use(express.json({
    limit: '16kb'
  }));

  // JAVNE CASTING RUTE
  // Pregled oglasa dopušten je svim korisnicima.
  app.use('/api/castings', castingRoutes);

  // KORISNIČKE SESIJE I PASSPORT
  app.use(
    '/api',
    session({
      name: config.cookieName,
      secret: config.secret,
      resave: false,
      saveUninitialized: false,
      store: options.store || new PgStore({
        pool,
        schemaName: 'app_private',
        tableName: 'sessions',
        createTableIfMissing: false
      }),
      cookie: config.cookie
    }),
    passport.initialize(),
    passport.session()
  );

  // GOOGLE OAUTH RUTE
  app.use(
    '/api/auth',
    createAuthRouter({
      config,
      users,
      passport,
      authLimiter: options.authLimiter
    })
  );

  // PRIJAVA KANDIDATA NA CASTING
  // 1. Korisnik mora biti kandidat.
  // 2. Mora poslati ispravan CSRF token.
  // 3. Controller provjerava podatke i profil.
  // 4. Spremanje ovisi o konfiguraciji.
  app.post(
    '/api/castings/:id/applications',
    requireRole('candidate'),
    protectMutation(config),
    applicationHandler
  );

  // OBRADA GREŠAKA
  app.use((error, req, res, _next) => {
    if (error instanceof AuthError) {
      return res.status(error.status).json({
        code: error.code,
        error: error.message
      });
    }

    if (error.type === 'entity.parse.failed') {
      return res.status(400).json({
        error: 'Neispravan JSON zahtjev.'
      });
    }

    if (error.type === 'entity.too.large') {
      return res.status(413).json({
        error: 'Zahtjev je prevelik.'
      });
    }

    console.error(
      'API zahtjev nije uspio:',
      error.code || 'INTERNAL_ERROR'
    );

    return res.status(500).json({
      error: 'Zahtjev nije moguće obraditi. Pokušaj ponovno.'
    });
  });

  return app;
}

// Pokretanje servera
if (require.main === module) {
  const port = Number(process.env.PORT || 3000);

  createApp().listen(port, () => {
    console.log(
      `Server radi na http://localhost:${port}`
    );
  });
}

module.exports = {
  createApp,
  getApplicationWritesEnabled
};
