import { useEffect, useRef, useState } from "react";
import { zahtjevAudicije } from "../services/audicije";

//upravljanje terminima audicija odabranog oglasa
function Audicije({ oglas, onMojiOglasi, csrfToken }) {
    const [pocetak, setPocetak] = useState("");
    const [zavrsetak, setZavrsetak] = useState("");
    const [lokacija, setLokacija] = useState("");
    const [kapacitet, setKapacitet] = useState("");


    const [termini, setTermini] = useState([]);

    const [rezervacije, setRezervacije] = useState([]);
    const [ucitavanje, setUcitavanje] = useState(true);
    const [greskaDohvata, setGreskaDohvata] = useState("");
    const [revizija, setRevizija] = useState(0);

    const oglasId = oglas?.id;

    const [spremanje, setSpremanje] = useState(false);
    const [greska, setGreska] = useState("");
    const [poruka, setPoruka] = useState("");

    //sprječava pokretanje više zahtjeva istodobno
    const zahtjevUTijeku = useRef(false);

    const mozeDodati = [
        "objavljen",
        "prijaveZatvorene",
        "published",
        "closed"
    ].includes(oglas?.status);

    const blokirano =
        spremanje ||
        ucitavanje ||
        greskaDohvata !== "";

    //slanje zahtjeva postojećem API-ju audicija
    function posaljiZahtjev(putanja, metoda, tijelo) {
        return zahtjevAudicije(`/auditions${putanja}`, {
            metoda,
            csrfToken,
            podaci: tijelo
        });
    }

    useEffect(() => {
        if (!oglasId) {
            return;
        }

        const kontroler = new AbortController();

        async function ucitajPodatke() {
            try {
                const [popisTermina, odgovorRezervacija] =
                    await Promise.all([
                        zahtjevAudicije(`/auditions/${oglasId}`, {
                            signal: kontroler.signal
                        }),
                        zahtjevAudicije(
                            `/employer/castings/${oglasId}/bookings`,
                            {
                                signal: kontroler.signal
                            }
                        )
                    ]);

                if (
                    !Array.isArray(popisTermina) ||
                    !Array.isArray(odgovorRezervacija?.bookings)
                ) {
                    throw new Error(
                        "Backend nije vratio očekivani popis termina i rezervacija."
                    );
                }

                if (kontroler.signal.aborted) {
                    return;
                }

                setTermini(popisTermina);
                setRezervacije(odgovorRezervacija.bookings);
                setGreskaDohvata("");
            } catch (error) {
                if (!kontroler.signal.aborted) {
                    setGreskaDohvata(
                        error instanceof Error
                            ? error.message
                            : "Podatke nije moguće učitati."
                    );
                }
            } finally {
                if (!kontroler.signal.aborted) {
                    setUcitavanje(false);
                }
            }
        }

        void ucitajPodatke();

        return () => kontroler.abort();
    }, [oglasId, revizija]);

    function osvjeziPodatke() {
        setUcitavanje(true);
        setGreskaDohvata("");
        setRevizija((prethodna) => prethodna + 1);
    }

    function aktivnaRezervacija(rezervacija) {
        return !["cancelled", "canceled"].includes(rezervacija.status);
    }

    function prikaziDolazak(status) {
        if (status === "attended") return "Došao/la";
        if (status === "absent") return "Nije došao/la";
        return "Nije evidentirano";
    }

    async function evidentirajDolazak(rezervacija, noviStatus, trenutnoVrijeme) {
        if (zahtjevUTijeku.current || blokirano) return;
        setGreska("");
        setPoruka("");
        const vrijeme = Date.parse(rezervacija.startsAt);
        if (!aktivnaRezervacija(rezervacija) ||
            !Number.isFinite(vrijeme) || vrijeme > trenutnoVrijeme) {
            setGreska("Dolazak se može evidentirati tek nakon početka aktivnog termina.");
            return;
        }
        if (!window.confirm(
            `Za kandidata ${rezervacija.firstName} ${rezervacija.lastName} spremiti „${prikaziDolazak(noviStatus)}”?`
        )) return;
        zahtjevUTijeku.current = true;
        setSpremanje(true);
        try {
            const odgovor = await zahtjevAudicije(
                `/employer/castings/${oglasId}/bookings/${rezervacija.id}/attendance`,
                { metoda: "PATCH", csrfToken, podaci: { attendanceStatus: noviStatus } }
            );
            if (odgovor?.id !== rezervacija.id || odgovor.attendanceStatus !== noviStatus) {
                throw new Error("Potvrda evidencije nije očekivana. Osvježite podatke prije ponavljanja.");
            }
            setRezervacije((prethodne) => prethodne.map((trenutna) =>
                trenutna.id === rezervacija.id
                    ? { ...trenutna, attendanceStatus: odgovor.attendanceStatus }
                    : trenutna
            ));
            setPoruka("Evidencija dolaska je spremljena.");
            osvjeziPodatke();
        } catch (error) {
            setGreska(error.message || "Evidenciju nije moguće spremiti. Osvježite podatke.");
        } finally {
            zahtjevUTijeku.current = false;
            setSpremanje(false);
        }
    }

    //provjera unosa i priprema podataka za backend
    function pripremiPodatke() {
        if (!mozeDodati) {
            throw new Error(
                "Termine možete dodavati objavljenim oglasima i oglasima sa zatvorenim prijavama."
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

        if (zahtjevUTijeku.current || blokirano) {
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
            osvjeziPodatke();
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
        if (zahtjevUTijeku.current || blokirano) {
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
            `Želite li otkazati termin ${prikaziDatum(termin.starts_at)}? Aktivne rezervacije tog termina također će se otkazati.`
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
            osvjeziPodatke();
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
                Prikazuju se spremljeni termini i rezervacije kandidata.
                Dolazak se evidentira nakon početka termina, odvojeno od statusa prijave.
            </p>
            <button type="button" disabled={spremanje || ucitavanje} onClick={osvjeziPodatke}>
                Osvježi termine i rezervacije
            </button>
            {ucitavanje && <p role="status">Učitavanje termina i rezervacija...</p>}
            {greskaDohvata && <p className="audicije-greska" role="alert">
                {greskaDohvata} Kliknite osvježavanje za ponovni pokušaj.
            </p>}

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
                                disabled={blokirano}
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
                                disabled={blokirano}
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
                                disabled={blokirano}
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
                                disabled={blokirano}
                                required
                            />
                        </div>

                        <div className="audicije-akcije">
                            <button
                                type="submit"
                                className="audicije-gumb audicije-gumb-dodaj"
                                disabled={blokirano}
                            >
                                Dodaj termin
                            </button>
                        </div>
                    </form>
                ) : (
                    <p>
                        Termine možete dodavati objavljenim oglasima i oglasima sa zatvorenim prijavama.
                    </p>
                )}
            </div>

            <div className="audicije-termini">
                <h2>Spremljeni termini</h2>

                {ucitavanje || greskaDohvata ? null : termini.length === 0 ? (
                    <p>
                        Za ovaj oglas još nema spremljenih termina audicija.
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
                                    <p>Slobodnih mjesta: {termin.availablePlaces ?? "Nije dostupno"}</p>

                                    <p>
                                        Status:
                                        {" "}
                                        {prikaziStatus(termin.status)}
                                    </p>
                                </div>

                                <div className="audicije-kandidati">
                                    <h4>Rezervirani kandidati</h4>
                                    {!rezervacije.some((r) => r.slotId === termin.id && aktivnaRezervacija(r))
                                        ? <p>Nema aktivnih rezervacija za ovaj termin.</p>
                                        : rezervacije.filter((r) => r.slotId === termin.id && aktivnaRezervacija(r)).map((r) => (
                                            <div key={r.id} className="audicije-kandidat">
                                                <p><strong>{r.firstName} {r.lastName}</strong></p>
                                                <p>Dolazak: {prikaziDolazak(r.attendanceStatus)}</p>
                                                <div className="audicije-akcije">
                                                    <button type="button" disabled={blokirano || r.attendanceStatus === "attended"}
                                                        onClick={() => evidentirajDolazak(r, "attended", Date.now())}>
                                                        Došao/la
                                                    </button>
                                                    <button type="button" disabled={blokirano || r.attendanceStatus === "absent"}
                                                        onClick={() => evidentirajDolazak(r, "absent", Date.now())}>
                                                        Nije došao/la
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                </div>

                                {termin.status === "scheduled" && (
                                    <div className="audicije-akcije">
                                        <button
                                            type="button"
                                            className="audicije-gumb audicije-gumb-otkazi"
                                            disabled={blokirano}
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
