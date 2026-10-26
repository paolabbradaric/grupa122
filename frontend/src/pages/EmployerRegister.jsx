import { useState } from 'react'

function EmployerRegister({ onPrijava }) {
  const [podaci, setPodaci] = useState({
    companyName: '',
    oib: '',
    email: '',
    phone: '',
    location: '',
    username: '',
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

    if (!/^\d{11}$/.test(podaci.oib)) {
      setGreska('OIB mora sadržavati točno 11 znamenki.')
      return
    }

    if (podaci.password !== podaci.confirmPassword) {
      setGreska('Lozinke se ne podudaraju.')
      return
    }

    setGreska('')
    alert('Registracija poslodavca bit će dostupna nakon povezivanja s backendom.')
  }

  return (
    <main>
      <h1>Registracija poslodavca</h1>

      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="companyName">Naziv tvrtke</label>
          <input
            id="companyName"
            name="companyName"
            value={podaci.companyName}
            onChange={handleChange}
            required
          />
        </div>

        <div>
          <label htmlFor="oib">OIB</label>
          <input
            id="oib"
            name="oib"
            value={podaci.oib}
            onChange={handleChange}
            maxLength={11}
            inputMode="numeric"
            required
          />
        </div>

        <div>
          <label htmlFor="email">E-mail</label>
          <input
            id="email"
            type="email"
            name="email"
            value={podaci.email}
            onChange={handleChange}
            required
          />
        </div>

        <div>
          <label htmlFor="phone">Broj telefona</label>
          <input
            id="phone"
            type="tel"
            name="phone"
            value={podaci.phone}
            onChange={handleChange}
            required
          />
        </div>

        <div>
          <label htmlFor="location">Sjedište tvrtke</label>
          <input
            id="location"
            name="location"
            value={podaci.location}
            onChange={handleChange}
            required
          />
        </div>

        <div>
          <label htmlFor="employer-reg-username">Korisničko ime</label>
          <input
            id="employer-reg-username"
            name="username"
            value={podaci.username}
            onChange={handleChange}
            required
          />
        </div>

        <div>
          <label htmlFor="employer-reg-password">Lozinka</label>
          <input
            id="employer-reg-password"
            type="password"
            name="password"
            value={podaci.password}
            onChange={handleChange}
            required
          />
        </div>

        <div>
          <label htmlFor="employer-reg-confirm">Ponovi lozinku</label>
          <input
            id="employer-reg-confirm"
            type="password"
            name="confirmPassword"
            value={podaci.confirmPassword}
            onChange={handleChange}
            required
          />
        </div>

        {greska && <p role="alert">{greska}</p>}

        <button type="submit">Registriraj poslodavca</button>
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

export default EmployerRegister