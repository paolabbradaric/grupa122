'use strict';

const { Router } = require('express');
const { requireRole, protectMutation } = require('../auth/middleware');
const { createCandidateApplicationsController } = require('../controllers/candidateApplicationsController');

function createCandidateApplicationsRouter({ config, model, writesEnabled = false } = {}) {
  const router = Router();
  const controller = createCandidateApplicationsController({ model, writesEnabled });
  router.use(requireRole('candidate'));
  router.get('/applications', controller.list);
  router.patch('/applications/:applicationId/withdraw', protectMutation(config), controller.withdraw);
  return router;
}

module.exports = { createCandidateApplicationsRouter };
