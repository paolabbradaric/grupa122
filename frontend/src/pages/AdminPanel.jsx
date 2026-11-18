import { useEffect, useState } from 'react';
import { moderationRequest, verificationLabels } from '../services/moderation';

const reportLabels = { open: 'Čeka obradu', dismissed: 'Zatvorena bez brisanja', removed: 'Oglas uklonjen' };
const statLabels = {
  ...verificationLabels, ...reportLabels, not_requested: 'Nije zatražena',
  candidate: 'Kandidat', employer: 'Poslodavac', admin: 'Administrator',
  draft: 'Nacrt', published: 'Objavljen', closed: 'Prijave zatvorene', filled: 'Popunjen', cancelled: 'Otkazan',
  SUBMITTED: 'Predana', UNDER_REVIEW: 'U pregledu', SHORTLISTED: 'Uži izbor', INVITED: 'Pozvan na audiciju',
  AUDITIONED: 'Audicija održana', SELECTED: 'Odabran', ACCEPTED: 'Prihvaćen', REJECTED: 'Odbijen',
  WITHDRAWN: 'Povučena', CANCELLED: 'Otkazana',
};
const date = value => value ? new Date(value).toLocaleString('hr-HR') : '—';

export default function AdminPanel({ csrfToken, onDenied }) {
  const [tab, setTab] = useState('verifications');
  const [status, setStatus] = useState('pending');
  const [offset, setOffset] = useState(0);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [action, setAction] = useState(null);
  const [reason, setReason] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const key = `${tab}:${status}:${offset}:${revision}`;
  const loaded = result?.key === key;

  useEffect(() => {
    const controller = new AbortController();
    const path = tab === 'stats' ? '/admin/stats' : `/admin/${tab}?status=${status}&limit=20&offset=${offset}`;
    moderationRequest(path, { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) { setResult({ key, data }); setError(''); } })
      .catch(e => {
        if (controller.signal.aborted) return;
        if ([401, 403].includes(e.status)) onDenied(e.status);
        else { setError(e.message); setResult({ key, data: null }); }
      });
    return () => controller.abort();
  }, [tab, status, offset, key, onDenied]);

  function switchTab(next) {
    setTab(next); setStatus(next === 'reports' ? 'open' : 'pending');
    setOffset(0); setAction(null); setError(''); setMessage('');
  }
  function begin(kind, item) {
    setAction({ kind, item }); setReason(''); setConfirmation(''); setError(''); setMessage('');
  }
  async function run(path, method, body) {
    setBusy(true); setError(''); setMessage('');
    try {
      const data = await moderationRequest(path, { method, body, csrfToken });
      setAction(null);
      setMessage(data.deleted ? `Oglas je obrisan. Datoteka za naknadno čišćenje: ${data.cleanupQueued}.` : 'Promjena je spremljena.');
      setRevision(r => r + 1);
    } catch (e) {
      if ([401, 403].includes(e.status)) onDenied(e.status);
      else setError(e.message);
    } finally { setBusy(false); }
  }
  function submitAction(event) {
    event.preventDefault();
    const { kind, item } = action;
    if (kind === 'delete') return run(`/admin/castings/${item.castingId}`, 'DELETE', { reason, confirmation });
    if (kind === 'reject') return run(`/admin/verifications/${item.id}`, 'PATCH', { status: 'rejected', reason });
    return run(`/admin/reports/${item.id}`, 'PATCH', { status: 'dismissed', reason });
  }
  return <main className="admin-panel">
    <h1>Administracijski panel</h1>
    <div className="admin-navigacija">
      {[['verifications', 'Verifikacija tvrtki'], ['reports', 'Prijave oglasa'], ['stats', 'Statistika']].map(([name, label]) =>
        <button type="button" key={name} disabled={busy || tab === name} onClick={() => switchTab(name)}>{label}</button>)}
      <button type="button" disabled={busy} onClick={() => setRevision(r => r + 1)}>Osvježi</button>
    </div>
    {error && <p role="alert">{error}</p>}
    {message && <p role="status">{message}</p>}
    {tab !== 'stats' && <label>Status:
      <select value={status} disabled={busy} onChange={e => { setStatus(e.target.value); setOffset(0); setAction(null); }}>
        {Object.entries(tab === 'verifications' ? verificationLabels : reportLabels).map(([value, label]) =>
          <option key={value} value={value}>{label}</option>)}
      </select>
    </label>}
    {!loaded ? <p role="status">Učitavam podatke…</p> : result.data && <>
      {tab === 'stats' ? <>
        <p>Aktivni korisnici: {result.data.activeUsers}; deaktivirani: {result.data.disabledUsers}</p>
        <p>Datoteke na čekanju za čišćenje: {result.data.cleanupPending}</p>
        {[['usersByRole', 'Korisnici po ulozi'], ['verifications', 'Posljednje verifikacije aktivnih tvrtki'],
          ['castings', 'Oglasi'], ['applications', 'Prijave kandidata'], ['reports', 'Prijave oglasa']].map(([name, title]) =>
          <section key={name}><h2>{title}</h2>
            <table><thead><tr><th>Status / uloga</th><th>Broj</th></tr></thead><tbody>
              {Object.entries(result.data[name]).map(([label, count]) => <tr key={label}><td>{statLabels[label] || label}</td><td>{count}</td></tr>)}
            </tbody></table>
            {!Object.keys(result.data[name]).length && <p>Nema podataka.</p>}
          </section>)}
      </> : <>
        {!result.data.items.length && <p>Nema zapisa za odabrani status.</p>}
        {result.data.items.map(item => <article className="admin-kartica" key={item.id}>
          <h2>{tab === 'verifications' ? item.companyName : item.castingTitle}</h2>
          <p>Status: {(tab === 'verifications' ? verificationLabels : reportLabels)[item.status]}</p>
          <p>Poslano: {date(item.submittedAt)}</p>
          {tab === 'verifications' ? <>
            <p>OIB: {item.submittedData?.reg_num || item.regNum}</p>
            <p>Kontakt: {item.submittedData?.contact_email || item.contactEmail}</p>
            <p>Telefon: {item.submittedData?.phone || item.phone}; sjedište: {item.submittedData?.location || item.location}</p>
            <p>Naziv pri slanju: {item.submittedData?.company_name || 'Stari zahtjev bez snimke podataka'}</p>
            {item.rejectionReason && <p>Razlog odbijanja: {item.rejectionReason}</p>}
            {item.status === 'pending' && <button type="button" disabled={busy}
              onClick={() => run(`/admin/verifications/${item.id}`, 'PATCH', { status: 'under_review' })}>Preuzmi u provjeru</button>}
            {item.status === 'under_review' && <>
              <p>Administrator koji je preuzeo zahtjev: {item.reviewedBy}</p>
              <button type="button" disabled={busy} onClick={() => run(`/admin/verifications/${item.id}`, 'PATCH', { status: 'approved' })}>Odobri</button>
              <button type="button" disabled={busy} onClick={() => begin('reject', item)}>Odbij uz razlog</button>
            </>}
          </> : <>
            <p>Razlog prijave: {item.reason}</p>
            {item.reviewNote && <p>Odluka: {item.reviewNote}</p>}
            {item.status === 'open' && <>
              <button type="button" disabled={busy} onClick={() => begin('dismiss', item)}>Zatvori bez brisanja</button>
              {item.castingId && <button type="button" disabled={busy} onClick={() => begin('delete', item)}>Obriši oglas</button>}
            </>}
          </>}
        </article>)}
        <button type="button" disabled={busy || offset === 0} onClick={() => setOffset(n => Math.max(0, n - 20))}>Prethodna stranica</button>
        <button type="button" disabled={busy || !result.data.hasMore} onClick={() => setOffset(n => n + 20)}>Sljedeća stranica</button>
      </>}
    </>}
    {action && <form className="admin-obrazac" onSubmit={submitAction}>
      <h2>{action.kind === 'delete' ? 'Potvrda trajnog brisanja' : 'Obrazloženje odluke'}</h2>
      {action.kind === 'delete' && <>
        <p>Oglas „{action.item.castingTitle}”, prijave, termini i rezervacije bit će trajno obrisani. Korisnicima se šalje obavijest u aplikaciji.</p>
        <label htmlFor="delete-confirmation">Upiši OBRIŠI {action.item.castingId}</label>
        <input id="delete-confirmation" value={confirmation} onChange={e => setConfirmation(e.target.value)} required disabled={busy} />
      </>}
      <label htmlFor="admin-reason">Razlog</label>
      <textarea id="admin-reason" value={reason} onChange={e => setReason(e.target.value)} maxLength={2000} required disabled={busy} />
      <button type="submit" disabled={busy || !reason.trim() || (action.kind === 'delete' && confirmation !== `OBRIŠI ${action.item.castingId}`)}>
        {busy ? 'Spremam…' : action.kind === 'delete' ? 'Trajno obriši oglas' : 'Spremi odluku'}
      </button>
      <button type="button" disabled={busy} onClick={() => setAction(null)}>Odustani</button>
    </form>}
  </main>;
}
