'use strict';
const { createEmployerCandidateSelectionModel } = require('../models/employerCandidateSelectionModel');
function createEmployerCandidateSelectionController({ model = createEmployerCandidateSelectionModel(), writesEnabled = false } = {}) {
  return {
    async select(req, res, next) {
      const castingId = Number(req.params.id);
      const applicationId = Number(req.params.applicationId);
      if (![castingId, applicationId].every(x => Number.isSafeInteger(x) && x > 0)) {
        return res.status(400).json({ error: 'Neispravan ID oglasa ili prijave.' });
      }
      if (!writesEnabled) {
        return res.status(503).json({ error: 'Odabir kandidata nije omogucen.' });
      }
      try {
        const result = await model.select(req.user.id, castingId, applicationId);
        const errors = {
          not_found: [404, 'Oglas nije pronaden.'],
          application_not_found: [404, 'Prijava nije pronadena na tom oglasu.'],
          invalid_status: [409, 'Oglas nije otvoren za odabir kandidata.'],
          already_selected: [409, 'Kandidat je vec odabran.'],
          invalid_application_status: [409, 'Prijava nije u statusu SUBMITTED.'],
          positions_filled: [409, 'Sva trazena mjesta vec su popunjena.']
        };
        if (errors[result.outcome]) {
          const [status, message] = errors[result.outcome];
          return res.status(status).json({ error: message });
        }
        if (result.outcome !== 'selected') return res.status(500).json({ error: 'Neuspjesan odabir.' });
        return res.json({ applicationId, applicationStatus: result.status,
          castingId, castingStatus: result.castingStatus,
          selectedCount: result.selectedCount, positionsCount: result.positionsCount });
      } catch (error) {
        return next(error);
      }
    }
  };
}
module.exports = { createEmployerCandidateSelectionController };
