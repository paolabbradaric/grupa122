const { createEmployerCastingStatusModel } = require('../models/employerCastingStatusModel');

function createEmployerCastingStatusController({
  model = createEmployerCastingStatusModel(),
  writesEnabled = false
} = {}) {
  function action(method) {
    return async (req, res, next) => {
      const id = Number(req.params.id);
      if (!Number.isSafeInteger(id) || id <= 0) {
        return res.status(400).json({ error: 'Neispravan ID oglasa.' });
      }
      if (!writesEnabled) {
        return res.status(503).json({ error: 'Promjena statusa oglasa nije omogućena.' });
      }
      try {
        const result = await model[method](req.user.id, id);
        if (result.outcome === 'not_found') {
          return res.status(404).json({ error: 'Oglas nije pronađen.' });
        }
        if (result.outcome === 'invalid_status') {
          return res.status(409).json({ error: 'Oglas nije u odgovarajućem statusu.' });
        }
        if (result.outcome === 'active_bookings') {
          return res.status(409).json({
            error: 'Postoje buduće rezervacije audicija. Prije otkazivanja treba ih riješiti s modulom audicija.'
          });
        }
        if (result.outcome !== 'updated') {
          return res.status(500).json({ error: 'Neuspješna promjena statusa.' });
        }
        return res.json({ id, status: result.status });
      } catch (error) {
        return next(error);
      }
    };
  }
  return { close: action('close'), cancel: action('cancel') };
}
module.exports = { createEmployerCastingStatusController };
