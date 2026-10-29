
const castingModel = require('../models/castingModel');

// Obrađuje zahtjev za javni popis casting oglasa.
async function getAllCastings(req, res) {
  try {
    // Tražimo od modela da dohvati oglase iz baze.
    const castings = await castingModel.getPublishedCastings();

    // Šaljemo rezultate korisniku u JSON formatu.
    res.json(castings);
  } catch (error) {
    console.error('Greška pri dohvaćanju oglasa:', error);

    // Ako nešto pođe po zlu, vraćamo HTTP 500.
    res.status(500).json({
      error: 'Nije moguće dohvatiti casting oglase.'
    });
  }
}


 // Dohvaća detalje jednog casting oglasa.
async function getCastingById(req, res) {
  try {
    // ID oglasa dolazi iz URL-a.
    const id = Number(req.params.id);

    // Provjeravamo je li ID ispravan pozitivan cijeli broj.
    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(400).json({
        error: 'Neispravan ID oglasa.'
      });
    }

    // Tražimo oglas u bazi.
    const casting = await castingModel.getCastingById(id);

    // Ako oglas ne postoji ili nije objavljen.
    if (!casting) {
      return res.status(404).json({
        error: 'Casting oglas nije pronađen.'
      });
    }

    // Ako postoji, vraćamo ga kao JSON.
    res.json(casting);
  } catch (error) {
    console.error('Greška pri dohvaćanju oglasa:', error);

    res.status(500).json({
      error: 'Nije moguće dohvatiti casting oglas.'
    });
  }
}


// Omogućujemo route datoteci korištenje funkcije.
module.exports = {
  getAllCastings,
  getCastingById
};
