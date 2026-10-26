function CandidateApplications() {
  const prijave = [];

  return (
    <main>
      <h1>Moje prijave</h1>

      {prijave.length === 0 ? (
        <p>Trenutno nemaš prijava na castinge.</p>
      ) : (
        <div>
          {prijave.map((prijava) => (
            <div key={prijava.id}>
              <h3>{prijava.naslov}</h3>
              <p>Lokacija: {prijava.lokacija}</p>
              <p>Datum prijave: {prijava.datumPrijave}</p>
              <p>Status: {prijava.status}</p>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

export default CandidateApplications;
