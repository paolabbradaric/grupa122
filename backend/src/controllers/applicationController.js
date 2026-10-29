
const applicationModel = require('../models/applicationModel');

async function createApplication(req, res) {
  try {
    // Provjera ID-ja casting oglasa
    const castingId = Number(req.params.id);

    if (!Number.isSafeInteger(castingId) || castingId <= 0) {
      return res.status(400).json({
        error: 'Neispravan ID casting oglasa.'
      });
    }

    // Ovdje će Mario kasnije povezati OAuth autentifikaciju.
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        error: 'Morate biti prijavljeni za slanje prijave.'
      });
    }

    const candidate = await applicationModel.getCandidateProfileByUserId(userId);

    if (!candidate) {
      return res.status(403).json({
        error: 'Nemate profil kandidata.'
      });
    }

    // Slanje prijave zasad ostaje onemogućeno.
    return res.status(503).json({
      error: 'Slanje prijava još nije omogućeno.'
    });

  } catch (error) {
    console.error('Greška pri prijavi na casting:', error);

    return res.status(500).json({
      error: 'Došlo je do greške pri obradi prijave.'
    });
  }
}

module.exports = {
  createApplication
};
