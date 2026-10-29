
const express = require('express');
const castingController = require('../controllers/castingController');
const applicationController = require('../controllers/applicationController');

const router = express.Router();

router.get('/', castingController.getAllCastings);
router.get('/:id', castingController.getCastingById);

router.post('/:id/applications', applicationController.createApplication);

module.exports = router;
