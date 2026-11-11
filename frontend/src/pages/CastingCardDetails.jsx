import { useEffect, useState } from "react";

function CastingCardDetails({ id }) {
  const [casting, setCasting] = useState(null);

  useEffect(() => {
    fetch("/api/castings/" + id)
      .then(res => res.json())
      .then(data => setCasting(data));
  }, [id]);

  if (casting === null) {
    return <p>Učitavanje oglasa...</p>;
  }

  return (
    <main>
      <h1>{casting.title}</h1>
      <p>Lokacija: {casting.location}</p>
      <p>Opis: {casting.description}</p>
      <p>Broj traženih osoba: {casting.positions_count}</p>
      <p>Rok prijave: {casting.application_deadline}</p>
      <p>Status prijave: {casting.status}</p>
    </main>
  );
}

export default CastingCardDetails;