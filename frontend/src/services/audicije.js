export async function zahtjevAudicije(
    putanja,
    {
        metoda = "GET",
        csrfToken,
        podaci,
        signal
    } = {}
) {
    if (metoda !== "GET" && !csrfToken) {
        throw new Error(
            "Nedostaje potvrda prijave. Osvježite stranicu i prijavite se."
        );
    }

    const odgovor = await fetch(`/api${putanja}`, {
        method: metoda,
        credentials: "same-origin",
        cache: "no-store",
        signal,
        headers: {
            ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
            ...(podaci !== undefined
                ? { "Content-Type": "application/json" }
                : {})
        },
        body: podaci !== undefined
            ? JSON.stringify(podaci)
            : undefined
    });

    const tekst = await odgovor.text();
    let rezultat;

    try {
        rezultat = tekst ? JSON.parse(tekst) : null;
    } catch {
        throw new Error(
            "Backend nije vratio očekivani odgovor. Osvježite podatke prije ponavljanja radnje."
        );
    }

    if (!odgovor.ok) {
        if (odgovor.status === 401) {
            throw new Error("Prijavite se kao poslodavac.");
        }

        throw new Error(
            rezultat?.error || "Zahtjev nije uspio."
        );
    }

    return rezultat;
}