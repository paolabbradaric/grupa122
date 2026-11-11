const { Router } = require('express');
const { requireRole, protectMutation } = require('../auth/middleware');
const { createEmployerCastingController } = require('../controllers/employerCastingController');
const { createEmployerCastingStatusController } = require('../controllers/employerCastingStatusController');
const { createEmployerCandidateSelectionController } = require('../controllers/employerCandidateSelectionController');

function createEmployerCastingRouter({ config, writesEnabled = false, model, statusModel, selectionModel } = {}) {
  const router = Router();
  const controller = createEmployerCastingController({ model, writesEnabled });
  const statuses = createEmployerCastingStatusController({ model: statusModel, writesEnabled });
  const selections = createEmployerCandidateSelectionController({ model: selectionModel, writesEnabled });
  router.use(requireRole('employer'));
  router.get('/castings', controller.list);
  router.post('/castings', protectMutation(config), controller.create);
  router.patch('/castings/:id', protectMutation(config), controller.update);
  router.post('/castings/:id/publish', protectMutation(config), controller.publish);
  router.post('/castings/:id/close', protectMutation(config), statuses.close);
  router.post('/castings/:id/cancel', protectMutation(config), statuses.cancel);
  router.post('/castings/:id/applications/:applicationId/select', protectMutation(config), selections.select);
  return router;
}

module.exports = { createEmployerCastingRouter };
