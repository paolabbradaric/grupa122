const { AuthError } = require('./errors');

function invalid(message) {
  throw new AuthError(400, 'INVALID_PROFILE', message);
}

function text(value, label, max, required = true) {
  if (value == null && !required) return null;
  if (typeof value !== 'string' || (required && !value.trim()) || value.trim().length > max) {
    invalid(`Neispravno polje: ${label}.`);
  }
  return value.trim() || null;
}

function validateProfile(body, now = new Date()) {
  if (!body || !['candidate', 'employer'].includes(body.role)) invalid('Odaberi kandidata ili poslodavca.');
  const result = {
    role: body.role,
    firstName: text(body.firstName, 'ime', 100),
    lastName: text(body.lastName, 'prezime', 100),
    birthDate: text(body.birthDate, 'datum rođenja', 10),
  };
  const birth = new Date(`${result.birthDate}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result.birthDate) || Number.isNaN(birth.getTime()) ||
      birth.toISOString().slice(0, 10) !== result.birthDate || birth.getUTCFullYear() < 1900) {
    invalid('Unesi ispravan datum rođenja.');
  }
  // Poslovni datum je u zoni projekta, ne u vremenskoj zoni poslužitelja.
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Zagreb' }).format(now);
  const adultYear = Number(result.birthDate.slice(0, 4)) + 18;
  const adultDate = `${adultYear}${result.birthDate.slice(4)}`;
  if (adultDate > today) invalid('Registracija je dopuštena samo punoljetnim osobama (18+).');

  if (result.role === 'employer') {
    result.companyName = text(body.companyName, 'naziv tvrtke', 200);
    result.regNum = text(body.regNum, 'OIB', 11);
    if (!/^\d{11}$/.test(result.regNum)) invalid('OIB mora sadržavati točno 11 znamenki.');
    // ISO 7064 MOD 11,10 kontrolna znamenka hrvatskog OIB-a.
    let check = 10;
    for (const digit of result.regNum.slice(0, 10)) {
      check = (check + Number(digit)) % 10 || 10;
      check = (check * 2) % 11;
    }
    if ((11 - check) % 10 !== Number(result.regNum[10])) invalid('Kontrolna znamenka OIB-a nije ispravna.');
    result.contactEmail = text(body.contactEmail, 'kontakt e-mail', 255).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.contactEmail)) invalid('Unesi ispravan kontakt e-mail.');
    result.phone = text(body.phone, 'telefon', 30);
    if (!/^\+?[\d\s()/.-]{6,30}$/.test(result.phone)) invalid('Unesi ispravan broj telefona.');
    result.location = text(body.location, 'sjedište', 255);
  }
  return result;
}

module.exports = { validateProfile };
