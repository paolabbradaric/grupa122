import { useEffect, useState } from "react";
import { moderationRequest, verificationLabels } from "../services/moderation";
import "./VerificationRequest.css";

export default function VerificationRequest({ csrfToken }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    moderationRequest("/employer/verification", { signal: controller.signal })
      .then((result) => {
        if (!controller.signal.aborted) {
          setData(result);
          setError("");
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [revision]);
  async function submit() {
    setBusy(true);
    setError("");
    try {
      setData(
        await moderationRequest("/employer/verification", {
          method: "POST",
          body: {},
          csrfToken,
        }),
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const verification = data?.verification;
  return (
    <section className="verification-card" aria-label="Verifikacija tvrtke">
      <h2>Verifikacija poslodavca</h2>
      {error && <p role="alert">{error}</p>}
      {!data ? (
        <p>Verifikacija nije učitana.</p>
      ) : (
        <>
          <p>
            Status:{" "}
            {verificationLabels[verification?.status] || "Nije zatražena"}
          </p>
          {verification?.rejectionReason && (
            <p>Razlog odbijanja: {verification.rejectionReason}</p>
          )}
          {(!verification || verification.status === "rejected") && (
            <>
              <p>
                Prvo spremi aktualne podatke tvrtke, zatim ih pošalji
                administratoru na provjeru.
              </p>
              <button type="button" disabled={busy} onClick={submit}>
                {busy
                  ? "Šaljem…"
                  : verification
                    ? "Ponovno pošalji zahtjev"
                    : "Zatraži verifikaciju"}
              </button>
            </>
          )}
        </>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={() => setRevision((r) => r + 1)}
      >
        Osvježi status
      </button>
    </section>
  );
}
