import { useState } from "react";
import "./CandidateNotifications.css";

function CandidateNotifications() {
  const [obavijesti, setObavijesti] = useState([]);

  function oznaciProcitano(id) {
    setObavijesti((prethodne) =>
      prethodne.map((obavijest) =>
        obavijest.id === id ? { ...obavijest, procitano: true } : obavijest,
      ),
    );
  }

  const brojNeprocitanih = obavijesti.filter(
    (obavijest) => !obavijest.procitano,
  ).length;

  return (
    <main className="candidate-notifications">
      <div className="notifications-container">
        <header className="notifications-header">
          <span className="notifications-label">CAST ME IF YOU CAN</span>

          <h1>Moje obavijesti</h1>

          <p>
            Ovdje možeš pratiti novosti o svojim prijavama i casting pozivima.
          </p>

          {brojNeprocitanih > 0 && (
            <span className="notifications-count">
              {brojNeprocitanih} nepročitanih
            </span>
          )}
        </header>

        {obavijesti.length === 0 ? (
          <div className="notifications-empty">
            <div className="notifications-empty-icon">♡</div>

            <h2>Trenutno nemaš obavijesti!</h2>

            <p>
              Kada stignu novosti o tvojim prijavama ili casting pozivima,
              pronaći ćeš ih ovdje.
            </p>
          </div>
        ) : (
          <div className="notifications-list">
            {obavijesti.map((obavijest) => (
              <article
                key={obavijest.id}
                className={`notification-card ${
                  obavijest.procitano
                    ? "notification-read"
                    : "notification-unread"
                }`}
              >
                <div className="notification-card-top">
                  <span className="notification-type">OBAVIJEST</span>

                  {!obavijest.procitano && (
                    <span className="notification-new">Novo</span>
                  )}
                </div>

                <h2>{obavijest.naslov}</h2>
                <p className="notification-message">{obavijest.poruka}</p>

                <div className="notification-card-bottom">
                  <span className="notification-date">{obavijest.datum}</span>

                  {!obavijest.procitano && (
                    <button
                      type="button"
                      className="notification-read-button"
                      onClick={() => oznaciProcitano(obavijest.id)}
                    >
                      Označi kao pročitano
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

export default CandidateNotifications;
