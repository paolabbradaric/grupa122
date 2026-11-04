const { Router } = require('express');
const { randomBytes } = require('node:crypto');
const { rateLimit } = require('express-rate-limit');
const { AuthError } = require('./errors');
const { validateProfile } = require('./validation');
const { protectMutation } = require('./middleware');

const call = (object, method, ...args) => new Promise((resolve, reject) => {
  object[method](...args, error => error ? reject(error) : resolve());
});

function pendingIdentity(req) {
  const identity = req.session.pendingIdentity;
  return identity && identity.expiresAt > Date.now() ? identity : null;
}

async function establishSession(req, user, config) {
  // Passport 0.7 regenerira ID sesije u logIn; ne čuvamo staru OAuth/pending sesiju.
  await call(req, 'logIn', user);
  req.session.cookie.maxAge = config.cookie.maxAge;
  req.session.csrfToken = randomBytes(32).toString('hex');
  await call(req.session, 'save');
}

function createAuthRouter({ config, passport, users, authLimiter }) {
  const router = Router();
  const limiter = authLimiter || rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { code: 'AUTH_RATE_LIMITED', error: 'Previše pokušaja. Pokušaj ponovno za 15 minuta.' },
  });
  const protect = protectMutation(config);
  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    res.set('Referrer-Policy', 'no-referrer');
    next();
  });

  const configured = (req, res, next) => {
    if (!config.googleClientId || !config.googleClientSecret) {
      return next(new AuthError(503, 'GOOGLE_NOT_CONFIGURED', 'Google prijava još nije konfigurirana.'));
    }
    next();
  };
  const failureUrl = code => {
    const url = new URL(config.frontendUrl);
    url.searchParams.set('authError', code);
    return url.toString();
  };

  router.get('/google', limiter, configured, passport.authenticate('google'));
  router.get('/google/callback', limiter, configured, (req, res, next) => {
    passport.authenticate('google', { session: false }, (error, identity) => {
      if (error || !identity) {
        return res.redirect(failureUrl(req.query.error === 'access_denied' ? 'access_denied' : 'oauth_failed'));
      }
      (async () => {
        const user = await users.findByAuthId(identity.authId);
        if (user) {
          await establishSession(req, user, config);
        } else {
          await call(req.session, 'regenerate');
          req.session.pendingIdentity = { ...identity, expiresAt: Date.now() + 10 * 60 * 1000 };
          req.session.csrfToken = randomBytes(32).toString('hex');
          req.session.cookie.maxAge = 10 * 60 * 1000;
          await call(req.session, 'save');
        }
        res.redirect(config.frontendUrl);
      })().catch(async error => {
        // Ne ostavljamo djelomično otvorenu sesiju ako pohrana/prijava ne uspije.
        try { await call(req.session, 'destroy'); } catch { /* glavni odgovor ostaje generičan */ }
        console.error('Google prijava nije uspjela:', error.code || 'AUTH_FAILURE');
        res.redirect(failureUrl('oauth_failed'));
      });
    })(req, res, next);
  });

  router.get('/me', async (req, res) => {
    const pending = pendingIdentity(req);
    if (!req.user && !pending) throw new AuthError(401, 'AUTH_REQUIRED', 'Potrebna je prijava.');
    if (!req.session.csrfToken) {
      req.session.csrfToken = randomBytes(32).toString('hex');
      await call(req.session, 'save');
    }
    res.json({
      user: req.user || null,
      onboardingRequired: !req.user && Boolean(pending),
      identity: !req.user && pending ? { email: pending.email, firstName: pending.firstName, lastName: pending.lastName } : null,
      csrfToken: req.session.csrfToken,
    });
  });

  router.post('/onboarding', limiter, protect, async (req, res) => {
    if (req.user) throw new AuthError(409, 'ALREADY_REGISTERED', 'Račun je već registriran.');
    const identity = pendingIdentity(req);
    if (!identity) throw new AuthError(401, 'AUTH_REQUIRED', 'Ponovno se prijavi putem Googlea.');
    const profile = validateProfile(req.body);
    const user = await users.register(identity, profile);
    await establishSession(req, user, config);
    res.status(201).json({ user, onboardingRequired: false, identity: null, csrfToken: req.session.csrfToken });
  });

  router.post('/logout', protect, async (req, res) => {
    await call(req.session, 'destroy');
    const { maxAge: _maxAge, ...cookieOptions } = config.cookie;
    res.clearCookie(config.cookieName, cookieOptions);
    res.json({ signedOut: true });
  });
  return router;
}

module.exports = { createAuthRouter };
