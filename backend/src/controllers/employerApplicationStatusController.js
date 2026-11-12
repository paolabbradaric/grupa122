
const {
  createEmployerApplicationStatusModel
} = require('../models/employerApplicationStatusModel');

const validStatuses = new Set([
  'UNDER_REVIEW',
  'SHORTLISTED',
  'INVITED',
  'AUDITIONED',
  'REJECTED'
]);


function createEmployerApplicationStatusController({
  model = createEmployerApplicationStatusModel(),
  writesEnabled = false
} = {}) {

  return {
    async changeStatus(req, res, next) {
      const castingId = Number(req.params.id);
      const applicationId = Number(req.params.applicationId);

      if (
        ![castingId, applicationId].every(
          id => Number.isSafeInteger(id) && id > 0
        )
      ) {
        return res.status(400).json({
          error: 'Neispravan ID oglasa ili prijave.'
        });
      }

      const { status, rejectionReason } = req.body || {};

      if (!validStatuses.has(status)) {
        return res.status(400).json({
          error: 'Nedopušten status prijave.'
        });
      }

      if (
        status === 'REJECTED' &&
        (typeof rejectionReason !== 'string' ||
          !rejectionReason.trim())
      ) {
        return res.status(400).json({
          error: 'Razlog odbijanja je obavezan.'
        });
      }

      if (
        rejectionReason !== undefined &&
        (typeof rejectionReason !== 'string' ||
          rejectionReason.length > 2000)
      ) {
        return res.status(400).json({
          error: 'Neispravan razlog odbijanja.'
        });
      }

        if (!writesEnabled) {
        return res.status(503).json({
            error: 'Promjena statusa prijava trenutno nije omogućena.'
        });
        }


      try {
        const result = await model.changeStatus(
          req.user.id,
          castingId,
          applicationId,
          status,
          rejectionReason
        );

        const errors = {
          not_found: [404, 'Oglas nije pronađen.'],
          application_not_found: [404, 'Prijava nije pronađena.'],
          invalid_casting_status: [
            409,
            'Status oglasa ne dopušta promjene prijava.'
          ],
          invalid_transition: [
            409,
            'Nedopušten prijelaz statusa prijave.'
          ],
          reason_required: [
            400,
            'Razlog odbijanja je obavezan.'
          ]
        };

        if (errors[result.outcome]) {
          const [code, message] = errors[result.outcome];

          return res.status(code).json({
            error: message
          });
        }

        if (result.outcome !== 'updated') {
          return res.status(500).json({
            error: 'Promjena statusa nije uspjela.'
          });
        }

        return res.json({
          applicationId: result.applicationId,
          oldStatus: result.oldStatus,
          status: result.newStatus
        });
      } catch (error) {
        return next(error);
      }
    }
  };
}

module.exports = {
  createEmployerApplicationStatusController
};
