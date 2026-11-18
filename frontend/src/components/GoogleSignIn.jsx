import { useState } from "react";
import { startGoogleLogin } from "../services/auth";
import "./GoogleSignIn.css";

export default function GoogleSignIn({
  role,
  registration = false,
  onPrijava,
  onRegistracija,
  onOther,
}) {
  const [redirecting, setRedirecting] = useState(false);
  const employer = role === "employer";

  return (
    <main className="auth-page">
      <section className="auth-card">
        <span className="auth-label">✦ CAST ME IF YOU CAN ✦</span>

        <div className="auth-decoration">🎬</div>

        <h1>
          {registration ? "Registracija" : "Prijava"}
          <span>{employer ? "poslodavca" : "kandidata"}</span>
        </h1>

        <p className="auth-description">
          Nastavi svojim Google računom.
          {registration && " Zatim dovrši podatke za svoj račun."}
        </p>

        <button
          type="button"
          className="auth-google-button"
          disabled={redirecting}
          onClick={() => {
            setRedirecting(true);
            startGoogleLogin(role);
          }}
        >
          {redirecting ? "Preusmjeravanje…" : "Nastavi s Googleom"}
        </button>

        <div className="auth-links">
          {registration ? (
            <p>
              Već imaš račun?{" "}
              <button type="button" onClick={onPrijava}>
                Prijavi se
              </button>
            </p>
          ) : (
            <p>
              Još nemaš račun?{" "}
              <button type="button" onClick={onRegistracija}>
                Registriraj se
              </button>
            </p>
          )}

          {onOther && (
            <button type="button" className="auth-other-role" onClick={onOther}>
              {registration ? "Registracija" : "Prijava"}{" "}
              {employer ? "za kandidate" : "za poslodavce"}
            </button>
          )}
        </div>
      </section>
    </main>
  );
}
