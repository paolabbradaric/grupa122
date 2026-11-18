import { useEffect, useState } from "react";
import { moderationRequest } from "../services/moderation";
import "./CandidateNotifications.css";

function formatirajDatum(datum) {
  if (!datum) return "—";
  const d = new Date(datum);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("hr-HR", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Europe/Zagreb",
      });
}

function CandidateNotifications({ csrfToken }) {
  const [obavijesti, setObavijesti] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    const controller = new AbortController();

    async function ucitaj() {
      try {
        const sve = [];
        let before = null;

        // Backend vraća najviše 100 obavijesti po zahtjevu.
        while (!controller.signal.aborted) {
          const path = before
            ? `/notifications?limit=100&before=${before}`
            : "/notifications?limit=100";

          const data = await moderationRequest(path, {
            signal: controller.signal,
          });

          const batch = data.notifications ?? [];
          sve.push(...batch);

          if (batch.length < 100) break;
          before = batch[batch.length - 1].id;
        }

        if (!controller.signal.aborted) {
          setObavijesti(sve);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err.message);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    ucitaj();
    return () => controller.abort();
  }, []);

  async function oznaciProcitano(id) {
    setBusyId(id);
    setError("");

    try {
      await moderationRequest(`/notifications/${id}/read`, {
        method: "PATCH",
        csrfToken,
      });

      setObavijesti((prethodne) =>
        prethodne.map((obavijest) =>
          obavijest.id === id ? { ...obavijest, isRead: true } : obavijest,
        ),
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  const brojNeprocitanih = obavijesti.filter(
    (obavijest) => !obavijest.isRead,
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

        {error && <p role="alert">{error}</p>}

        {loading ? (
          <p role="status">Učitavanje obavijesti...</p>
        ) : obavijesti.length === 0 && !error ? (
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
                  obavijest.isRead ? "notification-read" : "notification-unread"
                }`}
              >
                <div className="notification-card-top">
                  <span className="notification-type">OBAVIJEST</span>

                  {!obavijest.isRead && (
                    <span className="notification-new">Novo</span>
                  )}
                </div>

                <h2>{obavijest.title}</h2>

                <p className="notification-message">{obavijest.message}</p>

                <div className="notification-card-bottom">
                  <span className="notification-date">
                    {formatirajDatum(obavijest.createdAt)}
                  </span>

                  {!obavijest.isRead && (
                    <button
                      type="button"
                      className="notification-read-button"
                      disabled={busyId !== null}
                      onClick={() => oznaciProcitano(obavijest.id)}
                    >
                      {busyId === obavijest.id
                        ? "Spremanje..."
                        : "Označi kao pročitano"}
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
