const { validateProfile } = require("../auth/validation");
const { AuthError } = require("../auth/errors");
const fail = (message) => {
  throw new AuthError(400, "INVALID_PROFILE", message);
};
const candidateFields = {
  firstName: "first_name",
  lastName: "last_name",
  birthDate: "birth_date",
  city: "city",
  experience: "experience",
  heightCm: "height_cm",
  weightKg: "weight_kg",
  eyeColor: "eye_color",
  hairColor: "hair_color",
};
const employerFields = {
  companyName: "company_name",
  regNum: "reg_num",
  contactEmail: "contact_email",
  phone: "phone",
  location: "location",
};
function validatePatch(body, role, current) {
  if (!body || typeof body !== "object" || Array.isArray(body))
    fail("Neispravan profil.");
  const fields = role === "candidate" ? candidateFields : employerFields;
  const result = {};
  for (const [key, value] of Object.entries(body)) {
    if (!Object.hasOwn(fields, key)) fail(`Nedopušteno polje: ${key}.`);
    if (["heightCm", "weightKg"].includes(key)) {
      if (value === null || value === "") {
        result[key] = null;
        continue;
      }
      if (
        typeof value !== "number" ||
        !Number.isFinite(value) ||
        value <= 0 ||
        (key === "heightCm"
          ? !Number.isInteger(value) || value > 2147483647
          : value > 9999.99 ||
            Math.abs(value * 100 - Math.round(value * 100)) > 1e-7)
      )
        fail(`Neispravno polje: ${key}.`);
      result[key] = value;
      continue;
    }
    const max = {
      firstName: 100,
      lastName: 100,
      birthDate: 10,
      city: 100,
      experience: 5000,
      eyeColor: 20,
      hairColor: 20,
      companyName: 200,
      regNum: 11,
      contactEmail: 255,
      phone: 30,
      location: 255,
    }[key];
    const optional = ["city", "experience", "eyeColor", "hairColor"].includes(
      key,
    );
    if (value === null && optional) {
      result[key] = null;
      continue;
    }
    if (
      typeof value !== "string" ||
      value.trim().length > max ||
      (!optional && !value.trim())
    )
      fail(`Neispravno polje: ${key}.`);
    result[key] = value.trim() || null;
    const colors =
      key === "eyeColor"
        ? ["smeđa", "plava", "zelena", "siva", "ostalo"]
        : ["smeđa", "plava", "crna", "crvena", "sijeda", "ostalo"];
    if (
      ["eyeColor", "hairColor"].includes(key) &&
      result[key] &&
      !colors.includes(result[key])
    )
      fail(`Neispravna boja: ${key}.`);
  }
  // Reuse registration's calendar, age, OIB, email and phone rules.
  const merged = { ...current, ...result, role };
  if (role === "employer")
    Object.assign(merged, {
      firstName: "Profil",
      lastName: "Tvrtke",
      birthDate: "1900-01-01",
    });
  // Historical optional phone/location may be absent when they are not edited.
  const valid = validateProfile({
    ...merged,
    phone: Object.hasOwn(result, "phone") ? result.phone : "+385 1 1234567",
    location: Object.hasOwn(result, "location") ? result.location : "Zagreb",
  });
  if (Object.hasOwn(result, "contactEmail"))
    result.contactEmail = valid.contactEmail;
  return result;
}
module.exports = { validatePatch, candidateFields, employerFields };
