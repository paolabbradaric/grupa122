
const {
  createEmployerApplicationsModel
} = require('../models/employerApplicationsModel');

function createEmployerApplicationsController({
  model = createEmployerApplicationsModel()
} = {}) {
  return {
    async list(req, res, next) {
      const castingId = Number(req.params.id);

      // Provjera je li ID oglasa ispravan.
      if (
        !Number.isSafeInteger(castingId) ||
        castingId <= 0
      ) {
        return res.status(400).json({
          error: 'Neispravan ID oglasa.'
        });
      }

      try {
        const result = await model.listByCasting(
          req.user.id,
          castingId
        );

        // Tuđi ili nepostojeći oglas.
        if (result.outcome === 'not_found') {
          return res.status(404).json({
            error: 'Oglas nije pronađen.'
          });
        }

        return res.json({
          casting: result.casting,
          applications: result.applications
        });
      } catch (error) {
        return next(error);
      }
    }
  };
}

module.exports = {
  createEmployerApplicationsController
};
