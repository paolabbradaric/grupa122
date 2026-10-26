import { useState } from "react";

function EmployerLogin({ onKorisnik, onRegistracija }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [greska, setGreska] = useState("");
  const [poruka, setPoruka] = useState("");

  function handleSubmit(e) {
    e.preventDefault();

    setGreska("");
    setPoruka("");

    if (!username.trim()) {
      setGreska("Unesi korisničko ime.");
      return;
    }

    if (!password) {
      setGreska("Unesi lozinku.");
      return;
    }

    setPoruka(
      "Podaci su uneseni. Prijava poslodavca još nije dostupna jer backend nije povezan.",
    );
  }

  return (
    <main>
      <h1>Prijava za poslodavce</h1>

      <form onSubmit={handleSubmit} noValidate>
        <div>
          <label htmlFor="employer-username">Korisničko ime</label>
          <input
            id="employer-username"
            type="text"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              setGreska("");
              setPoruka("");
            }}
            required
          />
        </div>

        <div>
          <label htmlFor="employer-password">Lozinka</label>
          <input
            id="employer-password"
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setGreska("");
              setPoruka("");
            }}
            required
          />
        </div>

        {greska && (
          <p role="alert" style={{ color: "red" }}>
            {greska}
          </p>
        )}

        {poruka && <p role="status">{poruka}</p>}

        <button type="submit">Prijavi se</button>
      </form>

      <p>
        Još nemaš račun?{" "}
        <button type="button" onClick={onRegistracija}>
          Registriraj poslodavca
        </button>
      </p>

      <p>
        <button type="button" onClick={onKorisnik}>
          Prijava za korisnike
        </button>
      </p>
    </main>
  );
}

export default EmployerLogin;
