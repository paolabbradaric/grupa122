import { useState } from "react";

function Register({ onPrijava }) {
  const [podaci, setPodaci] = useState({
    username: "",
    email: "",
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

    if (!podaci.username.trim()) {
      setGreska("Unesi korisničko ime.");
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
      "Svi podaci su ispravno uneseni. Registracija još nije dostupna jer backend nije povezan.",
    );
  }

  return (
    <main>
      <h1>Registracija kandidata</h1>

      <form onSubmit={handleSubmit} noValidate>
        <div>
          <label htmlFor="reg-username">Korisničko ime</label>
          <input
            id="reg-username"
            type="text"
            name="username"
            value={podaci.username}
            onChange={handleChange}
            required
          />
        </div>

        <div>
          <label htmlFor="reg-email">E-mail</label>
          <input
            id="reg-email"
            type="email"
            name="email"
            value={podaci.email}
            onChange={handleChange}
            required
          />
        </div>

        <div>
          <label htmlFor="reg-password">Lozinka</label>
          <input
            id="reg-password"
            type="password"
            name="password"
            value={podaci.password}
            onChange={handleChange}
            minLength={8}
            required
          />
        </div>

        <div>
          <label htmlFor="reg-confirm">Ponovi lozinku</label>
          <input
            id="reg-confirm"
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

        <button type="submit">Registriraj se</button>
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

export default Register;
