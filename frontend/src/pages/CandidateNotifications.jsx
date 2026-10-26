import { useState } from "react";

function CandidateNotifications() {
  const [obavijesti, setObavijesti] = useState([]);

  function oznaciProcitano(id) {
    setObavijesti((prethodne) =>
      prethodne.map((obavijest) =>
        obavijest.id === id ? { ...obavijest, procitano: true } : obavijest,
      ),
    );
  }

  return (
    <main>
      <h1>Moje obavijesti</h1>

      {obavijesti.length === 0 ? (
        <p>Trenutno nemaš novih obavijesti.</p>
      ) : (
        <div>
          {obavijesti.map((obavijest) => (
            <div key={obavijest.id}>
              <h3>{obavijest.naslov}</h3>
              <p>{obavijest.poruka}</p>
              <p>{obavijest.datum}</p>

              {!obavijest.procitano && (
                <button
                  type="button"
                  onClick={() => oznaciProcitano(obavijest.id)}
                >
                  Označi kao pročitano
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

export default CandidateNotifications;
