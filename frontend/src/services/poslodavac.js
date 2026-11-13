//ahtjevi koriste postojeću sesiju i CSRF token.
export async function zahtjevPoslodavca(
  putanja,
  {
    metoda = "GET",
    csrfToken,
    signal,
    podaci
  } = {}
) {
  const zaglavlja = {};

  if (csrfToken) {
    zaglavlja["X-CSRF-Token"] = csrfToken;
  }

  if (podaci !== undefined) {
    zaglavlja["Content-Type"] = "application/json";
  }

  const odgovor = await fetch(`/api/employer${putanja}`, {
    method: metoda,
    credentials: "same-origin",
    signal,
    headers: zaglavlja,
    body: podaci !== undefined ? JSON.stringify(podaci) : undefined
  });

  const tekst = await odgovor.text();
  let rezultat;

  try {
    rezultat = tekst ? JSON.parse(tekst) : null;
  } catch {
    throw new Error(
      "Backend nije vratio očekivani odgovor. Provjerite je li pokrenut."
    );
  }

  if (!odgovor.ok) {
    if (odgovor.status === 401) {
      throw new Error("Za nastavak se prijavite kao poslodavac.");
    }

    throw new Error(
      rezultat?.error || "Zahtjev nije uspio. Pokušajte ponovno."
    );
  }

  return rezultat;
}