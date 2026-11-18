import { useState } from "react";
import "./CompleteRegistration.css";

function isAdult(birthDate) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return false;

  const birth = new Date(`${birthDate}T00:00:00Z`);

  if (
    Number.isNaN(birth.getTime()) ||
    birth.toISOString().slice(0, 10) !== birthDate ||
    birth.getUTCFullYear() < 1900
  ) {
    return false;
  }

  const today = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Zagreb",
  }).format(new Date());

  const adultDate = `${Number(birthDate.slice(0, 4)) + 18}${birthDate.slice(4)}`;

  return adultDate <= today;
}

function validOib(oib) {
  if (!/^\d{11}$/.test(oib)) return false;

  let check = 10;

  for (const digit of oib.slice(0, 10)) {
    check = (check + Number(digit)) % 10 || 10;
    check = (check * 2) % 11;
  }

  return (11 - check) % 10 === Number(oib[10]);
}

export default function CompleteRegistration({
  identity,
  onComplete,
  onCancel,
}) {
  const [data, setData] = useState(() => ({
    role:
      sessionStorage.getItem("registrationRole") === "employer"
        ? "employer"
        : "candidate",
    firstName: identity?.firstName || "",
    lastName: identity?.lastName || "",
    birthDate: "",
    companyName: "",
    regNum: "",
    contactEmail: identity?.email || "",
    phone: "",
    location: "",
  }));

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function update(event) {
    const { name, value } = event.target;

    setData((previous) => ({
      ...previous,
      [name]: value,
    }));

    setError("");
  }

  function validate() {
    if (!data.firstName.trim()) {
      return "Unesi ime.";
    }

    if (!data.lastName.trim()) {
      return "Unesi prezime.";
    }

    if (!isAdult(data.birthDate)) {
      return "Unesi ispravan datum rođenja. Registracija je dopuštena samo punoljetnim osobama (18+).";
    }

    if (data.role === "employer") {
      if (!data.companyName.trim()) {
        return "Unesi naziv tvrtke.";
      }

      if (!validOib(data.regNum.trim())) {
        return "Unesi ispravan OIB tvrtke (11 znamenki s ispravnom kontrolnom znamenkom).";
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.contactEmail.trim())) {
        return "Unesi ispravan kontakt e-mail.";
      }

      if (!/^\+?[\d\s()/.-]{6,30}$/.test(data.phone.trim())) {
        return "Unesi ispravan broj telefona.";
      }

      if (!data.location.trim()) {
        return "Unesi sjedište tvrtke.";
      }
    }

    return "";
  }

  async function submit(event) {
    event.preventDefault();

    if (saving) return;

    setError("");

    const validationError = validate();

    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);

    try {
      const payload = {
        role: data.role,
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        birthDate: data.birthDate,
      };

      if (data.role === "employer") {
        Object.assign(payload, {
          companyName: data.companyName.trim(),
          regNum: data.regNum.trim(),
          contactEmail: data.contactEmail.trim(),
          phone: data.phone.trim(),
          location: data.location.trim(),
        });
      }

      await onComplete(payload);
    } catch (err) {
      setError(err.message || "Registracija nije uspjela. Pokušaj ponovno.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="complete-registration-page">
      <h1>Dovrši registraciju</h1>

      <p>Google račun: {identity?.email}</p>

      <form onSubmit={submit}>
        <fieldset disabled={saving}>
          <legend>Osnovni podaci</legend>

          <div>
            <label htmlFor="registration-role">Vrsta računa</label>

            <select
              id="registration-role"
              name="role"
              value={data.role}
              onChange={update}
            >
              <option value="candidate">Kandidat</option>
              <option value="employer">Poslodavac</option>
            </select>
          </div>

          <div>
            <label htmlFor="first-name">Ime</label>
            <input
              id="first-name"
              name="firstName"
              autoComplete="given-name"
              required
              maxLength={100}
              value={data.firstName}
              onChange={update}
            />
          </div>

          <div>
            <label htmlFor="last-name">Prezime</label>
            <input
              id="last-name"
              name="lastName"
              autoComplete="family-name"
              required
              maxLength={100}
              value={data.lastName}
              onChange={update}
            />
          </div>

          <div>
            <label htmlFor="birth-date">Datum rođenja (18+)</label>
            <input
              id="birth-date"
              name="birthDate"
              type="date"
              autoComplete="bday"
              required
              min="1900-01-01"
              value={data.birthDate}
              onChange={update}
            />
          </div>

          {data.role === "employer" && (
            <>
              <div>
                <label htmlFor="company-name">Naziv tvrtke</label>
                <input
                  id="company-name"
                  name="companyName"
                  autoComplete="organization"
                  required
                  maxLength={200}
                  value={data.companyName}
                  onChange={update}
                />
              </div>

              <div>
                <label htmlFor="reg-num">OIB tvrtke</label>
                <input
                  id="reg-num"
                  name="regNum"
                  required
                  inputMode="numeric"
                  pattern="[0-9]{11}"
                  maxLength={11}
                  value={data.regNum}
                  onChange={update}
                />
              </div>

              <div>
                <label htmlFor="contact-email">Kontakt e-mail tvrtke</label>
                <input
                  id="contact-email"
                  name="contactEmail"
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={255}
                  value={data.contactEmail}
                  onChange={update}
                />
              </div>

              <div>
                <label htmlFor="company-phone">Telefon</label>
                <input
                  id="company-phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  required
                  maxLength={30}
                  value={data.phone}
                  onChange={update}
                />
              </div>

              <div>
                <label htmlFor="company-location">Sjedište tvrtke</label>
                <input
                  id="company-location"
                  name="location"
                  required
                  maxLength={255}
                  value={data.location}
                  onChange={update}
                />
              </div>

              <p>
                Registracija tvrtke ne dodjeljuje status verificiranog
                poslodavca.
              </p>
            </>
          )}

          <button type="submit" disabled={saving}>
            {saving ? "Spremanje…" : "Dovrši registraciju"}
          </button>
        </fieldset>

        {error && <p role="alert">{error}</p>}
      </form>

      <button type="button" disabled={saving} onClick={onCancel}>
        Odustani i odjavi se
      </button>
    </main>
  );
}
