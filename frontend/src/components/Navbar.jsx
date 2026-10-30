import { useState } from "react";

function Navbar({
  onPrijava,
  onPocetna,
  onRegistracija,
  onMojiOglasi,
  onProfilKandidata,
  onProfilPoslodavca,
  onObavijestiKandidata,
  onPrijaveKandidata,
}) {
  const [uloga, setUloga] = useState("gost");
  const [izbornikOtvoren, setIzbornikOtvoren] = useState(false);

  const izbornici = {
    kandidat: ["Moj profil", "Moje prijave", "Moje obavijesti", "Odjavi se"],
    poslodavac: ["Moj profil", "Moji oglasi", "Moje obavijesti", "Odjavi se"],
    admin: [
      "Moj profil",
      "Zahtjevi",
      "Odbijeni",
      "Prijavljeni",
      "Statistika",
      "Odjavi se",
    ],
  };

  function handleStavka(stavka) {
    if (stavka === "Moj profil") {
      if (uloga === "kandidat") {
        onProfilKandidata();
      }

      if (uloga === "poslodavac") {
        onProfilPoslodavca();
      }
    }

    if (stavka === "Moje obavijesti" && uloga === "kandidat") {
      onObavijestiKandidata();
    }

    if (stavka === "Moje prijave" && uloga === "kandidat") {
      onPrijaveKandidata();
    }

    if (stavka === "Moji oglasi" && uloga === "poslodavac") {
      onMojiOglasi();
    }

    if (stavka === "Odjavi se") {
      setUloga("gost");
      onPocetna();
    }

    setIzbornikOtvoren(false);
  }

  return (
    <nav className="navbar">
      <button type="button" className="navbar-logo" onClick={onPocetna}>
        🎬 Cast Me If You Can
      </button>

      <input
        type="search"
        placeholder={
          uloga === "poslodavac"
            ? "Pretraži moje oglase..."
            : "Pretraži oglase..."
        }
        aria-label="Pretraži oglase"
      />

      <div>
        <select
          value={uloga}
          onChange={(e) => {
            setUloga(e.target.value);
            setIzbornikOtvoren(false);
          }}
        >
          <option value="gost">Gost</option>
          <option value="kandidat">Kandidat</option>
          <option value="poslodavac">Poslodavac</option>
          <option value="admin">Admin</option>
        </select>

        {uloga === "gost" ? (
          <div>
            <button type="button" onClick={onPrijava}>
              Prijava
            </button>

            <button type="button" onClick={onRegistracija}>
              Registracija
            </button>
          </div>
        ) : (
          <div style={{ position: "relative" }}>
            <button
              type="button"
              onClick={() => setIzbornikOtvoren(!izbornikOtvoren)}
              aria-expanded={izbornikOtvoren}
              aria-label="Korisnički izbornik"
            >
              •••
            </button>

            {izbornikOtvoren && (
              <div className="user-menu">
                {izbornici[uloga].map((stavka) => (
                  <button
                    type="button"
                    key={stavka}
                    onClick={() => handleStavka(stavka)}
                  >
                    {stavka}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}

export default Navbar;
