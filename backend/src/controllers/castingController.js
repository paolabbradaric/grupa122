const { createCastingModel } = require('../models/castingModel');

const textFilters = { location: 200, search: 200, projectType: 20, requirements: 1000 };
const allowedFilters = new Set([...Object.keys(textFilters), 'age']);

function validateCastingFilters(query = {}) {
  const filters = {};
  for (const [key, value] of Object.entries(query)) {
    if (!allowedFilters.has(key)) return { error: 'Nepoznat filtar oglasa.' };
    if (typeof value !== 'string') return { error: 'Filtar mora imati jednu tekstualnu vrijednost.' };
    if (value.length > (textFilters[key] || 10)) return { error: `Filtar ${key} je predugačak.` };
    const trimmed = value.trim();
    if (!trimmed) continue;
    if (key === 'age') {
      if (!/^\d+$/.test(trimmed) || Number(trimmed) < 18 || Number(trimmed) > 2147483647) {
        return { error: 'Dob mora biti cijeli broj od najmanje 18 godina.' };
      }
      filters.age = Number(trimmed);
    } else {
      filters[key] = trimmed;
    }
  }
  return { filters };
}

function createCastingController({ model = createCastingModel() } = {}) {
  return {
    async getAllCastings(req, res) {
      const check = validateCastingFilters(req.query);
      if (check.error) return res.status(400).json({ error: check.error });
      try {
        const { filters } = check;
        return res.json(await model.getPublishedCastings(filters.location, filters.search, filters));
      } catch (error) {
        console.error('Dohvat oglasa nije uspio:', error.code || 'INTERNAL_ERROR');
        return res.status(500).json({ error: 'Nije moguće dohvatiti casting oglase.' });
      }
    },
    async getCastingById(req, res) {
      const rawId = req.params.id;
      const id = Number(rawId);
      if (!/^\d+$/.test(rawId) || !Number.isSafeInteger(id) || id <= 0 || id > 2147483647) {
        return res.status(400).json({ error: 'Neispravan ID oglasa.' });
      }
      try {
        const casting = await model.getCastingById(id);
        if (!casting) return res.status(404).json({ error: 'Casting oglas nije pronađen.' });
        return res.json(casting);
      } catch (error) {
        console.error('Dohvat oglasa nije uspio:', error.code || 'INTERNAL_ERROR');
        return res.status(500).json({ error: 'Nije moguće dohvatiti casting oglas.' });
      }
    }
  };
}

module.exports = { validateCastingFilters, createCastingController, ...createCastingController() };
