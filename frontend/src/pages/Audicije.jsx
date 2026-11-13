import { useRef, useState } from "react";

//upravljanje terminima audicija odabranog oglasa
function Audicije({ oglas, onMojiOglasi, csrfToken }) {
    const [pocetak, setPocetak] = useState("");
    const [zavrsetak, setZavrsetak] = useState("");
    const [lokacija, setLokacija] = useState("");
    const [kapacitet, setKapacitet] = useState("");

    //samo termini dodani tijekom ovog otvaranja stranice
    const [termini, setTermini] = useState([]);

    const [spremanje, setSpremanje] = useState(false);
    const [greska, setGreska] = useState("");
    const [poruka, setPoruka] = useState("");

    //sprječava pokretanje više zahtjeva istodobno
    const zahtjevUTijeku = useRef(false);

    const mozeDodati = oglas?.status === "objavljen";

    //slanje zahtjeva postojećem API-ju audicija
    async function posaljiZahtjev(putanja, metoda, tijelo) {
        if (!csrfToken) {
            throw new Error(
                "Nedostaje potvrda prijave. Osvježite stranicu i prijavite se."
            );
        }

        const odgovor = await fetch(`/api/auditions${putanja}`, {
            method: metoda,
            credentials: "same-origin",
            headers: {
                "X-CSRF-Token": csrfToken,
                ...(tijelo !== undefined
                    ? { "Content-Type": "application/json" }
                    : {})
            },
            ...(tijelo !== undefined
                ? { body: JSON.stringify(tijelo) }
                : {})
        });

        const tekst = await odgovor.text();
        let podaci;

        try {
            podaci = tekst ? JSON.parse(tekst) : null;
        } catch {
            throw new Error(
                "Backend nije vratio očekivani odgovor. Ishod radnje nije potvrđen."
            );
        }

        if (!odgovor.ok) {
            if (odgovor.status === 401) {
                throw new Error(
                    "Za ovu radnju prijavite se kao poslodavac."
                );
            }

            throw new Error(
                podaci?.error || "Zahtjev nije uspio. Pokušajte ponovno."
            );
        }

        return podaci;
    }

    //provjera unosa i priprema podataka za backend
    function pripremiPodatke() {
        if (!mozeDodati) {
            throw new Error(
                "Dodavanje termina trenutačno je omogućeno samo za objavljene oglase."
            );
        }

        const datumPocetka = new Date(pocetak);
        const datumZavrsetka = new Date(zavrsetak);
        const brojMjesta = Number(kapacitet);
        const adresa = lokacija.trim();

        if (
            !pocetak ||
            !zavrsetak ||
            !Number.isFinite(datumPocetka.getTime()) ||
            !Number.isFinite(datumZavrsetka.getTime())
        ) {
            throw new Error(
                "Unesite ispravan početak i završetak audicije."
            );
        }

        if (datumPocetka.getTime() <= Date.now()) {
            throw new Error(
                "Početak audicije mora biti u budućnosti."
            );
        }

        if (datumZavrsetka <= datumPocetka) {
            throw new Error(
                "Završetak audicije mora biti nakon početka."
            );
        }

        if (adresa === "" || adresa.length > 200) {
            throw new Error(
                "Lokacija mora sadržavati od 1 do 200 znakova."
            );
        }

        if (
            !Number.isSafeInteger(brojMjesta) ||
            brojMjesta < 1 ||
            brojMjesta > 2147483647
        ) {
            throw new Error(
                "Kapacitet mora biti cijeli broj između 1 i 2147483647."
            );
        }

        return {
            starts_at: datumPocetka.toISOString(),
            ends_at: datumZavrsetka.toISOString(),
            location: adresa,
            capacity: brojMjesta
        };
    }

    async function dodajTermin(x) {
        x.preventDefault();

        if (zahtjevUTijeku.current) {
            return;
        }

        setGreska("");
        setPoruka("");

        let podaci;

        try {
            podaci = pripremiPodatke();
        } catch (x) {
            setGreska(x.message);
            return;
        }

        zahtjevUTijeku.current = true;
        setSpremanje(true);

        try {
            const noviTermin = await posaljiZahtjev(
                `/${oglas.id}`,
                "POST",
                podaci
            );

            if (
                !Number.isSafeInteger(noviTermin?.id) ||
                noviTermin.id < 1 ||
                !Number.isFinite(Date.parse(noviTermin.starts_at)) ||
                !Number.isFinite(Date.parse(noviTermin.ends_at)) ||
                typeof noviTermin.location !== "string" ||
                !Number.isInteger(noviTermin.capacity) ||
                typeof noviTermin.status !== "string"
            ) {
                throw new Error(
                    "Odgovor o spremljenom terminu nije očekivan. Prije ponavljanja provjerite je li termin spremljen."
                );
            }

            //prikazujemo podatke koje je potvrdio backend
            setTermini((prethodniTermini) => {
                return [...prethodniTermini, noviTermin].sort(
                    (prvi, drugi) => {
                        return (
                            new Date(prvi.starts_at) -
                            new Date(drugi.starts_at)
                        );
                    }
                );
            });

            setPocetak("");
            setZavrsetak("");
            setLokacija("");
            setKapacitet("");
            setPoruka("Termin audicije uspješno je spremljen.");
        } catch (x) {
            setGreska(
                x instanceof TypeError
                    ? "Veza s backendom je prekinuta. Prije ponavljanja provjerite je li termin ipak spremljen."
                    : x.message
            );
        } finally {
            zahtjevUTijeku.current = false;
            setSpremanje(false);
        }
    }

    async function otkaziTermin(termin, trenutnoVrijeme) {
        if (zahtjevUTijeku.current) {
            return;
        }

        setGreska("");
        setPoruka("");

        //vrijeme provjeravamo nakon klika, a ne tijekom prikazivanja
        if (
            termin.status !== "scheduled" ||
            new Date(termin.starts_at).getTime() <= trenutnoVrijeme
        ) {
            setGreska(
                "Moguće je otkazati samo budući zakazani termin."
            );
            return;
        }

        const potvrda = window.confirm(
            `Želite li otkazati termin ${prikaziDatum(termin.starts_at)}?`
        );

        if (!potvrda) {
            return;
        }

        zahtjevUTijeku.current = true;
        setSpremanje(true);

        try {
            const odgovor = await posaljiZahtjev(
                `/${oglas.id}/slots/${termin.id}/cancel`,
                "PATCH"
            );

            if (odgovor?.id !== termin.id) {
                throw new Error(
                    "Backend nije vratio očekivanu potvrdu otkazivanja."
                );
            }

            setTermini((prethodniTermini) => {
                return prethodniTermini.map((trenutniTermin) => {
                    if (trenutniTermin.id === termin.id) {
                        return {
                            ...trenutniTermin,
                            status: "cancelled"
                        };
                    }

                    return trenutniTermin;
                });
            });

            setPoruka("Termin audicije uspješno je otkazan.");
        } catch (x) {
            setGreska(
                x instanceof TypeError
                    ? "Veza s backendom je prekinuta. Ishod otkazivanja nije potvrđen."
                    : x.message
            );
        } finally {
            zahtjevUTijeku.current = false;
            setSpremanje(false);
        }
    }

    function prikaziDatum(vrijednost) {
        const datum = new Date(vrijednost);

        if (!Number.isFinite(datum.getTime())) {
            return "Datum nije dostupan";
        }

        return datum.toLocaleString("hr-HR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });
    }

    function prikaziStatus(status) {
        if (status === "scheduled") {
            return "Zakazan";
        }

        if (status === "cancelled") {
            return "Otkazan";
        }

        return status;
    }

    if (!oglas) {
        return (
            <main className="audicije">
                <h1>Audicije</h1>
                <p>Nije odabran oglas.</p>

                <button
                    type="button"
                    className="audicije-gumb audicije-gumb-natrag"
                    onClick={onMojiOglasi}
                >
                    Natrag na moje oglase
                </button>
            </main>
        );
    }

    return (
        <main className="audicije">
            <div className="audicije-zaglavlje">
                <h1>Audicije</h1>
                <h2>{oglas.naziv}</h2>
                <p>Uloga: {oglas.uloga}</p>

                <button
                    type="button"
                    className="audicije-gumb audicije-gumb-natrag"
                    disabled={spremanje}
                    onClick={onMojiOglasi}
                >
                    Natrag na moje oglase
                </button>
            </div>

            <p className="audicije-napomena">
                Dohvat postojećih termina za poslodavca još nije dostupan.
                Ovdje se prikazuju samo termini dodani tijekom ovog
                otvaranja stranice. Nakon izlaska ostaju spremljeni
                u bazi, ali ih zasad ne možemo ponovno učitati.
            </p>

            {greska && (
                <p className="audicije-greska">{greska}</p>
            )}

            {poruka && (
                <p className="audicije-poruka">{poruka}</p>
            )}

            {spremanje && <p>Spremanje...</p>}

            <div className="audicije-novi-termin">
                <h2>Dodavanje termina</h2>

                {mozeDodati ? (
                    <form
                        className="audicije-obrazac"
                        onSubmit={dodajTermin}
                    >
                        <div className="audicije-polje">
                            <label htmlFor="pocetak-audicije">
                                Datum i vrijeme početka:
                            </label>

                            <input
                                type="datetime-local"
                                id="pocetak-audicije"
                                name="pocetak"
                                className="audicije-unos"
                                value={pocetak}
                                onChange={(x) =>
                                    setPocetak(x.target.value)
                                }
                                disabled={spremanje}
                                required
                            />
                        </div>

                        <div className="audicije-polje">
                            <label htmlFor="zavrsetak-audicije">
                                Datum i vrijeme završetka:
                            </label>

                            <input
                                type="datetime-local"
                                id="zavrsetak-audicije"
                                name="zavrsetak"
                                className="audicije-unos"
                                value={zavrsetak}
                                onChange={(x) =>
                                    setZavrsetak(x.target.value)
                                }
                                disabled={spremanje}
                                required
                            />
                        </div>

                        <div className="audicije-polje">
                            <label htmlFor="lokacija-audicije">
                                Lokacija:
                            </label>

                            <input
                                type="text"
                                id="lokacija-audicije"
                                name="lokacija"
                                className="audicije-unos"
                                value={lokacija}
                                onChange={(x) =>
                                    setLokacija(x.target.value)
                                }
                                maxLength={200}
                                placeholder="Unesite adresu ili naziv prostora..."
                                disabled={spremanje}
                                required
                            />
                        </div>

                        <div className="audicije-polje">
                            <label htmlFor="kapacitet-audicije">
                                Maksimalan broj kandidata:
                            </label>

                            <input
                                type="number"
                                id="kapacitet-audicije"
                                name="kapacitet"
                                className="audicije-unos"
                                value={kapacitet}
                                onChange={(x) =>
                                    setKapacitet(x.target.value)
                                }
                                min={1}
                                max={2147483647}
                                step={1}
                                disabled={spremanje}
                                required
                            />
                        </div>

                        <div className="audicije-akcije">
                            <button
                                type="submit"
                                className="audicije-gumb audicije-gumb-dodaj"
                                disabled={spremanje}
                            >
                                Dodaj termin
                            </button>
                        </div>
                    </form>
                ) : (
                    <p>
                        Dodavanje termina trenutačno je omogućeno samo
                        za objavljene oglase.
                    </p>
                )}
            </div>

            <div className="audicije-termini">
                <h2>Termini dodani tijekom ovog otvaranja</h2>

                {termini.length === 0 ? (
                    <p>
                        U ovom otvaranju stranice još nije dodan termin.
                    </p>
                ) : (
                    <div className="audicije-popis">
                        {termini.map((termin) => (
                            <div
                                key={termin.id}
                                className="audicije-kartica"
                            >
                                <h3>
                                    {prikaziDatum(termin.starts_at)}
                                </h3>

                                <div className="audicije-podaci">
                                    <p>
                                        Završetak:
                                        {" "}
                                        {prikaziDatum(termin.ends_at)}
                                    </p>

                                    <p>Lokacija: {termin.location}</p>
                                    <p>Kapacitet: {termin.capacity}</p>

                                    <p>
                                        Status:
                                        {" "}
                                        {prikaziStatus(termin.status)}
                                    </p>
                                </div>

                                {termin.status === "scheduled" && (
                                    <div className="audicije-akcije">
                                        <button
                                            type="button"
                                            className="audicije-gumb audicije-gumb-otkazi"
                                            disabled={spremanje}
                                            onClick={() =>
                                                otkaziTermin(termin, Date.now())
                                            }
                                        >
                                            Otkaži termin
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </main>
    );
}

export default Audicije;