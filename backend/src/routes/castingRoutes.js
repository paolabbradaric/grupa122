
const express = require('express');
const castingController = require('../controllers/castingController');

const router = express.Router();

// GET zahtjev prosljeđujemo controlleru.
router.get('/', castingController.getAllCastings);

module.exports = router;
