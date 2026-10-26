import { useState } from "react";
import ChangePassword from "../components/ChangePassword";

function EmployerProfile() {
  const [podaci, setPodaci] = useState(() => {
    const spremljeno = localStorage.getItem("demoProfilPoslodavca");

    return spremljeno
      ? JSON.parse(spremljeno)
      : {
          nazivTvrtke: "",
          oib: "",
          email: "",
          telefon: "",
          sjediste: "",
        };
  });
  const [logo, setLogo] = useState(null);
  const [statusVerifikacije] = useState("nije-zatrazena");
  const [prikaziLozinku, setPrikaziLozinku] = useState(false);

  function handleChange(e) {
    setPodaci({
      ...podaci,
      [e.target.name]: e.target.value,
    });
  }

  function handleLogo(e) {
    const datoteka = e.target.files[0];

    if (datoteka && !["image/jpeg", "image/png"].includes(datoteka.type)) {
      alert("Logo mora biti JPG ili PNG.");
      e.target.value = "";
      return;
    }

    setLogo(datoteka || null);
  }

  function handleSubmit(e) {
    e.preventDefault();

    if (!/^\d{11}$/.test(podaci.oib)) {
      alert("OIB mora imati točno 11 znamenki.");
      return;
    }

    localStorage.setItem("demoProfilPoslodavca", JSON.stringify(podaci));

    alert("Podaci poslodavca privremeno su spremljeni.");
  }

  function zatraziVerifikaciju() {
    if (
      !podaci.nazivTvrtke ||
      !podaci.oib ||
      !podaci.email ||
      !podaci.sjediste
    ) {
      alert("Prvo ispuni osnovne podatke tvrtke.");
      return;
    }

    if (!/^\d{11}$/.test(podaci.oib)) {
      alert("OIB mora imati točno 11 znamenki.");
      return;
    }

    alert(
      "Zahtjev za verifikaciju bit će poslan nakon povezivanja s backendom.",
    );
  }

  return (
    <main>
      <h1>Moj profil — poslodavac</h1>

      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="logo">Logo tvrtke</label>
          <input
            id="logo"
            type="file"
            accept=".jpg,.jpeg,.png"
            onChange={handleLogo}
          />

          {logo && <p>Odabrano: {logo.name}</p>}
        </div>

        <div>
          <label htmlFor="nazivTvrtke">Naziv tvrtke</label>
          <input
            id="nazivTvrtke"
            name="nazivTvrtke"
            value={podaci.nazivTvrtke}
            onChange={handleChange}
            required
          />
        </div>

        <div>
          <label htmlFor="oib-profil">OIB</label>
          <input
            id="oib-profil"
            name="oib"
            value={podaci.oib}
            onChange={handleChange}
            maxLength={11}
            inputMode="numeric"
            required
          />
        </div>

        <div>
          <label htmlFor="email-profil">E-mail</label>
          <input
            id="email-profil"
            type="email"
            name="email"
            value={podaci.email}
            onChange={handleChange}
            required
          />
        </div>

        <div>
          <label htmlFor="telefon">Broj telefona</label>
          <input
            id="telefon"
            type="tel"
            name="telefon"
            value={podaci.telefon}
            onChange={handleChange}
          />
        </div>

        <div>
          <label htmlFor="sjediste">Sjedište tvrtke</label>
          <input
            id="sjediste"
            name="sjediste"
            value={podaci.sjediste}
            onChange={handleChange}
            required
          />
        </div>

        <button type="submit">Spremi promjene</button>
      </form>

      <h2>Verifikacija poslodavca</h2>

      <p>
        Status:{" "}
        {statusVerifikacije === "nije-zatrazena"
          ? "Nije zatražena"
          : statusVerifikacije === "na-cekanju"
            ? "Na čekanju"
            : statusVerifikacije === "odobrena"
              ? "Odobrena"
              : "Odbijena"}
      </p>

      {statusVerifikacije === "nije-zatrazena" && (
        <button type="button" onClick={zatraziVerifikaciju}>
          Zatraži verifikaciju
        </button>
      )}

      <h2>Sigurnost računa</h2>

      <button type="button" onClick={() => setPrikaziLozinku(!prikaziLozinku)}>
        Promijeni lozinku
      </button>

      {prikaziLozinku && (
        <ChangePassword onZatvori={() => setPrikaziLozinku(false)} />
      )}
    </main>
  );
}

export default EmployerProfile;
