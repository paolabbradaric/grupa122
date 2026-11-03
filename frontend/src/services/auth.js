export async function authRequest(path, { csrfToken, body, ...options } = {}) {
  const response = await fetch(`/api/auth${path}`, {
    credentials: 'same-origin',
    ...options,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error || 'Zahtjev nije uspio.');
    error.status = response.status;
    throw error;
  }
  return data;
}

export function startGoogleLogin(role) {
  // Samo početni izbor obrasca; backend zasebno provjerava dopuštene uloge.
  sessionStorage.setItem('registrationRole', role);
  window.location.assign('/api/auth/google');
}
