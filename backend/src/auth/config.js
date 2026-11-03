const path = require('node:path');

require('dotenv').config({ path: path.resolve(__dirname, '../../.env'), quiet: true });

function loadAuthConfig(env = process.env) {
  const production = env.NODE_ENV === 'production';
  if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32) {
    throw new Error('SESSION_SECRET mora sadržavati najmanje 32 znaka. Pogledaj backend/.env.example.');
  }
  const frontendUrl = new URL(env.FRONTEND_URL || 'http://localhost:5173');
  const callbackUrl = new URL(env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/api/auth/google/callback');
  for (const url of [frontendUrl, callbackUrl]) {
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
        (production && url.protocol !== 'https:')) {
      throw new Error('Auth URL mora biti HTTP(S), odnosno HTTPS u produkciji, bez korisničkih podataka.');
    }
  }
  const trustProxy = Number(env.TRUST_PROXY_HOPS || 0);
  if (!Number.isSafeInteger(trustProxy) || trustProxy < 0) throw new Error('Neispravan TRUST_PROXY_HOPS.');
  return {
    production,
    trustProxy,
    secret: env.SESSION_SECRET,
    cookieName: 'castme.sid',
    cookie: { httpOnly: true, secure: production, sameSite: 'lax', path: '/', maxAge: 8 * 60 * 60 * 1000 },
    frontendUrl: frontendUrl.toString(),
    allowedOrigins: new Set([frontendUrl.origin, callbackUrl.origin]),
    callbackUrl: callbackUrl.toString(),
    googleClientId: env.GOOGLE_CLIENT_ID,
    googleClientSecret: env.GOOGLE_CLIENT_SECRET,
  };
}

module.exports = { loadAuthConfig };
