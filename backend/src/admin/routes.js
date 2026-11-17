const { Router } = require('express');
const { requireAdmin } = require('../auth/adminPolicy');
const { protectMutation } = require('../auth/middleware');

function createAdminRouter({ config }) {
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
  // Poslovne admin operacije dodaju se zasebno iza zajedničkih provjera.
  router.use((req, res) => res.status(404).json({ error: 'Admin ruta ne postoji.' }));
  return router;
}

module.exports = { createAdminRouter };
