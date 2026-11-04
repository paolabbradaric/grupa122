const { Router } = require('express');
const { requireRole, protectMutation } = require('../auth/middleware');
const { createEmployerCastingController } = require('../controllers/employerCastingController');
const { createEmployerCastingStatusController } = require('../controllers/employerCastingStatusController');

function createEmployerCastingRouter({ config, writesEnabled = false, model, statusModel } = {}) {
  const router = Router();
  const controller = createEmployerCastingController({ model, writesEnabled });
  const statuses = createEmployerCastingStatusController({ model: statusModel, writesEnabled });
  router.use(requireRole('employer'));
  router.get('/castings', controller.list);
  router.post('/castings', protectMutation(config), controller.create);
  router.patch('/castings/:id', protectMutation(config), controller.update);
  router.post('/castings/:id/publish', protectMutation(config), controller.publish);
  router.post('/castings/:id/close', protectMutation(config), statuses.close);
  router.post('/castings/:id/cancel', protectMutation(config), statuses.cancel);
  return router;
}

module.exports = { createEmployerCastingRouter };
