import { useEffect, useState } from "react";
import Navbar from "./components/Navbar";
import Login from "./pages/Login";
import EmployerLogin from "./pages/EmployerLogin";
import Register from "./pages/Register";
import EmployerRegister from "./pages/EmployerRegister";
import CandidateProfile from "./pages/CandidateProfile";
import EmployerProfile from "./pages/EmployerProfile";
import CandidateNotifications from "./pages/CandidateNotifications";
import CandidateApplications from "./pages/CandidateApplications";
import Home from "./pages/Home";
import MojiOglasi from "./pages/MojiOglasi";
import NoviOglas from "./pages/NoviOglas";
import AdminAccess from "./pages/AdminAccess";
import PregledPrijava from "./pages/PregledPrijava";
import Audicije from "./pages/Audicije";
import CompleteRegistration from "./pages/CompleteRegistration";
import CastingCardDetails from "./pages/CastingCardDetails";
import { useAuth } from "./services/useAuth";
import "./App.css";

function readPage() {
  return window.location.pathname.replace(/\/+$/, "") === "/admin"
    ? "admin-panel"
    : window.history.state?.page || "pocetna";
}

function App() {
  const auth = useAuth();

  if (auth.loading) {
    return (
      <main>
        <p role="status">Provjeravam prijavu…</p>
      </main>
    );
  }

  return <Application auth={auth} />;
}

function Application({ auth }) {
  const [stranica, updatePage] = useState(() =>
    readPage() === "pocetna" && auth.admin ? "admin-panel" : readPage(),
  );

  const [odabraniOglas, setOdabraniOglas] = useState(null);

  // Zajednicka pretraga za Navbar i prikaz oglasa.
  const [pretraga, setPretraga] = useState("");

  useEffect(() => {
    if (stranica === "admin-panel" && window.location.pathname !== "/admin") {
      window.history.replaceState({ page: "admin-panel" }, "", "/admin");
    }

    const onPopState = () => updatePage(readPage());

    window.addEventListener("popstate", onPopState);

    return () => window.removeEventListener("popstate", onPopState);
  }, [stranica]);

  function setStranica(page) {
    if (page !== stranica) {
      window.history.pushState(
        { page },
        "",
        page === "admin-panel" ? "/admin" : "/",
      );
    }

    updatePage(page);
  }

  const candidatePages = [
    "profil-kandidata",
    "obavijesti-kandidata",
    "prijave-kandidata",
  ];

  const employerPages = [
    "profil-poslodavca",
    "moji-oglasi",
    "novi-oglas",
    "pregled-prijava",
    "audicije",
  ];

  const allowed =
    (!candidatePages.includes(stranica) || auth.user?.role === "candidate") &&
    (!employerPages.includes(stranica) || auth.user?.role === "employer");

  const page = allowed ? stranica : "prijava";

  // Pretraga za poslodavca vodi na njegove oglase,
  // a za gosta i kandidata na pocetnu stranicu.
  function handlePretraga(tekst) {
    setPretraga(tekst);

    const cilj = auth.user?.role === "employer" ? "moji-oglasi" : "pocetna";

    if (page !== cilj) {
      setStranica(cilj);
    }
  }

  async function logout() {
    try {
      await auth.logout();
      setPretraga("");
      setStranica("pocetna");
      setOdabraniOglas(null);
    } catch (error) {
      auth.setError(error.message);
    }
  }

  return (
    <>
      <Navbar
        user={auth.user}
        admin={auth.admin}
        pretraga={pretraga}
        onPretraga={handlePretraga}
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
        <CompleteRegistration
          identity={auth.identity}
          onComplete={auth.completeProfile}
          onCancel={logout}
        />
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
        <Register
          onPrijava={() => setStranica("prijava")}
          onPoslodavac={() => setStranica("registracija-poslodavac")}
        />
      ) : page === "registracija-poslodavac" ? (
        <EmployerRegister
          onPrijava={() => setStranica("prijava-poslodavac")}
          onKorisnik={() => setStranica("registracija")}
        />
      ) : page === "profil-kandidata" ? (
        <CandidateProfile
          key={auth.user.id}
          user={auth.user}
          csrfToken={auth.csrfToken}
          onUserUpdated={auth.updateUser}
        />
      ) : page === "profil-poslodavca" ? (
        <EmployerProfile
          key={auth.user.id}
          user={auth.user}
          csrfToken={auth.csrfToken}
          onUserUpdated={auth.updateUser}
        />
      ) : page === "obavijesti-kandidata" ? (
        <CandidateNotifications />
      ) : page === "prijave-kandidata" ? (
        <CandidateApplications />
      ) : page === "admin-panel" ? (
        <AdminAccess csrfToken={auth.csrfToken} />
      ) : page === "moji-oglasi" ? (
        <MojiOglasi
          pretraga={pretraga}
          csrfToken={auth.csrfToken}
          onNoviOglas={() => {
            setOdabraniOglas(null);
            setStranica("novi-oglas");
          }}
          onUrediOglas={(oglas) => {
            setOdabraniOglas(oglas);
            setStranica("novi-oglas");
          }}
          onPregledPrijava={(oglas) => {
            setOdabraniOglas(oglas);
            setStranica("pregled-prijava");
          }}
          onAudicije={(oglas) => {
            setOdabraniOglas(oglas);
            setStranica("audicije");
          }}
        />
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
        <CastingCardDetails
          id={odabraniOglas}
          user={auth.user}
          csrfToken={auth.csrfToken}
        />
      ) : page === "audicije" ? (
        <Audicije
          key={odabraniOglas?.id}
          oglas={odabraniOglas}
          csrfToken={auth.csrfToken}
          onMojiOglasi={() => setStranica("moji-oglasi")}
        />
      ) : (
        <Home
          pretraga={pretraga}
          CastingCardDetails={(id) => {
            setOdabraniOglas(id);
            setStranica("detalji");
          }}
        />
      )}
    </>
  );
}

export default App;
