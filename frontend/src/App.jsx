import { useState } from "react";
import Navbar from "./components/Navbar";
import Login from "./pages/Login";
import EmployerLogin from "./pages/EmployerLogin";
import Register from "./pages/Register";
import EmployerRegister from "./pages/EmployerRegister";
import CandidateProfile from "./pages/CandidateProfile";
import EmployerProfile from "./pages/EmployerProfile";
import CandidateNotifications from "./pages/CandidateNotifications";
import CandidateApplications from "./pages/CandidateApplications";
import "./App.css";
import Home from "./pages/Home";
import MojiOglasi from "./pages/MojiOglasi"
import NoviOglas from "./pages/NoviOglas";
import AdminPanel from "./pages/AdminPanel";
import PregledPrijava from "./pages/PregledPrijava";
import Audicije from "./pages/Audicije";
import CompleteRegistration from "./pages/CompleteRegistration";
import CastingCardDetails from "./pages/CastingCardDetails";
import { useAuth } from "./services/useAuth";

function App() {
  const [stranica, setStranica] = useState("pocetna");
  const [odabraniOglas, setOdabraniOglas] = useState(null);
  const auth = useAuth();
  const candidatePages = ['profil-kandidata', 'obavijesti-kandidata', 'prijave-kandidata'];
  const employerPages = ['profil-poslodavca', 'moji-oglasi', 'novi-oglas', 'pregled-prijava', 'audicije'];
  const allowed = (!candidatePages.includes(stranica) || auth.user?.role === "candidate") &&
   (!employerPages.includes(stranica) || auth.user?.role === "employer") &&
   (stranica !== "admin-panel" || auth.user?.role === "admin");
  const page = allowed ? stranica : 'prijava';

  async function logout() {
    try {
      await auth.logout();
      setStranica('pocetna');
      setOdabraniOglas(null);
    } catch (error) { auth.setError(error.message); }
  }

  if (auth.loading) return <main><p role="status">Provjeravam prijavu…</p></main>;

  return (
    <>
      <Navbar
        user={auth.user}
        onOdjava={logout}
        onPrijava={() => setStranica("prijava")}
        onRegistracija={() => setStranica("registracija")}
        onMojiOglasi={() => setStranica("moji-oglasi")}
        onPocetna={() => setStranica("pocetna")}
        onProfilKandidata={() => setStranica("profil-kandidata")}
        onProfilPoslodavca={() => setStranica("profil-poslodavca")}
        onObavijestiKandidata={() => setStranica("obavijesti-kandidata")}
        onPrijaveKandidata={() => setStranica("prijave-kandidata")}
        onAdminPanel={() => setStranica("admin-panel")}
      />

      {auth.error && <p role="alert">{auth.error}</p>}
      {auth.onboardingRequired ? (
        <CompleteRegistration identity={auth.identity} onComplete={auth.completeProfile} onCancel={logout} />
      ) : page === "prijava" ? (
        <Login
          onPoslodavac={() => setStranica("prijava-poslodavac")}
          onRegistracija={() => setStranica("registracija")}
        />
      ) : page === "prijava-poslodavac" ? (
        <EmployerLogin
          onKorisnik={() => setStranica("prijava")}
          onRegistracija={() => setStranica("registracija-poslodavac")}
        />
      ) : page === "registracija" ? (
        <Register onPrijava={() => setStranica("prijava")} onPoslodavac={() => setStranica("registracija-poslodavac")} />
      ) : page === "registracija-poslodavac" ? (
        <EmployerRegister onPrijava={() => setStranica("prijava-poslodavac")} onKorisnik={() => setStranica("registracija")} />
      ) : page === "profil-kandidata" ? (
        <CandidateProfile key={auth.user.id} user={auth.user} />
      ) : page === "profil-poslodavca" ? (
        <EmployerProfile key={auth.user.id} user={auth.user} />
      ) : page === "obavijesti-kandidata" ? (
        <CandidateNotifications />
      ) : page === "prijave-kandidata" ? (
        <CandidateApplications />
      ) : page === "admin-panel" ? (
        <AdminPanel />
      ) : page === "moji-oglasi" ? (
        <MojiOglasi csrfToken={auth.csrfToken} onNoviOglas={() => {
          setOdabraniOglas(null);
          setStranica("novi-oglas");
        }} onUrediOglas={(oglas) => {
          setOdabraniOglas(oglas);
          setStranica("novi-oglas");
        }} onPregledPrijava={(oglas) => {
          setOdabraniOglas(oglas);
          setStranica("pregled-prijava");
        }} onAudicije={(oglas) => {
          setOdabraniOglas(oglas);
          setStranica("audicije");
        }} />
      ) : page === "novi-oglas" ? (
        <NoviOglas 
          key={odabraniOglas?.id ?? "novi"}
          onMojiOglasi={() => setStranica("moji-oglasi")} 
          oglasZaUredivanje={odabraniOglas}
          csrfToken={auth.csrfToken}
        />
      ) : page === "pregled-prijava" ? (
        <PregledPrijava
          key={odabraniOglas?.id}
          oglas={odabraniOglas}
          csrfToken={auth.csrfToken}
          onMojiOglasi={() => setStranica("moji-oglasi")}
        />
      ) : page === "detalji" ? (
        <CastingCardDetails id={odabraniOglas} />
      ) : page === "audicije" ? (
        <Audicije
          key={odabraniOglas?.id}
          oglas={odabraniOglas}
          csrfToken={auth.csrfToken}
          onMojiOglasi={() => setStranica("moji-oglasi")}
        />
      ) : (
        <Home 
          CastingCardDetails={(id) =>{
            setOdabraniOglas(id);
            setStranica("detalji");
          }}
        />
      )}
    </>
  );
}

export default App;
