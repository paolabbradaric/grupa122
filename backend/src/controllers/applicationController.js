
const applicationModel = require('../models/applicationModel');

// Provjera podataka prijave
function validateApplicationData(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return 'Neispravni podaci prijave.';
  }

  const { coverLetter, videoUrl } = body;

  if (
    coverLetter !== undefined &&
    coverLetter !== null &&
    (
      typeof coverLetter !== 'string' ||
      coverLetter.length > 5000
    )
  ) {
    return 'Motivacijsko pismo mora biti tekst do 5000 znakova.';
  }

  if (videoUrl !== undefined && videoUrl !== null) {
    if (
      typeof videoUrl !== 'string' ||
      videoUrl.length > 500
    ) {
      return 'Video poveznica mora biti tekst do 500 znakova.';
    }

    try {
      const url = new URL(videoUrl);

      if (!['https:', 'http:'].includes(url.protocol)) {
        return 'Video poveznica mora koristiti HTTP ili HTTPS.';
      }
    } catch {
      return 'Video poveznica nije ispravna.';
    }
  }

  return null;
}

// Tvornica controllera omogućuje testiranje bez stvarne baze.
// Spremanje je isključeno ako se izričito ne omogući.
function createApplicationHandler({
  model = applicationModel,
  writesEnabled = false
} = {}) {
  return async function createApplication(req, res) {
    try {
      // Provjera ID-ja oglasa
      const castingId = Number(req.params?.id);

      if (!Number.isSafeInteger(castingId) || castingId <= 0) {
        return res.status(400).json({
          error: 'Neispravan ID casting oglasa.'
        });
      }

      // Provjera prijavljenog korisnika
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          error: 'Morate biti prijavljeni za slanje prijave.'
        });
      }

      // Provjera uloge
      if (req.user.role !== 'candidate') {
        return res.status(403).json({
          error: 'Samo kandidati mogu slati prijave na casting.'
        });
      }

      // Provjera poslanih podataka
      const validationError = validateApplicationData(req.body);

      if (validationError) {
        return res.status(400).json({
          error: validationError
        });
      }

      // Dohvaćanje profila kandidata
      const candidate = await model.getCandidateProfileByUserId(userId);

      if (!candidate) {
        return res.status(403).json({
          error: 'Nemate profil kandidata.'
        });
      }

      // Sigurnosna blokada stvarnog spremanja
      if (!writesEnabled) {
        return res.status(503).json({
          error: 'Slanje prijava još nije omogućeno.'
        });
      }

      // Sigurno spremanje unutar transakcije
      const result = await model.createApplicationTransaction(
        candidate.id,
        castingId,
        req.body.coverLetter ?? null,
        req.body.videoUrl ?? null
      );

      // Obrada odbijene prijave
      if (!result.allowed) {
        const statusCode =
          result.message === 'Casting oglas ne postoji.'
            ? 404
            : 409;

        return res.status(statusCode).json({
          error: result.message
        });
      }

      // Uspješno spremljena prijava
      return res.status(201).json({
        message: 'Prijava je uspješno poslana.',
        application: result.application
      });

    } catch (error) {
      console.error('Greška pri prijavi na casting:', error);

      return res.status(500).json({
        error: 'Došlo je do greške pri obradi prijave.'
      });
    }
  };
}

// Stvarna aplikacija: spremanje je zasad ISKLJUČENO.
const createApplication = createApplicationHandler();

module.exports = {
  validateApplicationData,
  createApplicationHandler,
  createApplication
};
