const { Router } = require('express');
const { rateLimit } = require('express-rate-limit');
const { requireRole, protectMutation } = require('../auth/middleware');
const { createModerationModel } = require('./model');
const { body, id, reason } = require('./validation');

function createModerationRouter({ config, pool, model = createModerationModel(pool), limiter }) {
  const router = Router();
  router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  const protect = protectMutation(config);
  const limit = limiter || rateLimit({ windowMs: 15 * 60 * 1000, limit: 20,
    keyGenerator: req => String(req.user.id), standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: 'Previše zahtjeva. Pokušaj ponovno za 15 minuta.' } });
  router.get('/employer/verification', requireRole('employer'), async (req, res) => {
    res.json(await model.mine(req.user.id));
  });
  router.post('/employer/verification', requireRole('employer'), protect, limit, async (req, res) => {
    body(req.body, []);
    res.status(201).json(await model.submit(req.user.id));
  });
  router.post('/castings/:id/reports', requireRole('candidate', 'employer'), protect, limit, async (req, res) => {
    const input = body(req.body, ['reason']);
    res.status(201).json(await model.report(req.user.id, id(req.params.id), reason(input.reason)));
  });
  return router;
}
module.exports = { createModerationRouter };
