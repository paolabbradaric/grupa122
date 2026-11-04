import { useEffect, useState } from 'react';
import { authRequest } from './auth';

const guest = { user: null, identity: null, onboardingRequired: false, csrfToken: null };
const oauthErrors = {
  access_denied: 'Google prijava je otkazana. Možeš pokušati ponovno.',
  oauth_failed: 'Google prijava nije uspjela. Pokušaj ponovno.',
};

export function useAuth() {
  const [session, setSession] = useState(guest);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(() => {
    const code = new URLSearchParams(window.location.search).get('authError');
    return code ? oauthErrors[code] || oauthErrors.oauth_failed : '';
  });

  useEffect(() => {
    let active = true;
    const url = new URL(window.location.href);
    if (url.searchParams.has('authError')) {
      url.searchParams.delete('authError');
      window.history.replaceState(null, '', url);
    }
    authRequest('/me')
      .then(data => { if (active) setSession(data); })
      .catch(error => {
        if (active && error.status !== 401) setError('Nije moguće provjeriti prijavu. Osvježi stranicu i pokušaj ponovno.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function completeProfile(profile) {
    const data = await authRequest('/onboarding', { method: 'POST', csrfToken: session.csrfToken, body: profile });
    sessionStorage.removeItem('registrationRole');
    setSession(data);
    setError('');
  }

  async function logout() {
    await authRequest('/logout', { method: 'POST', csrfToken: session.csrfToken });
    sessionStorage.removeItem('registrationRole');
    setSession(guest);
    setError('');
  }

  return { ...session, loading, error, setError, completeProfile, logout };
}
