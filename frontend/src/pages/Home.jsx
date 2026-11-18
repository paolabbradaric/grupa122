import { useEffect, useState } from "react";
import CastingCard from "../components/CastingCard";
import "./Home.css";

function Home({ CastingCardDetails, pretraga = "" }) {
  const [castings, setCastings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/castings")
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
        console.error("Greška:", error);
        setError("Nije moguće učitati oglase. Pokušaj ponovno kasnije.");
      })
      .finally(() => setLoading(false));
  }, []);

  // Filtriranje oglasa prema upisanom tekstu.
  const tekstPretrage = pretraga.trim().toLowerCase();

  const filtriraniOglasi = castings.filter((casting) => {
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

      {loading && <p>Učitavanje oglasa...</p>}

      {!loading && error && <p role="alert">{error}</p>}

      {!loading && !error && filtriraniOglasi.length === 0 && (
        <p>
          {tekstPretrage
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
