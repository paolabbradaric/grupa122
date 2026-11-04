import GoogleSignIn from '../components/GoogleSignIn';

export default function Login({ onPoslodavac, onRegistracija }) {
  return <GoogleSignIn role="candidate" onOther={onPoslodavac} onRegistracija={onRegistracija} />;
}
