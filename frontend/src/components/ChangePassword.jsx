export default function ChangePassword({ onZatvori }) {
  return (
    <section>
      <h2>Sigurnost Google računa</h2>
      <p>Lozinkom i načinima prijave upravljaš na svom Google računu.</p>
      <a href="https://myaccount.google.com/security" target="_blank" rel="noopener noreferrer">Otvori sigurnosne postavke Google računa</a>
      <p><button type="button" onClick={onZatvori}>Zatvori</button></p>
    </section>
  );
}
