import { useEffect, useState } from 'react';
import { moderationRequest, verificationLabels } from '../services/moderation';

const labels = {
  ...verificationLabels, not_requested: 'Nije zatražena',
  candidate: 'Kandidat', employer: 'Poslodavac', admin: 'Administrator',
  draft: 'Nacrt', published: 'Objavljen', closed: 'Prijave zatvorene', filled: 'Popunjen', cancelled: 'Otkazan',
  SUBMITTED: 'Predana', UNDER_REVIEW: 'U pregledu', SHORTLISTED: 'Uži izbor', INVITED: 'Pozvan na audiciju',
  AUDITIONED: 'Audicija održana', SELECTED: 'Odabran', ACCEPTED: 'Prihvaćen', REJECTED: 'Odbijen',
  WITHDRAWN: 'Povučena', CANCELLED: 'Otkazana',
};

export default function ModerationStats({ onDenied }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    moderationRequest('/admin/stats', { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) setData(result); })
      .catch(e => {
        if (controller.signal.aborted) return;
        if ([401, 403].includes(e.status)) onDenied(e.status);
        else setError(e.message);
      });
    return () => controller.abort();
  }, [onDenied]);
  if (error) return <p role="alert">{error}</p>;
  if (!data) return <p role="status">Učitavam statistiku…</p>;
  return <section>
    <h2>Statistika</h2>
    <p>Aktivni korisnici: {data.activeUsers}; deaktivirani: {data.disabledUsers}</p>
    {[['usersByRole', 'Korisnici po ulozi'], ['verifications', 'Verifikacije tvrtki'],
      ['castings', 'Oglasi'], ['applications', 'Prijave kandidata']].map(([name, title]) =>
      <section key={name}><h3>{title}</h3>
        <table><thead><tr><th>Status / uloga</th><th>Broj</th></tr></thead><tbody>
          {Object.entries(data[name]).map(([label, count]) =>
            <tr key={label}><td>{labels[label] || label}</td><td>{count}</td></tr>)}
        </tbody></table>
        {!Object.keys(data[name]).length && <p>Nema podataka.</p>}
      </section>)}
  </section>;
}
