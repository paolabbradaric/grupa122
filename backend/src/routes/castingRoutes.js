
const express = require('express');
const castingController = require('../controllers/castingController');

const router = express.Router();

router.get('/', castingController.getAllCastings);
router.get('/:id', castingController.getCastingById);

module.exports = router;
