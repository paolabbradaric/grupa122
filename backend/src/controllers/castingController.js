
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

// Omogućujemo route datoteci korištenje funkcije.
module.exports = {
  getAllCastings
};
