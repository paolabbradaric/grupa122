const { createEmployerCastingModel } = require('../models/employerCastingModel');

const fields = {
  projectTitle: 200, projectType: 20, projectDescription: 2000,
  roleTitle: 200, roleDescription: 2000, location: 200,
  auditionText: 5000, appearanceReq: 1000, experienceReq: 1000
};
const counts = new Set(['positionsCount', 'maxApplications', 'minAge', 'maxAge']);
const allowed = new Set([...Object.keys(fields), ...counts, 'applicationDeadline']);

function validateDraft(body, creating = false) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Podaci moraju biti JSON objekt.' };
  }
  const keys = Object.keys(body);
  if (!creating && keys.length === 0) return { error: 'Nema promjena.' };
  if (keys.some(key => !allowed.has(key))) return { error: 'Zahtjev sadrži nedopuštena polja.' };
  const data = {};
  for (const key of keys) {
    const value = body[key];
    if (Object.hasOwn(fields, key)) {
      if (value !== null && (typeof value !== 'string' || value.length > fields[key])) {
        return { error: `Neispravno polje ${key}.` };
      }
      // Prazan tekst opcionalnog polja tretiramo kao NULL.
      data[key] = typeof value === 'string' && !value.trim() ? null : value;
    } else if (counts.has(key)) {
      if (value !== null && (!Number.isSafeInteger(value) || value < (key === 'minAge' || key === 'maxAge' ? 18 : 1) ||
          (key === 'maxApplications' && value > 1000))) {
        return { error: `Neispravno polje ${key}.` };
      }
      if (key === 'maxApplications' && value === null) {
        return { error: 'maxApplications ne može biti null.' };
      }
      data[key] = value;
    } else if (key === 'applicationDeadline') {
      if (value === null || value === '') {
        data[key] = null;
      } else if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        const date = new Date(`${value}T23:59:59.999Z`);
        if (!Number.isFinite(date.valueOf()) || date.toISOString().slice(0, 10) !== value) {
          return { error: 'Neispravan datum roka prijave.' };
        }
        data[key] = date.toISOString();
      } else if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
          Number.isFinite(Date.parse(value))) {
        data[key] = new Date(value).toISOString();
      } else return { error: 'Neispravan datum roka prijave.' };
    }
  }
  if (creating && (!data.projectTitle || !data.projectType)) {
    return { error: 'Naziv i vrsta projekta obavezni su čak i za nacrt.' };
  }
  for (const key of ['projectTitle', 'projectType']) {
    if (Object.hasOwn(data, key) && !data[key]) {
      return { error: `${key} ne može biti prazan.` };
    }
  }
  if (data.minAge != null && data.maxAge != null && data.maxAge < data.minAge) {
    return { error: 'Maksimalna dob mora biti veća ili jednaka minimalnoj.' };
  }
  return { data };
}

function createEmployerCastingController({ model = createEmployerCastingModel(), writesEnabled = false } = {}) {
  return {
    async list(req, res, next) {
      try { return res.json(await model.listMine(req.user.id)); }
      catch (error) { return next(error); }
    },
    async create(req, res, next) {
      const check = validateDraft(req.body, true);
      if (check.error) return res.status(400).json({ error: check.error });
      if (!writesEnabled) return res.status(503).json({ error: 'Spremanje nacrta još nije omogućeno.' });
      try {
        const result = await model.createDraft(req.user.id, check.data);
        if (result.outcome === 'no_organisation') return res.status(403).json({ error: 'Nemaš registriranu organizaciju.' });
        return res.status(201).json({ id: result.id, status: 'draft' });
      } catch (error) { return next(error); }
    },
    async publish(req, res, next) {
      const id = Number(req.params.id);
      if (!Number.isSafeInteger(id) || id <= 0) {
        return res.status(400).json({ error: 'Neispravan ID oglasa.' });
      }
      if (!writesEnabled) {
        return res.status(503).json({ error: 'Objavljivanje oglasa još nije omogućeno.' });
      }
      try {
        const result = await model.publishDraft(req.user.id, id);
        if (result.outcome === 'not_found') {
          return res.status(404).json({ error: 'Oglas nije pronađen.' });
        }
        if (result.outcome === 'not_draft') {
          return res.status(409).json({ error: 'Objaviti se može samo nacrt.' });
        }
        if (result.outcome === 'not_verified') {
          return res.status(403).json({ error: 'Organizacija nije verificirana.' });
        }
        if (result.outcome === 'incomplete') {
          return res.status(400).json({ error: 'Za objavu popuni sva obavezna polja i postavi budući rok.' });
        }
        return res.json({ id, status: 'published', published: true });
      } catch (error) {
        return next(error);
      }
    },
    async update(req, res, next) {
      const id = Number(req.params.id);
      if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ error: 'Neispravan ID oglasa.' });
      const check = validateDraft(req.body);
      if (check.error) return res.status(400).json({ error: check.error });
      if (!writesEnabled) return res.status(503).json({ error: 'Uređivanje nacrta još nije omogućeno.' });
      try {
        const result = await model.updateDraft(req.user.id, id, check.data);
        if (result.outcome === 'not_found') return res.status(404).json({ error: 'Oglas nije pronađen.' });
        if (result.outcome === 'not_draft') return res.status(409).json({ error: 'Može se uređivati samo nacrt.' });
        if (result.outcome === 'invalid_ages') return res.status(400).json({ error: 'Neispravan dobni raspon.' });
        return res.json({ id, status: 'draft', updated: true });
      } catch (error) { return next(error); }
    }
  };
}

module.exports = { validateDraft, createEmployerCastingController };
