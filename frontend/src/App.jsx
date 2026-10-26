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

function App() {
  const [stranica, setStranica] = useState("pocetna");

  return (
    <>
      <Navbar
        onPrijava={() => setStranica("prijava")}
        onRegistracija={() => setStranica("registracija")}
        onPocetna={() => setStranica("pocetna")}
        onProfilKandidata={() => setStranica("profil-kandidata")}
        onProfilPoslodavca={() => setStranica("profil-poslodavca")}
        onObavijestiKandidata={() => setStranica("obavijesti-kandidata")}
        onPrijaveKandidata={() => setStranica("prijave-kandidata")}
      />

      {stranica === "prijava" ? (
        <Login
          onPoslodavac={() => setStranica("prijava-poslodavac")}
          onRegistracija={() => setStranica("registracija")}
        />
      ) : stranica === "prijava-poslodavac" ? (
        <EmployerLogin
          onKorisnik={() => setStranica("prijava")}
          onRegistracija={() => setStranica("registracija-poslodavac")}
        />
      ) : stranica === "registracija" ? (
        <Register onPrijava={() => setStranica("prijava")} />
      ) : stranica === "registracija-poslodavac" ? (
        <EmployerRegister onPrijava={() => setStranica("prijava-poslodavac")} />
      ) : stranica === "profil-kandidata" ? (
        <CandidateProfile />
      ) : stranica === "profil-poslodavca" ? (
        <EmployerProfile />
      ) : stranica === "obavijesti-kandidata" ? (
        <CandidateNotifications />
      ) : stranica === "prijave-kandidata" ? (
        <CandidateApplications />
      ) : (
        <main>
          <h1>Dobrodošli na Cast Me If You Can!</h1>
          <p>Pronađi svoju sljedeću ulogu ili idealnog kandidata.</p>
        </main>
      )}
    </>
  );
}

export default App;
