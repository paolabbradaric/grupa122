
const express = require('express');
const castingController = require('../controllers/castingController');

const router = express.Router();

// Dohvat svih objavljenih oglasa.
router.get('/', castingController.getAllCastings);

// Dohvat jednog objavljenog oglasa prema ID-u.
router.get('/:id', castingController.getCastingById);

module.exports = router;
