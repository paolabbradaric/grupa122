import { useEffect, useState } from "react";
import ReportCasting from "../components/ReportCasting";
import { moderationRequest } from "../services/moderation";
import "./CastingCardDetails.css";

function formatirajRok(rok) {
  if (!rok) return "—";

  const datum = new Date(rok);
  if (Number.isNaN(datum.getTime())) return "—";

  const dan = datum
    .toLocaleDateString("hr-HR", {
      timeZone: "Europe/Zagreb",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
    .replace(/\s/g, "");

  const vrijeme = datum.toLocaleTimeString("hr-HR", {
    timeZone: "Europe/Zagreb",
  });

  return dan + " " + vrijeme;
}

function rokJeIstekao(rok) {
  if (rok == null) return false;

  const vrijemeRoka = new Date(rok).getTime();
  return Number.isNaN(vrijemeRoka) || vrijemeRoka <= Date.now();
}

function CastingCardDetails({ id, user, csrfToken, onLogin }) {
  const [casting, setCasting] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [deadlineExpired, setDeadlineExpired] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [applicationError, setApplicationError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    setCasting(null);
    setLoadError(false);
    setSubmitted(false);
    setApplicationError("");

    fetch("/api/castings/" + id, {
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Oglas nije dostupan.");
        }
        return response.json();
      })
      .then((data) => {
        if (controller.signal.aborted) return;

        setDeadlineExpired(rokJeIstekao(data.application_deadline));
        setCasting(data);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setLoadError(true);
        }
      });

    return () => controller.abort();
  }, [id]);

  const deadline = casting?.application_deadline;

  useEffect(() => {
    if (deadline == null || deadlineExpired) return;

    const timer = setInterval(() => {
      if (rokJeIstekao(deadline)) {
        setDeadlineExpired(true);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [deadline, deadlineExpired]);

  async function apply() {
    if (rokJeIstekao(deadline)) {
      setDeadlineExpired(true);
      return;
    }

    if (!user) {
      onLogin();
      return;
    }

    if (!window.confirm("Želiš li poslati prijavu za ovaj oglas?")) {
      return;
    }

    setSubmitting(true);
    setApplicationError("");

    try {
      await moderationRequest(`/castings/${id}/applications`, {
        method: "POST",
        body: {},
        csrfToken,
      });

      setSubmitted(true);
    } catch (error) {
      setApplicationError(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loadError) {
    return (
      <main className="casting-details">
        <div className="casting-details-message" role="alert">
          Oglas nije dostupan.
        </div>
      </main>
    );
  }

  if (casting === null) {
    return (
      <main className="casting-details">
        <div className="casting-details-message" role="status">
          Učitavanje oglasa...
        </div>
      </main>
    );
  }

  const imaMjesta = casting.accepted_count < casting.positions_count;

  const gostIliKandidat = !user || user.role === "candidate";

  const prikaziGumb =
    casting.status === "published" &&
    imaMjesta &&
    !deadlineExpired &&
    gostIliKandidat;

  const statusNaziv = {
    published: "Objavljen",
    draft: "Skica",
    cancelled: "Otkazan",
    closed: "Zatvoren",
  };

  return (
    <main className="casting-details">
      <div className="casting-details-container">
        <header className="casting-details-header">
          <span className="casting-details-label">CAST ME IF YOU CAN</span>

          <h1>{casting.title}</h1>

          <p>
            Saznaj sve informacije o ovom castingu i prijavi se ako ti uloga
            odgovara.
          </p>
        </header>

        <div className="casting-details-layout">
          <section className="casting-details-card">
            <div className="casting-details-card-heading">
              <span className="casting-details-eyebrow">O CASTINGU</span>

              <h2>Detalji oglasa</h2>
            </div>

            <div className="casting-details-info-grid">
              <div className="casting-details-info">
                <span>Lokacija</span>
                <strong>{casting.location || "Nije navedena"}</strong>
              </div>

              <div className="casting-details-info">
                <span>Broj traženih osoba</span>
                <strong>{casting.positions_count}</strong>
              </div>

              <div className="casting-details-info">
                <span>Rok prijave</span>
                <strong>{formatirajRok(casting.application_deadline)}</strong>
              </div>

              <div className="casting-details-info">
                <span>Status oglasa</span>
                <strong className={"casting-status " + casting.status}>
                  {statusNaziv[casting.status] || casting.status}
                </strong>
              </div>
            </div>

            <div className="casting-details-description">
              <h3>Opis castinga</h3>
              <p>{casting.description || "Opis nije naveden."}</p>
            </div>
          </section>

          <aside className="casting-details-sidebar">
            <div className="casting-details-apply-card">
              <span className="casting-details-eyebrow">TVOJA NOVA ULOGA</span>

              <h2>Spreman/na za casting?</h2>

              <p>Ako ti ovaj casting odgovara, pošalji svoju prijavu.</p>

              {prikaziGumb && !submitted && (
                <button
                  className="rokprijave-gumb"
                  type="button"
                  onClick={apply}
                  disabled={submitting}
                >
                  {submitting ? "Slanje prijave…" : "Prijavi se"}
                </button>
              )}

              {submitted && (
                <p className="casting-apply-success" role="status">
                  Prijava je uspješno poslana.
                </p>
              )}

              {applicationError && (
                <p className="casting-apply-error" role="alert">
                  {applicationError}
                </p>
              )}

              {!prikaziGumb && !submitted && !applicationError && (
                <p className="casting-apply-unavailable">
                  Prijava trenutačno nije dostupna.
                </p>
              )}
            </div>

            {casting.id === Number(id) &&
              ["candidate", "employer"].includes(user?.role) && (
                <div className="casting-details-report">
                  <ReportCasting
                    key={id}
                    castingId={id}
                    csrfToken={csrfToken}
                  />
                </div>
              )}
          </aside>
        </div>
      </div>
    </main>
  );
}

export default CastingCardDetails;
