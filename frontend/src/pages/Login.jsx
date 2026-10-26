import { useState } from "react";

function Login({ onPoslodavac, onRegistracija }) {
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
      "Podaci su uneseni. Prijava još nije dostupna jer backend nije povezan.",
    );
  }

  return (
    <main>
      <h1>Prijava korisnika</h1>

      <form onSubmit={handleSubmit} noValidate>
        <div>
          <label htmlFor="username">Korisničko ime</label>
          <input
            id="username"
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
          <label htmlFor="password">Lozinka</label>
          <input
            id="password"
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
          Registriraj se
        </button>
      </p>

      <p>
        <button type="button" onClick={onPoslodavac}>
          Prijava za poslodavce
        </button>
      </p>
    </main>
  );
}

export default Login;
