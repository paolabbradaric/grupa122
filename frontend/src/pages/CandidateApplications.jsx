import { useEffect, useState } from "react";
import { moderationRequest } from "../services/moderation";
import "./CandidateApplications.css";

const statusi = {
  SUBMITTED: "Prijavljeno",
  UNDER_REVIEW: "U razmatranju",
  SHORTLISTED: "U užem izboru",
  INVITED: "Poziv na audiciju",
  AUDITIONED: "Audicija održana",
  ACCEPTED: "Prihvaćeno",
  SELECTED: "Odabrano",
  REJECTED: "Odbijeno",
  WITHDRAWN: "Povučeno",
  CANCELLED: "Otkazano",
};

const dozvoljenoPovlacenje = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "SHORTLISTED",
  "INVITED",
];

function formatirajDatum(datum) {
  if (!datum) return "—";
  const d = new Date(datum);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("hr-HR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        timeZone: "Europe/Zagreb",
      });
}

function CandidateApplications({ csrfToken }) {
  const [prijave, setPrijave] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    const controller = new AbortController();

    async function ucitaj() {
      try {
        const data = await moderationRequest("/candidate/applications", {
          signal: controller.signal,
        });

        if (!controller.signal.aborted) {
          setPrijave(data.applications ?? []);
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

  async function povuciPrijavu(id) {
    if (!window.confirm("Želiš li povući ovu prijavu?")) {
      return;
    }

    setBusyId(id);
    setError("");
    setMessage("");

    try {
      await moderationRequest(`/candidate/applications/${id}/withdraw`, {
        method: "PATCH",
        csrfToken,
      });

      setPrijave((prethodne) =>
        prethodne.map((prijava) =>
          prijava.id === id ? { ...prijava, status: "WITHDRAWN" } : prijava,
        ),
      );

      setMessage("Prijava je uspješno povučena.");
    } catch (err) {
      setError(
        err.status === 409
          ? "Prijavu nije moguće povući u ovom statusu ili postoji aktivna rezervacija audicije. Ako imaš rezerviran termin, prvo ga otkaži."
          : err.message,
      );
    } finally {
      setBusyId(null);
    }
  }

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

        {error && <p role="alert">{error}</p>}
        {message && <p role="status">{message}</p>}

        {loading ? (
          <p role="status">Učitavanje prijava...</p>
        ) : prijave.length === 0 && !error ? (
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
                  <span className="application-status">
                    {statusi[prijava.status] ?? prijava.status}
                  </span>
                </div>

                <h2>
                  {prijava.roleTitle || prijava.projectTitle || "Casting"}
                </h2>

                <div className="application-details">
                  <p>
                    <strong>Projekt:</strong> {prijava.projectTitle || "—"}
                  </p>
                  <p>
                    <strong>Lokacija:</strong>{" "}
                    {prijava.location || "Nije navedena"}
                  </p>
                  <p>
                    <strong>Datum prijave:</strong>{" "}
                    {formatirajDatum(prijava.submittedAt)}
                  </p>
                </div>

                {dozvoljenoPovlacenje.includes(prijava.status) && (
                  <button
                    type="button"
                    className="application-withdraw-button"
                    disabled={busyId !== null}
                    onClick={() => povuciPrijavu(prijava.id)}
                  >
                    {busyId === prijava.id ? "Povlačenje..." : "Povuci prijavu"}
                  </button>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

export default CandidateApplications;
