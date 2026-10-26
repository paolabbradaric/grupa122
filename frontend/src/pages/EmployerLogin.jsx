import { useState } from 'react'

function EmployerLogin({ onKorisnik, onRegistracija }) {  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    alert('Prijava poslodavca bit će dostupna nakon povezivanja s backendom.')
  }

  return (
    <main>
      <h1>Prijava za poslodavce</h1>

      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="employer-username">Korisničko ime</label>
          <input
            id="employer-username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>

        <div>
          <label htmlFor="employer-password">Lozinka</label>
          <input
            id="employer-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <button type="submit">Prijavi se</button>
      </form>

      <p>
    Još nemaš račun?{' '}
    <button type="button" onClick={onRegistracija}>
        Registriraj poslodavca
    </button>
    </p>
      <p>
        <button type="button" onClick={onKorisnik}>
            Prijava za korisnike
        </button>
    </p>
    </main>
  )
}

export default EmployerLogin