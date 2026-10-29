
const applicationModel = require('../models/applicationModel');

async function createApplication(req, res) {
  return res.status(503).json({
    error: 'Prijave trenutno nisu dostupne dok se ne poveže autentifikacija korisnika.'
  });
}

module.exports = {
  createApplication
};
