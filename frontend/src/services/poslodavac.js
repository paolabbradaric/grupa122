//Zahtjevi API-ju poslodavca koriste postojeću sesiju i CSRF token.
export async function zahtjevPoslodavca(putanja, { metoda = "GET", csrfToken, signal } = {}) {
    const odgovor = await fetch(`/api/employer${putanja}`, {
        method: metoda, credentials: "same-origin", signal,
        headers: csrfToken ? { "X-CSRF-Token": csrfToken } : {}
    });
    const tekst = await odgovor.text();
    let podaci;
    try { podaci = tekst ? JSON.parse(tekst) : null; }
    catch { throw new Error("Backend nije vratio očekivani odgovor. Provjerite je li pokrenut."); }
    if (!odgovor.ok) {
        if (odgovor.status === 401) throw new Error("Za nastavak se prijavite kao poslodavac.");
        throw new Error(podaci?.error || "Zahtjev nije uspio. Pokušajte ponovno.");
    }
    return podaci;
}
