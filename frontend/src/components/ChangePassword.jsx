import { useState } from "react";

function ChangePassword({ onZatvori }) {
  const [staraLozinka, setStaraLozinka] = useState("");
  const [novaLozinka, setNovaLozinka] = useState("");
  const [potvrda, setPotvrda] = useState("");
  const [greska, setGreska] = useState("");

  function handleSubmit(e) {
    e.preventDefault();

    if (novaLozinka.length < 8) {
      setGreska("Nova lozinka mora imati najmanje 8 znakova.");
      return;
    }

    if (novaLozinka !== potvrda) {
      setGreska("Lozinke se ne podudaraju.");
      return;
    }

    if (staraLozinka === novaLozinka) {
      setGreska("Nova lozinka mora biti različita od stare.");
      return;
    }

    setGreska("");
    alert("Promjena lozinke radit će nakon povezivanja s backendom.");
  }

  return (
    <section>
      <h2>Promjena lozinke</h2>

      <form onSubmit={handleSubmit}>
        <div>
          <label>Trenutna lozinka</label>
          <input
            type="password"
            value={staraLozinka}
            onChange={(e) => setStaraLozinka(e.target.value)}
            required
          />
        </div>

        <div>
          <label>Nova lozinka</label>
          <input
            type="password"
            value={novaLozinka}
            onChange={(e) => setNovaLozinka(e.target.value)}
            required
          />
        </div>

        <div>
          <label>Potvrdi novu lozinku</label>
          <input
            type="password"
            value={potvrda}
            onChange={(e) => setPotvrda(e.target.value)}
            required
          />
        </div>

        {greska && <p role="alert">{greska}</p>}

        <button type="submit">Spremi novu lozinku</button>
      </form>

      <button type="button" onClick={onZatvori}>
        Odustani
      </button>
    </section>
  );
}

export default ChangePassword;
