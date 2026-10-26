import { useState, useRef, useEffect } from "react";
import ChangePassword from "../components/ChangePassword";

const pocetniPodaci = {
  ime: "",
  prezime: "",
  datumRodenja: "",
  grad: "",
  iskustvo: "",
  visina: "",
  tezina: "",
  bojaOciju: "",
  bojaKose: "",
};

function CandidateProfile() {
  const [podaci, setPodaci] = useState(() => {
    try {
      const spremljeno = localStorage.getItem("demoProfilKandidata");
      return spremljeno
        ? { ...pocetniPodaci, ...JSON.parse(spremljeno) }
        : pocetniPodaci;
    } catch {
      return pocetniPodaci;
    }
  });

  const [fotografija, setFotografija] = useState(null);
  const [portfolio, setPortfolio] = useState([]);
  const [prikaziLozinku, setPrikaziLozinku] = useState(false);

  const portfolioInputRef = useRef(null);

  const [portfolioPregledi, setPortfolioPregledi] = useState([]);

  useEffect(() => {
    const pregledi = portfolio.map((file) => ({
      naziv: file.name,
      url: URL.createObjectURL(file),
    }));

    setPortfolioPregledi(pregledi);

    return () => {
      pregledi.forEach((pregled) => {
        URL.revokeObjectURL(pregled.url);
      });
    };
  }, [portfolio]);

  function handleChange(e) {
    const { name, value } = e.target;

    setPodaci((prethodni) => ({
      ...prethodni,
      [name]: value,
    }));
  }

  function handleFotografija(e) {
    const datoteka = e.target.files[0];

    if (datoteka && !["image/jpeg", "image/png"].includes(datoteka.type)) {
      alert("Profilna fotografija mora biti JPG ili PNG.");
      e.target.value = "";
      return;
    }

    setFotografija(datoteka || null);
  }

  function handlePortfolio(e) {
    const datoteke = Array.from(e.target.files);

    if (datoteke.length > 5) {
      alert("Možeš dodati najviše 5 fotografija.");
      e.target.value = "";
      return;
    }

    const neispravne = datoteke.some(
      (file) => !["image/jpeg", "image/png"].includes(file.type),
    );

    if (neispravne) {
      alert("Portfolio može sadržavati samo JPG i PNG fotografije.");
      e.target.value = "";
      return;
    }

    setPortfolio(datoteke);
  }

  function ukloniFotografiju(index) {
    setPortfolio((prethodne) => prethodne.filter((_, i) => i !== index));

    if (portfolioInputRef.current) {
      portfolioInputRef.current.value = "";
    }
  }

  function handleSubmit(e) {
    e.preventDefault();

    localStorage.setItem("demoProfilKandidata", JSON.stringify(podaci));

    alert("Podaci profila privremeno su spremljeni u preglednik.");
  }

  return (
    <main>
      <h1>Moj profil — kandidat</h1>

      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="fotografija">Profilna fotografija</label>
          <input
            id="fotografija"
            type="file"
            accept=".jpg,.jpeg,.png"
            onChange={handleFotografija}
          />

          {fotografija && <p>Odabrano: {fotografija.name}</p>}
        </div>

        <div>
          <label htmlFor="ime">Ime</label>
          <input
            id="ime"
            name="ime"
            value={podaci.ime}
            onChange={handleChange}
            required
          />
        </div>

        <div>
          <label htmlFor="prezime">Prezime</label>
          <input
            id="prezime"
            name="prezime"
            value={podaci.prezime}
            onChange={handleChange}
            required
          />
        </div>

        <div>
          <label htmlFor="datumRodenja">Datum rođenja</label>
          <input
            id="datumRodenja"
            type="date"
            name="datumRodenja"
            value={podaci.datumRodenja}
            onChange={handleChange}
            max={new Date().toISOString().split("T")[0]}
          />
        </div>

        <div>
          <label htmlFor="grad">Grad</label>
          <input
            id="grad"
            name="grad"
            value={podaci.grad}
            onChange={handleChange}
          />
        </div>

        <div>
          <label htmlFor="iskustvo">Iskustvo i vještine</label>
          <textarea
            id="iskustvo"
            name="iskustvo"
            value={podaci.iskustvo}
            onChange={handleChange}
          />
        </div>

        <div>
          <label htmlFor="visina">Visina (cm)</label>
          <input
            id="visina"
            type="number"
            name="visina"
            min="1"
            value={podaci.visina}
            onChange={handleChange}
          />
        </div>

        <div>
          <label htmlFor="tezina">Težina (kg)</label>
          <input
            id="tezina"
            type="number"
            name="tezina"
            min="1"
            value={podaci.tezina}
            onChange={handleChange}
          />
        </div>

        <div>
          <label htmlFor="bojaOciju">Boja očiju</label>
          <select
            id="bojaOciju"
            name="bojaOciju"
            value={podaci.bojaOciju}
            onChange={handleChange}
          >
            <option value="">Odaberi</option>
            <option value="smeđa">Smeđa</option>
            <option value="plava">Plava</option>
            <option value="zelena">Zelena</option>
            <option value="siva">Siva</option>
            <option value="ostalo">Ostalo</option>
          </select>
        </div>

        <div>
          <label htmlFor="bojaKose">Boja kose</label>
          <select
            id="bojaKose"
            name="bojaKose"
            value={podaci.bojaKose}
            onChange={handleChange}
          >
            <option value="">Odaberi</option>
            <option value="smeđa">Smeđa</option>
            <option value="plava">Plava</option>
            <option value="crna">Crna</option>
            <option value="crvena">Crvena</option>
            <option value="sijeda">Sijeda</option>
            <option value="ostalo">Ostalo</option>
          </select>
        </div>

        <div>
          <label htmlFor="portfolio">
            Portfolio (najviše 5 JPG/PNG fotografija)
          </label>

          <input
            ref={portfolioInputRef}
            id="portfolio"
            type="file"
            accept=".jpg,.jpeg,.png"
            multiple
            onChange={handlePortfolio}
          />

          <p>Odabrano fotografija: {portfolio.length}/5</p>

          {portfolioPregledi.map((pregled, index) => (
            <div key={pregled.url}>
              <img
                src={pregled.url}
                alt={`Portfolio fotografija ${index + 1}`}
                width="150"
              />

              <p>{pregled.naziv}</p>

              <button type="button" onClick={() => ukloniFotografiju(index)}>
                Ukloni fotografiju
              </button>
            </div>
          ))}
        </div>

        <button type="submit">Spremi promjene</button>
      </form>

      <button type="button" onClick={() => setPrikaziLozinku(!prikaziLozinku)}>
        Promijeni lozinku
      </button>

      {prikaziLozinku && (
        <ChangePassword onZatvori={() => setPrikaziLozinku(false)} />
      )}
    </main>
  );
}

export default CandidateProfile;
