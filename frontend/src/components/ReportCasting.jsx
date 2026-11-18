import { useState } from 'react';
import { moderationRequest } from '../services/moderation';

export default function ReportCasting({ castingId, csrfToken }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault();
    setBusy(true); setError(''); setMessage('');
    try {
      await moderationRequest(`/castings/${castingId}/reports`, {
        method: 'POST', csrfToken, body: { reason },
      });
      setMessage('Prijava je poslana administratoru.'); setReason('');
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  return <section>
    <h2>Prijavi neprimjeren oglas</h2>
    {error && <p role="alert">{error}</p>}
    {message && <p role="status">{message}</p>}
    <form onSubmit={submit}>
      <label htmlFor="report-reason">Razlog prijave</label>
      <textarea id="report-reason" value={reason} onChange={e => setReason(e.target.value)}
        required maxLength={2000} disabled={busy} />
      <button type="submit" disabled={busy || !reason.trim()}>{busy ? 'Šaljem…' : 'Pošalji prijavu'}</button>
    </form>
  </section>;
}
