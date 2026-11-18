import "./CandidateApplications.css";

function CandidateApplications() {
  const prijave = [];

  return (
    <main className="candidate-applications">
      <div className="applications-container">
        <div className="applications-header">
          <span className="applications-label">CAST ME IF YOU CAN</span>
          <h1>Moje prijave</h1>
          <p>
            Ovdje možeš pratiti sve svoje prijave na castinge i njihove statuse.
          </p>
        </div>

        {prijave.length === 0 ? (
          <div className="applications-empty">
            <div className="applications-empty-icon">♡</div>

            <h2>Još nemaš prijava!</h2>
            <p>
              Pronađi casting koji ti odgovara i napravi prvi korak prema svojoj
              novoj ulozi.
            </p>
          </div>
        ) : (
          <div className="applications-grid">
            {prijave.map((prijava) => (
              <article className="application-card" key={prijava.id}>
                <div className="application-card-top">
                  <span className="application-category">CASTING</span>
                  <span className="application-status">{prijava.status}</span>
                </div>

                <h2>{prijava.naslov}</h2>

                <div className="application-details">
                  <p>
                    <strong>Lokacija:</strong> {prijava.lokacija}
                  </p>
                  <p>
                    <strong>Datum prijave:</strong> {prijava.datumPrijave}
                  </p>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

export default CandidateApplications;
