
import CastingCard from "../components/CastingCard";
import "./Home.css";

const castings = [
  {
    id: 1,
    title: "Tražimo glavnog glumca",
    location: "Zagreb",
    description: "Tražimo glumca za kratki film.",
    positions_count: 1,
  },
  {
    id: 2,
    title: "Tražimo statiste",
    location: "Split",
    description: "Tražimo statiste za snimanje reklame.",
    positions_count: 5,
  },
  {
    id: 3,
    title: "Statist u akcijskom filmu",
    location: "Zagreb",
    description: "Tražimo iskusnog statista.",
    positions_count: 1,
  },
  {
    id: 4,
    title: "Glavna uloga u povijesnom filmu",
    location: "Osijek",
    description: "Tražimo žensku glumicu 25-30 godina",
    positions_count: 1,
  }
];

function Home() {
  return (
    <main>
      <h1>Dobrodošli na Cast Me If You Can!</h1>
      <p>Pronađi svoju sljedeću ulogu ili idealnog kandidata.</p>

      <h2>Aktualni casting oglasi</h2>

      <div className="casting-list">
        {castings.map((casting) => (
          <CastingCard
            key={casting.id}
            casting={casting}
            onClick={() => console.log("Oglas:", casting.id)}
          />
        ))}
      </div>
    </main>
  );
}

export default Home;
