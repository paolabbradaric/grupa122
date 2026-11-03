import { useState } from 'react';

export default function CompleteRegistration({ identity, onComplete, onCancel }) {
  const [data, setData] = useState(() => ({
    role: sessionStorage.getItem('registrationRole') === 'employer' ? 'employer' : 'candidate',
    firstName: identity.firstName,
    lastName: identity.lastName,
    birthDate: '',
    companyName: '',
    regNum: '',
    contactEmail: identity.email,
    phone: '',
    location: '',
  }));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const update = event => setData(previous => ({ ...previous, [event.target.name]: event.target.value }));

  async function submit(event) {
    event.preventDefault();
    setError('');
    setSaving(true);
    try { await onComplete(data); }
    catch (error) { setError(error.message); }
    finally { setSaving(false); }
  }

  return (
    <main>
      <h1>Dovrši registraciju</h1>
      <p>Google račun: {identity.email}</p>
      <form onSubmit={submit}>
        <fieldset disabled={saving}>
          <legend>Osnovni podaci</legend>
          <label htmlFor="registration-role">Vrsta računa</label>
          <select id="registration-role" name="role" value={data.role} onChange={update}>
            <option value="candidate">Kandidat</option>
            <option value="employer">Poslodavac</option>
          </select>
          <div><label htmlFor="first-name">Ime</label>
            <input id="first-name" name="firstName" autoComplete="given-name" required maxLength={100} value={data.firstName} onChange={update} /></div>
          <div><label htmlFor="last-name">Prezime</label>
            <input id="last-name" name="lastName" autoComplete="family-name" required maxLength={100} value={data.lastName} onChange={update} /></div>
          <div><label htmlFor="birth-date">Datum rođenja (18+)</label>
            <input id="birth-date" name="birthDate" type="date" autoComplete="bday" required value={data.birthDate} onChange={update} /></div>
          {data.role === 'employer' && <>
            <div><label htmlFor="company-name">Naziv tvrtke</label>
              <input id="company-name" name="companyName" autoComplete="organization" required maxLength={200} value={data.companyName} onChange={update} /></div>
            <div><label htmlFor="reg-num">OIB tvrtke</label>
              <input id="reg-num" name="regNum" required inputMode="numeric" pattern="[0-9]{11}" maxLength={11} value={data.regNum} onChange={update} /></div>
            <div><label htmlFor="contact-email">Kontakt e-mail tvrtke</label>
              <input id="contact-email" name="contactEmail" type="email" autoComplete="email" required maxLength={255} value={data.contactEmail} onChange={update} /></div>
            <div><label htmlFor="company-phone">Telefon</label>
              <input id="company-phone" name="phone" type="tel" autoComplete="tel" required maxLength={30} value={data.phone} onChange={update} /></div>
            <div><label htmlFor="company-location">Sjedište tvrtke</label>
              <input id="company-location" name="location" required maxLength={255} value={data.location} onChange={update} /></div>
            <p>Registracija tvrtke ne dodjeljuje status verificiranog poslodavca.</p>
          </>}
          <button type="submit">{saving ? 'Spremanje…' : 'Dovrši registraciju'}</button>
        </fieldset>
        {error && <p role="alert">{error}</p>}
      </form>
      <button type="button" disabled={saving} onClick={onCancel}>Odustani i odjavi se</button>
    </main>
  );
}
