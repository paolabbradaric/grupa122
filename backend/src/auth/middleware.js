const { timingSafeEqual } = require('node:crypto');
const { AuthError } = require('./errors');

function requireAuth(req, res, next) {
  if (!req.isAuthenticated?.() || !req.user) {
    return next(new AuthError(401, 'AUTH_REQUIRED', 'Potrebna je prijava.'));
  }
  next();
}

function requireRole(...roles) {
  return (req, res, next) => requireAuth(req, res, error => {
    if (error) return next(error);
    if (!roles.includes(req.user.role)) return next(new AuthError(403, 'FORBIDDEN', 'Nemaš ovlasti za ovu radnju.'));
    next();
  });
}

function protectMutation(config) {
  return (req, res, next) => {
    const token = req.get('X-CSRF-Token');
    const expected = req.session?.csrfToken;
    if (!config.allowedOrigins.has(req.get('Origin')) ||
        typeof token !== 'string' || typeof expected !== 'string' ||
        Buffer.byteLength(token) !== Buffer.byteLength(expected) ||
        !timingSafeEqual(Buffer.from(token), Buffer.from(expected))) {
      return next(new AuthError(403, 'INVALID_CSRF', 'Zahtjev nije dopušten. Osvježi stranicu i pokušaj ponovno.'));
    }
    next();
  };
}

module.exports = { requireAuth, requireRole, protectMutation };
