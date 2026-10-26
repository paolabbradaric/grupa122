import { useState } from 'react'

function Login({ onPoslodavac, onRegistracija }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    alert('Prijava će raditi kada povežemo backend.')
  }

  return (
    <main>
      <h1>Prijava korisnika</h1>

      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="username">Korisničko ime</label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>

        <div>
          <label htmlFor="password">Lozinka</label>
          <input
            id="password"
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
        Registriraj se
    </button>
    </p>
      <p>
        <button type="button" onClick={onPoslodavac}>
            Prijava za poslodavce
        </button>
    </p>
    </main>
  )
}

export default Login