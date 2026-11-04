import GoogleSignIn from '../components/GoogleSignIn';

export default function EmployerLogin({ onKorisnik, onRegistracija }) {
  return <GoogleSignIn role="employer" onOther={onKorisnik} onRegistracija={onRegistracija} />;
}
