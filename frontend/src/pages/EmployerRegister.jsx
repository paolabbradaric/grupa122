import GoogleSignIn from '../components/GoogleSignIn';

export default function EmployerRegister({ onPrijava, onKorisnik }) {
  return <GoogleSignIn role="employer" registration onPrijava={onPrijava} onOther={onKorisnik} />;
}
