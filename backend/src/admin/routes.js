const { Router } = require('express');
const { requireAdmin } = require('../auth/adminPolicy');
const { protectMutation } = require('../auth/middleware');
const { createModerationModel } = require('./model');
const { body, id, reason, page, invalid } = require('./validation');

function createAdminRouter({ config, pool, model = createModerationModel(pool) }) {
  const router = Router();
  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  router.use(requireAdmin(config));
  const protect = protectMutation(config);
  router.use((req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    return protect(req, res, next);
  });
  router.get('/session', (req, res) => res.json({ admin: true, userId: req.user.id }));
  router.get('/verifications', async (req, res) => {
    res.json(await model.verifications(page(req.query, ['pending', 'under_review', 'approved', 'rejected'])));
  });
  router.patch('/verifications/:id', async (req, res) => {
    const input = body(req.body, ['status', 'reason']);
    if (!['under_review', 'approved', 'rejected'].includes(input.status)) throw invalid('Neispravan status verifikacije.');
    const note = input.status === 'rejected' ? reason(input.reason) : null;
    res.json(await model.reviewVerification(req.user.id, id(req.params.id), input.status, note));
  });
  router.get('/reports', async (req, res) => {
    res.json(await model.reports(page(req.query, ['open', 'dismissed', 'removed'])));
  });
  router.patch('/reports/:id', async (req, res) => {
    const input = body(req.body, ['status', 'reason']);
    if (input.status !== 'dismissed') throw invalid('Za brisanje oglasa koristi zasebnu potvrdu.');
    res.json(await model.dismissReport(req.user.id, id(req.params.id), reason(input.reason)));
  });
  router.delete('/castings/:id', async (req, res) => {
    const castingId = id(req.params.id);
    const input = body(req.body, ['confirmation', 'reason']);
    if (input.confirmation !== `OBRIŠI ${castingId}`) throw invalid(`Upiši OBRIŠI ${castingId} za potvrdu brisanja.`);
    res.json(await model.deleteCasting(req.user.id, castingId, reason(input.reason)));
  });
  router.get('/stats', async (req, res) => res.json(await model.stats()));
  router.use((req, res) => res.status(404).json({ error: 'Admin ruta ne postoji.' }));
  return router;
}

module.exports = { createAdminRouter };
