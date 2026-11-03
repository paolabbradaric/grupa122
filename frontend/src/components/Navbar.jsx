import { useState } from 'react';

export default function Navbar({ user, onPrijava, onPocetna, onRegistracija,
  onProfilKandidata, onProfilPoslodavca, onObavijestiKandidata, onPrijaveKandidata, onMojiOglasi, onOdjava }) {
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  function navigate(action) { setOpen(false); action(); }
  async function logout() {
    setLoggingOut(true);
    try { await onOdjava(); setOpen(false); }
    finally { setLoggingOut(false); }
  }
  return (
    <nav className="navbar">
      <button type="button" className="navbar-logo" onClick={onPocetna}>🎬 Cast Me If You Can</button>
      <input type="search" placeholder={user?.role === 'employer' ? 'Pretraži moje oglase...' : 'Pretraži oglase...'} aria-label="Pretraži oglase" />
      <div>
        {!user ? <>
          <button type="button" onClick={onPrijava}>Prijava</button>
          <button type="button" onClick={onRegistracija}>Registracija</button>
        </> : <>
          <span>{user.firstName} · {({ candidate: 'Kandidat', employer: 'Poslodavac', admin: 'Administrator' })[user.role] || 'Korisnik'}</span>
          <div style={{ position: 'relative' }}>
            <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Korisnički izbornik">•••</button>
            {open && <div className="user-menu">
              {user.role === 'candidate' && <>
                <button type="button" onClick={() => navigate(onProfilKandidata)}>Moj profil</button>
                <button type="button" onClick={() => navigate(onPrijaveKandidata)}>Moje prijave</button>
                <button type="button" onClick={() => navigate(onObavijestiKandidata)}>Moje obavijesti</button>
              </>}
              {user.role === 'employer' && <>
                <button type="button" onClick={() => navigate(onProfilPoslodavca)}>Moj profil</button>
                <button type="button" onClick={() => navigate(onMojiOglasi)}>Moji oglasi</button>
              </>}
              <button type="button" disabled={loggingOut} onClick={logout}>{loggingOut ? 'Odjava…' : 'Odjavi se'}</button>
            </div>}
          </div>
        </>}
      </div>
    </nav>
  );
}
