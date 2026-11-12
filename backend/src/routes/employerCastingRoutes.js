
const { Router } = require('express');
const { requireRole, protectMutation } = require('../auth/middleware');

const { createEmployerCastingController } = require('../controllers/employerCastingController');
const { createEmployerCastingStatusController } = require('../controllers/employerCastingStatusController');
const { createEmployerCandidateSelectionController } = require('../controllers/employerCandidateSelectionController');
const { createEmployerApplicationsController } = require('../controllers/employerApplicationsController');

function createEmployerCastingRouter({
  config,
  writesEnabled = false,
  model,
  statusModel,
  selectionModel
} = {}) {
  const router = Router();

  const controller = createEmployerCastingController({ model, writesEnabled });
  const statuses = createEmployerCastingStatusController({ model: statusModel, writesEnabled });
  const selections = createEmployerCandidateSelectionController({ model: selectionModel, writesEnabled });
  const applications = createEmployerApplicationsController();

  // Sve rute dostupne su samo prijavljenim poslodavcima.
  router.use(requireRole('employer'));

  router.get('/castings', controller.list);

  // Pregled kandidata prijavljenih na pojedini oglas.
  router.get('/castings/:id/applications', applications.list);

  router.post('/castings', protectMutation(config), controller.create);
  router.patch('/castings/:id', protectMutation(config), controller.update);
  router.post('/castings/:id/publish', protectMutation(config), controller.publish);
  router.post('/castings/:id/close', protectMutation(config), statuses.close);
  router.post('/castings/:id/cancel', protectMutation(config), statuses.cancel);

  router.post(
    '/castings/:id/applications/:applicationId/select',
    protectMutation(config),
    selections.select
  );

  return router;
}

module.exports = { createEmployerCastingRouter };
