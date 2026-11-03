import GoogleSignIn from '../components/GoogleSignIn';

export default function Register({ onPrijava, onPoslodavac }) {
  return <GoogleSignIn role="candidate" registration onPrijava={onPrijava} onOther={onPoslodavac} />;
}
