
const { Router } = require('express');
const { requireRole, protectMutation } = require('../auth/middleware');

const { createEmployerCastingController } = require('../controllers/employerCastingController');
const { createEmployerCastingStatusController } = require('../controllers/employerCastingStatusController');
const { createEmployerCandidateSelectionController } = require('../controllers/employerCandidateSelectionController');
const { createEmployerApplicationsController } = require('../controllers/employerApplicationsController');
const { createEmployerApplicationStatusController } = require('../controllers/employerApplicationStatusController');

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
 
  const applicationStatuses = createEmployerApplicationStatusController({
    writesEnabled
  });


  // Samo prijavljeni poslodavci mogu pristupiti ovim rutama.
  router.use(requireRole('employer'));

  router.get('/castings', controller.list);

  // Pregled prijava kandidata.
  router.get('/castings/:id/applications', applications.list);

  // Promjena statusa prijave.
  router.patch(
    '/castings/:id/applications/:applicationId/status',
    protectMutation(config),
    applicationStatuses.changeStatus
  );

  router.post('/castings', protectMutation(config), controller.create);
  router.patch('/castings/:id', protectMutation(config), controller.update);
  router.post('/castings/:id/publish', protectMutation(config), controller.publish);
  router.post('/castings/:id/close', protectMutation(config), statuses.close);
  router.post('/castings/:id/cancel', protectMutation(config), statuses.cancel);

  // Konačni odabir kandidata — postojeća funkcionalnost.
  router.post(
    '/castings/:id/applications/:applicationId/select',
    protectMutation(config),
    selections.select
  );

  return router;
}

module.exports = { createEmployerCastingRouter };
