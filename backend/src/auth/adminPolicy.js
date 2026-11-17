const { AuthError } = require('./errors');

const normalizeEmail = email => typeof email === 'string' ? email.trim().toLowerCase() : '';
const emailPattern = /^[a-z0-9!#$%&'+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'+/=?^_`{|}~-]+)*@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/;

function parseAdminEmails(value) {
  if (value === undefined || value.trim() === '') return new Set();
  const emails = value.split(',').map(normalizeEmail);
  if (emails.some(email => email.length > 255 || !emailPattern.test(email))) {
    throw new Error('Neispravan ADMIN_EMAILS. Koristi potpune adrese odvojene zarezom.');
  }
  return new Set(emails);
}

function isAdmin(req, config) {
  const proof = req.session?.googleIdentity;
  const user = req.user;
  return Boolean(req.isAuthenticated?.() && user && !user.deleted_at && user.role === 'admin' &&
    proof?.verified === true && typeof proof.authId === 'string' && proof.authId.startsWith('google:') &&
    proof.authId.length > 7 && user.googleAuthId === proof.authId &&
    normalizeEmail(user.email) === proof.email && config.adminEmails?.has(proof.email));
}

function requireAdmin(config) {
  return (req, res, next) => {
    if (!req.isAuthenticated?.() || !req.user) {
      return next(new AuthError(401, 'AUTH_REQUIRED', 'Potrebna je prijava.'));
    }
    if (!isAdmin(req, config)) {
      return next(new AuthError(403, 'FORBIDDEN', 'Nemaš ovlasti za ovu radnju.'));
    }
    next();
  };
}

module.exports = { normalizeEmail, parseAdminEmails, isAdmin, requireAdmin };
