import { useState } from 'react'

function Register({ onPrijava }) {
  const [podaci, setPodaci] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  })

  const [greska, setGreska] = useState('')

  function handleChange(e) {
    setPodaci({
      ...podaci,
      [e.target.name]: e.target.value
    })
  }

  function handleSubmit(e) {
    e.preventDefault()

    if (podaci.password !== podaci.confirmPassword) {
      setGreska('Lozinke se ne podudaraju.')
      return
    }

    setGreska('')
    alert('Registracija će raditi nakon povezivanja s backendom.')
  }

  return (
    <main>
      <h1>Registracija kandidata</h1>

      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="reg-username">Korisničko ime</label>
          <input
            id="reg-username"
            type="text"
            name="username"
            value={podaci.username}
            onChange={handleChange}
            required
          />
        </div>

        <div>
          <label htmlFor="reg-email">E-mail</label>
          <input
            id="reg-email"
            type="email"
            name="email"
            value={podaci.email}
            onChange={handleChange}
            required
          />
        </div>

        <div>
          <label htmlFor="reg-password">Lozinka</label>
          <input
            id="reg-password"
            type="password"
            name="password"
            value={podaci.password}
            onChange={handleChange}
            required
          />
        </div>

        <div>
          <label htmlFor="reg-confirm">Ponovi lozinku</label>
          <input
            id="reg-confirm"
            type="password"
            name="confirmPassword"
            value={podaci.confirmPassword}
            onChange={handleChange}
            required
          />
        </div>

        {greska && <p role="alert">{greska}</p>}

        <button type="submit">Registriraj se</button>
      </form>

      <p>
        Već imaš račun?{' '}
        <button type="button" onClick={onPrijava}>
          Prijavi se
        </button>
      </p>
    </main>
  )
}

export default Register