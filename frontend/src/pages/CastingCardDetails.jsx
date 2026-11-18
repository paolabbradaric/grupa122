import { useEffect, useState } from "react";
import ReportCasting from "../components/ReportCasting";
import { moderationRequest } from "../services/moderation";
import "./CastingCardDetails.css";

function formatirajRok(rok) {
  if (!rok) return "—";

  const datum = new Date(rok);
  if (Number.isNaN(datum.getTime())) {
    return "—";
  }

  const dan = datum.toLocaleDateString("hr-HR", {
    timeZone: "Europe/Zagreb",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).replace(/\s/g, "");
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
    fetch("/api/castings/" + id, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Oglas nije dostupan.");
        return response.json();
      })
      .then((data) => {
        setDeadlineExpired(rokJeIstekao(data.application_deadline));
        setCasting(data);
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoadError(true);
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
    if (!window.confirm("Želiš li poslati prijavu za ovaj oglas?")) return;

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
    return <p role="alert">Oglas nije dostupan.</p>;
  }

  if (casting === null) {
    return <p>Učitavanje oglasa...</p>;
  }

  const imaMjesta = casting.accepted_count < casting.positions_count;
  const gostIliKandidat = !user || user.role === "candidate";
  const prikaziGumb =
    casting.status === "published" && imaMjesta && !deadlineExpired && gostIliKandidat;

  return (
    <main className="casting-details">
      <h1>{casting.title}</h1>
      <p><strong>Lokacija:</strong> {casting.location}</p>
      <p><strong>Opis:</strong> {casting.description}</p>
      <p><strong>Broj traženih osoba:</strong> {casting.positions_count}</p>
      <p><strong>Rok prijave:</strong> {formatirajRok(casting.application_deadline)}</p>
      <p>
        <strong>Status oglasa:</strong>{" "}
        <span className={"casting-status " + casting.status}>
          {casting.status}
        </span>
      </p>
      {prikaziGumb && !submitted && (
        <button className="rokprijave-gumb" type="button" onClick={apply} disabled={submitting}>
          {submitting ? "Slanje prijave…" : "Prijavi se"}
        </button>
      )}
      {submitted && <p role="status">Prijava je uspješno poslana.</p>}
      {applicationError && <p role="alert">{applicationError}</p>}
      {casting.id === Number(id) && ["candidate", "employer"].includes(user?.role) && <ReportCasting key={id} castingId={id} csrfToken={csrfToken} />}
    </main>
  );
}

export default CastingCardDetails;
