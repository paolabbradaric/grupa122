const { Router } = require('express');
const { createCastingController } = require('../controllers/castingController');

function createCastingRouter(options) {
  const router = Router();
  const controller = createCastingController(options);
  router.get('/', controller.getAllCastings);
  router.get('/:id', controller.getCastingById);
  return router;
}

module.exports = { createCastingRouter };
