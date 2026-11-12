'use strict';

const { createCandidateApplicationsModel } = require('../models/candidateApplicationsModel');

function createCandidateApplicationsController({
  model = createCandidateApplicationsModel(), writesEnabled = false
} = {}) {
  return {
    async list(req, res, next) {
      try {
        return res.json({ applications: await model.listMine(req.user.id) });
      } catch (error) {
        return next(error);
      }
    },

    async withdraw(req, res, next) {
      const applicationId = Number(req.params.applicationId);
      if (!Number.isSafeInteger(applicationId) || applicationId <= 0 || applicationId > 2147483647) {
        return res.status(400).json({ error: 'Neispravan ID prijave.' });
      }
      if (!writesEnabled) {
        return res.status(503).json({ error: 'Povlačenje prijava trenutno nije omogućeno.' });
      }
      try {
        const result = await model.withdraw(req.user.id, applicationId);
        const errors = {
          not_found: [404, 'Prijava nije pronađena.'],
          integration_unavailable: [503, 'Sigurno povlačenje prijava trenutno nije dostupno.'],
          invalid_status: [409, 'Prijavu nije moguće povući iz trenutačnog statusa.'],
          active_bookings: [409, 'Prijava ima aktivnu rezervaciju audicije. Povlačenje zahtijeva prethodno otkazivanje rezervacije.']
        };
        if (errors[result.outcome]) {
          const [code, message] = errors[result.outcome];
          return res.status(code).json({ error: message });
        }
        if (result.outcome !== 'withdrawn') {
          return res.status(500).json({ error: 'Povlačenje prijave nije uspjelo.' });
        }
        return res.json({ applicationId: result.applicationId, oldStatus: result.oldStatus, status: result.status });
      } catch (error) {
        return next(error);
      }
    }
  };
}

module.exports = { createCandidateApplicationsController };
