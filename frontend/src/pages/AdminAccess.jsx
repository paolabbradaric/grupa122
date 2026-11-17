import { useEffect, useState } from 'react';
import AdminPanel from './AdminPanel';

export default function AdminAccess() {
  const [access, setAccess] = useState('checking');
  useEffect(() => {
    let controller;
    let active = true;
    async function check(hide = false) {
      controller?.abort();
      const request = new AbortController();
      controller = request;
      if (hide) setAccess('checking');
      const timeout = window.setTimeout(() => {
        if (active && controller === request && !request.signal.aborted) {
          setAccess('error');
          request.abort();
        }
      }, 10000);
      try {
        const response = await fetch('/api/admin/session', {
          credentials: 'same-origin', cache: 'no-store', signal: request.signal,
        });
        const data = await response.json();
        if (active && !request.signal.aborted) {
          setAccess(response.ok && data.admin === true ? 'allowed'
            : response.status === 401 ? 'login' : response.status === 403 ? 'forbidden' : 'error');
        }
      } catch {
        if (active && !request.signal.aborted) setAccess('error');
      } finally {
        window.clearTimeout(timeout);
      }
    }
    const onFocus = () => { void check(true); };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void check(true);
      else { controller?.abort(); setAccess('checking'); }
    };
    void check();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void check();
    }, 15000);
    window.addEventListener('focus', onFocus);
    window.addEventListener('pageshow', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      active = false;
      controller?.abort();
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('pageshow', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  if (access === 'checking') return <main><p role="status">Provjeravam administratorski pristup…</p></main>;
  if (access === 'login') return <main><h1>Prijava</h1><p>Za administratorski pristup prijavi se Google računom.</p>
    <a href="/api/auth/google">Nastavi s Googleom</a></main>;
  if (access === 'forbidden') return <main><h1>Pristup nije dopušten</h1><p>Ova sesija nema administratorske ovlasti.</p>
    <a href="/api/auth/google">Ponovno se prijavi putem Googlea</a></main>;
  if (access === 'error') return <main><p role="alert">Nije moguće provjeriti pristup. Osvježi stranicu i pokušaj ponovno.</p></main>;
  return <AdminPanel />;
}
