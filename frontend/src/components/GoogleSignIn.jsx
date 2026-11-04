import { useState } from 'react';
import { startGoogleLogin } from '../services/auth';

export default function GoogleSignIn({ role, registration = false, onPrijava, onRegistracija, onOther }) {
  const [redirecting, setRedirecting] = useState(false);
  const employer = role === 'employer';
  return (
    <main>
      <h1>{registration ? 'Registracija' : 'Prijava'} {employer ? 'poslodavca' : 'kandidata'}</h1>
      <p>Nastavi svojim Google računom.{registration && ' Zatim dovrši podatke za svoj račun.'}</p>
      <button type="button" disabled={redirecting} onClick={() => {
        setRedirecting(true);
        startGoogleLogin(role);
      }}>
        {redirecting ? 'Preusmjeravanje…' : 'Nastavi s Googleom'}
      </button>
      {registration ? (
        <p>Već imaš račun? <button type="button" onClick={onPrijava}>Prijavi se</button></p>
      ) : (
        <p>Još nemaš račun? <button type="button" onClick={onRegistracija}>Registriraj se</button></p>
      )}
      {onOther && <p><button type="button" onClick={onOther}>
        {registration ? 'Registracija' : 'Prijava'} {employer ? 'za kandidate' : 'za poslodavce'}
      </button></p>}
    </main>
  );
}
