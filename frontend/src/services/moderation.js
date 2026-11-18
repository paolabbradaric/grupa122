// Sve promjene koriste postojeću sesiju i CSRF token iz useAuth.
export async function moderationRequest(path, { method = 'GET', body, csrfToken, signal } = {}) {
  const response = await fetch(`/api${path}`, {
    method, credentials: 'same-origin', cache: 'no-store', signal,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data;
  try { data = await response.json(); }
  catch {
    const error = new Error('Backend nije vratio očekivani odgovor. Pokušaj ponovno.');
    error.status = response.status;
    throw error;
  }
  if (!response.ok) {
    const error = new Error(data.error || 'Zahtjev nije uspio. Pokušaj ponovno.');
    error.status = response.status;
    throw error;
  }
  return data;
}
export const verificationLabels = {
  pending: 'Na čekanju', under_review: 'U provjeri', approved: 'Odobrena', rejected: 'Odbijena',
};

// Postojeći panel prikazuje cijele popise; API ih vraća u stranicama.
export async function moderationList(path, signal) {
  const items = [];
  let offset = 0;
  while (!signal.aborted) {
    const separator = path.includes('?') ? '&' : '?';
    const page = await moderationRequest(`${path}${separator}limit=100&offset=${offset}`, { signal });
    items.push(...page.items);
    if (!page.hasMore || !page.items.length) break;
    offset += page.items.length;
  }
  return items;
}
