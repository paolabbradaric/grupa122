import { useState } from "react";

function EmployerRegister({ onPrijava }) {
  const [podaci, setPodaci] = useState({
    companyName: "",
    oib: "",
    email: "",
    phone: "",
    location: "",
    username: "",
    password: "",
    confirmPassword: "",
  });

  const [greska, setGreska] = useState("");
  const [poruka, setPoruka] = useState("");

  function handleChange(e) {
    setPodaci((prethodni) => ({
      ...prethodni,
      [e.target.name]: e.target.value,
    }));

    setGreska("");
    setPoruka("");
  }

  function handleSubmit(e) {
    e.preventDefault();

    setGreska("");
    setPoruka("");

    if (!podaci.companyName.trim()) {
      setGreska("Unesi naziv tvrtke.");
      return;
    }

    if (!/^\d{11}$/.test(podaci.oib.trim())) {
      setGreska("OIB mora sadržavati točno 11 znamenki.");
      return;
    }

    if (!podaci.email.trim()) {
      setGreska("Unesi e-mail adresu.");
      return;
    }

    const emailProvjera = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailProvjera.test(podaci.email.trim())) {
      setGreska("Unesi ispravnu e-mail adresu.");
      return;
    }

    if (!podaci.phone.trim()) {
      setGreska("Unesi broj telefona.");
      return;
    }

    if (!/^\+?[\d\s()/.-]{6,20}$/.test(podaci.phone.trim())) {
      setGreska("Unesi ispravan broj telefona.");
      return;
    }

    if (!podaci.location.trim()) {
      setGreska("Unesi sjedište tvrtke.");
      return;
    }

    if (!podaci.username.trim()) {
      setGreska("Unesi korisničko ime.");
      return;
    }

    if (!podaci.password) {
      setGreska("Unesi lozinku.");
      return;
    }

    if (podaci.password.length < 8) {
      setGreska("Lozinka mora imati najmanje 8 znakova.");
      return;
    }

    if (!podaci.confirmPassword) {
      setGreska("Ponovi lozinku.");
      return;
    }

    if (podaci.password !== podaci.confirmPassword) {
      setGreska("Lozinke se ne podudaraju.");
      return;
    }

    setPoruka(
      "Svi podaci su ispravno uneseni. Registracija poslodavca još nije dostupna jer backend nije povezan.",
    );
  }

  return (
    <main>
      <h1>Registracija poslodavca</h1>

      <form onSubmit={handleSubmit} noValidate>
        <div>
          <label htmlFor="companyName">Naziv tvrtke</label>
          <input
            id="companyName"
            name="companyName"
            value={podaci.companyName}
            onChange={handleChange}
            required
          />
        </div>

        <div>
          <label htmlFor="oib">OIB</label>
          <input
            id="oib"
            name="oib"
            value={podaci.oib}
            onChange={handleChange}
            maxLength={11}
            inputMode="numeric"
            required
          />
        </div>

        <div>
          <label htmlFor="email">E-mail</label>
          <input
            id="email"
            type="email"
            name="email"
            value={podaci.email}
            onChange={handleChange}
            required
          />
        </div>

        <div>
          <label htmlFor="phone">Broj telefona</label>
          <input
            id="phone"
            type="tel"
            name="phone"
            value={podaci.phone}
            onChange={handleChange}
            required
          />
        </div>

        <div>
          <label htmlFor="location">Sjedište tvrtke</label>
          <input
            id="location"
            name="location"
            value={podaci.location}
            onChange={handleChange}
            required
          />
        </div>

        <div>
          <label htmlFor="employer-reg-username">Korisničko ime</label>
          <input
            id="employer-reg-username"
            name="username"
            value={podaci.username}
            onChange={handleChange}
            required
          />
        </div>

        <div>
          <label htmlFor="employer-reg-password">Lozinka</label>
          <input
            id="employer-reg-password"
            type="password"
            name="password"
            value={podaci.password}
            onChange={handleChange}
            minLength={8}
            required
          />
        </div>

        <div>
          <label htmlFor="employer-reg-confirm">Ponovi lozinku</label>
          <input
            id="employer-reg-confirm"
            type="password"
            name="confirmPassword"
            value={podaci.confirmPassword}
            onChange={handleChange}
            required
          />
        </div>

        {greska && (
          <p role="alert" style={{ color: "red" }}>
            {greska}
          </p>
        )}

        {poruka && <p role="status">{poruka}</p>}

        <button type="submit">Registriraj poslodavca</button>
      </form>

      <p>
        Već imaš račun?{" "}
        <button type="button" onClick={onPrijava}>
          Prijavi se
        </button>
      </p>
    </main>
  );
}

export default EmployerRegister;
