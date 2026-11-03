
const express = require('express');
const session = require('express-session');
const PgStore = require('connect-pg-simple')(session);
const pool = require('./config/db');
const castingRoutes = require('./routes/castingRoutes');
const { loadAuthConfig } = require('./auth/config');
const { createUserModel } = require('./auth/userModel');
const { createPassport } = require('./auth/passport');
const { createAuthRouter } = require('./auth/routes');
const { AuthError } = require('./auth/errors');

function createApp(options = {}) {
  const config = options.config || loadAuthConfig();
  const users = options.users || createUserModel(pool);
  const passport = options.passport || createPassport(config, users);
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);
  app.use(express.json({ limit: '16kb' }));
  // Javnim oglasima nije potrebna sesija ni veza s tablicom sesija.
  app.use('/api/castings', castingRoutes);
  app.use('/api', session({
    name: config.cookieName,
    secret: config.secret,
    resave: false,
    saveUninitialized: false,
    store: options.store || new PgStore({ pool, schemaName: 'app_private', tableName: 'sessions', createTableIfMissing: false }),
    cookie: config.cookie,
  }), passport.initialize(), passport.session());
  app.use('/api/auth', createAuthRouter({ config, users, passport, authLimiter: options.authLimiter }));
  app.use((error, req, res, _next) => {
    if (error instanceof AuthError) return res.status(error.status).json({ code: error.code, error: error.message });
    if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'Neispravan JSON zahtjev.' });
    if (error.type === 'entity.too.large') return res.status(413).json({ error: 'Zahtjev je prevelik.' });
    console.error('API zahtjev nije uspio:', error.code || 'INTERNAL_ERROR');
    res.status(500).json({ error: 'Zahtjev nije moguće obraditi. Pokušaj ponovno.' });
  });
  return app;
}

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  createApp().listen(port, () => console.log(`Server radi na http://localhost:${port}`));
}

module.exports = { createApp };
