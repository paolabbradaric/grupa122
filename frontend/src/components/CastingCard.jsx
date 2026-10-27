import "./CastingCard.css";

function CastingCard({ casting, onClick }) {
  return (
    <div className="casting-card">
      <h2>{casting.title}</h2>

      <p>{casting.location}</p>

      <p>{casting.description}</p>

      <p>
        Traženih osoba: {casting.positions_count}
      </p>

      <button onClick={onClick}>
        Pogledaj detalje
      </button>
    </div>
  );
}

export default CastingCard;
