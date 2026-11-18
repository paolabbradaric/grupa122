const { AuthError } = require('../auth/errors');
const invalid = message => new AuthError(400, 'INVALID_INPUT', message);

function id(value) {
  if (!/^[1-9]\d*$/.test(String(value)) || Number(value) > 2147483647)
    throw invalid('Neispravan identifikator.');
  return Number(value);
}

function body(value, fields) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).some(key => !fields.includes(key)))
    throw invalid('Zahtjev sadrži neispravna polja.');
  return value;
}

function reason(value) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 2000)
    throw invalid('Unesi razlog, najviše 2000 znakova.');
  return value.trim();
}

function page(query, statuses) {
  const limit = query.limit === undefined ? 50 : id(query.limit);
  const offset = query.offset === undefined ? 0 : Number(query.offset);
  if (limit > 100 || !Number.isSafeInteger(offset) || offset < 0 || offset > 2147483647 ||
      (query.offset !== undefined && !/^\d+$/.test(String(query.offset))) ||
      (query.status !== undefined && !statuses.includes(query.status)))
    throw invalid('Neispravna stranica ili status.');
  return { limit, offset, status: query.status || null };
}

module.exports = { invalid, id, body, reason, page };
