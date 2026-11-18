const { rateLimit } = require('express-rate-limit');
const pool = require('../config/db');
const { AuthError } = require('../auth/errors');

class ApplicationRateLimitStore {
  constructor(database = pool) {
    this.database = database;
    this.localKeys = false;
    this.prefix = 'application-submission:';
  }

  init({ windowMs }) { this.windowMs = windowMs; }

  async increment(key) {
    // One atomic UPSERT serializes concurrent requests across all API instances.
    const { rows: [row] } = await this.database.query(`
      INSERT INTO app_private.application_submission_limits AS limits (user_id, total_hits, reset_at)
      VALUES ($1, 1, statement_timestamp() + $2 * interval '1 millisecond')
      ON CONFLICT (user_id) DO UPDATE SET
        total_hits = CASE WHEN limits.reset_at <= statement_timestamp() THEN 1
          ELSE LEAST(limits.total_hits, 2147483646) + 1 END,
        reset_at = CASE WHEN limits.reset_at <= statement_timestamp()
          THEN statement_timestamp() + $2 * interval '1 millisecond' ELSE limits.reset_at END
      RETURNING total_hits, reset_at`, [key, this.windowMs]);
    return { totalHits: row.total_hits, resetTime: new Date(row.reset_at) };
  }

  async decrement(key) {
    await this.database.query(`UPDATE app_private.application_submission_limits
      SET total_hits = GREATEST(total_hits - 1, 0) WHERE user_id = $1`, [key]);
  }

  async resetKey(key) {
    await this.database.query('DELETE FROM app_private.application_submission_limits WHERE user_id = $1', [key]);
  }
}

function createApplicationRateLimiter({ writesEnabled = false, store,
  windowMs = 15 * 60 * 1000, limit = 10 } = {}) {
  // Disabled business writes must never cause rate-counter writes either.
  if (!writesEnabled) return (_req, _res, next) => next();
  const limiter = rateLimit({
    windowMs, limit,
    store: store || new ApplicationRateLimitStore(),
    keyGenerator: req => String(req.user.id),
    identifier: 'application-submission',
    standardHeaders: 'draft-8', legacyHeaders: false,
    passOnStoreError: false,
    message: { code: 'APPLICATION_RATE_LIMITED', error: 'Previše pokušaja prijave. Pokušaj ponovno kasnije.' }
  });
  return (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    limiter(req, res, error => next(error
      ? new AuthError(503, 'APPLICATION_RATE_LIMIT_UNAVAILABLE', 'Predaja prijava trenutačno nije dostupna.')
      : undefined));
  };
}

module.exports = { ApplicationRateLimitStore, createApplicationRateLimiter };
