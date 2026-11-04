const { Router } = require('express');
const { requireRole, protectMutation } = require('../auth/middleware');
const { createEmployerCastingController } = require('../controllers/employerCastingController');

function createEmployerCastingRouter({ config, writesEnabled = false, model } = {}) {
  const router = Router();
  const controller = createEmployerCastingController({ model, writesEnabled });
  router.use(requireRole('employer'));
  router.get('/castings', controller.list);
  router.post('/castings', protectMutation(config), controller.create);
  router.patch('/castings/:id', protectMutation(config), controller.update);
  return router;
}

module.exports = { createEmployerCastingRouter };
