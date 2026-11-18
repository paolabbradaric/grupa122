import { useEffect, useState } from "react";
import CastingCard from "../components/CastingCard";
import "./Home.css";

function Home({ CastingCardDetails, pretraga = "" }) {
  const [castings, setCastings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [upit, setUpit] = useState("");
  const [tipoviProjekta, setTipoviProjekta] = useState([]);

  useEffect(() => {
    const controller = new AbortController();
    const url = upit ? "/api/castings?" + upit : "/api/castings";

    fetch(url, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error("Greška pri dohvaćanju oglasa.");
        }

        const data = await res.json();

        if (!Array.isArray(data)) {
          throw new Error("Backend nije vratio popis oglasa.");
        }

        return data;
      })
      .then((data) => setCastings(data))
      .catch((error) => {
        if (controller.signal.aborted) return;
        console.error("Greška:", error);
        setError("Nije moguće učitati oglase. Pokušaj ponovno kasnije.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [upit]);

  function promijeniUpit(noviUpit) {
    if (noviUpit === upit) return;

    setLoading(true);
    setError("");
    setUpit(noviUpit);
  }

  function primijeniFiltre(event) {
    event.preventDefault();
    const polja = new FormData(event.currentTarget);
    const parametri = new URLSearchParams();
    setTipoviProjekta(polja.getAll("projectType"));

    for (const [naziv, vrijednost] of polja) {
      const tekst = vrijednost.trim();
      if (tekst && naziv !== "projectType") {
        parametri.set(naziv, tekst);
      }
    }

    promijeniUpit(parametri.toString());
  }

  // Filtriranje oglasa prema upisanom tekstu.
  const tekstPretrage = pretraga.trim().toLowerCase();

  const filtriraniOglasi = castings.filter((casting) => {
    const tip = String(casting.projectType ?? casting.project_type ?? "").toLowerCase();
    if (tipoviProjekta.length > 0 && !tipoviProjekta.includes(tip)) {
      return false;
    }

    const naziv = String(
      casting.projectTitle ?? casting.title ?? "",
    ).toLowerCase();

    const uloga = String(casting.roleTitle ?? "").toLowerCase();

    const lokacija = String(
      casting.location ?? casting.city ?? "",
    ).toLowerCase();

    return (
      naziv.includes(tekstPretrage) ||
      uloga.includes(tekstPretrage) ||
      lokacija.includes(tekstPretrage)
    );
  });

  return (
    <main>
      <h1>Dobrodošli na Cast Me If You Can!</h1>
      <p>Pronađi svoju sljedeću ulogu ili idealnog kandidata.</p>

      <h2>Aktualni casting oglasi</h2>

      <form
        className="casting-filters"
        onSubmit={primijeniFiltre}
        onReset={() => {
          setTipoviProjekta([]);
          promijeniUpit("");
        }}
      >
        <div className="casting-project-field">
          <span>Tip projekta</span>
          <details className="casting-project-types">
            <summary>Odaberi tipove</summary>
            <div className="casting-project-options">
              <label><input name="projectType" type="checkbox" value="film" /> Film</label>
              <label><input name="projectType" type="checkbox" value="commercial" /> Reklama</label>
              <label><input name="projectType" type="checkbox" value="tv" /> TV serija</label>
              <label><input name="projectType" type="checkbox" value="theatre" /> Kazališna predstava</label>
              <label><input name="projectType" type="checkbox" value="music_video" /> Glazbeni spot</label>
            </div>
          </details>
        </div>
        <label>
          Lokacija
          <input name="location" type="text" maxLength={200} placeholder="npr. Zagreb" />
        </label>
        <label>
          Dob
          <input name="age" type="number" min={18} max={2147483647} step={1} />
        </label>
        <label>
          Uvjeti
          <input name="requirements" type="text" maxLength={1000} placeholder="npr. ples" />
        </label>
        <button type="submit">Primijeni filtre</button>
        <button type="reset">Očisti filtre</button>
      </form>

      {loading && <p>Učitavanje oglasa...</p>}

      {!loading && error && <p role="alert">{error}</p>}

      {!loading && !error && filtriraniOglasi.length === 0 && (
        <p>
          {tekstPretrage || upit || tipoviProjekta.length > 0
            ? "Nema oglasa koji odgovaraju pretraživanju."
            : "Trenutno nema objavljenih oglasa."}
        </p>
      )}

      {!loading && !error && filtriraniOglasi.length > 0 && (
        <div className="casting-list">
          {filtriraniOglasi.map((casting) => (
            <CastingCard
              key={casting.id}
              casting={casting}
              onClick={() => CastingCardDetails(casting.id)}
            />
          ))}
        </div>
      )}
    </main>
  );
}

export default Home;
