//pregled prijava kandidata na odabrani oglas
import { useEffect, useRef, useState } from "react";
import { zahtjevPoslodavca } from "../services/poslodavac";

const naziviStatusa = {
    SUBMITTED: "Predana", UNDER_REVIEW: "U pregledu", SHORTLISTED: "Uži izbor",
    INVITED: "Pozvan/a na audiciju", AUDITIONED: "Audicija održana",
    ACCEPTED: "Odabran/a", SELECTED: "Odabran/a", REJECTED: "Odbijena",
    WITHDRAWN: "Povučena", CANCELLED: "Otkazana"
};
const sljedeciKorak = {
    SUBMITTED: { status: "UNDER_REVIEW", naziv: "Stavi u pregled" },
    UNDER_REVIEW: { status: "SHORTLISTED", naziv: "Dodaj u uži izbor" },
    SHORTLISTED: { status: "INVITED", naziv: "Pozovi na audiciju" },
    INVITED: { status: "AUDITIONED", naziv: "Označi audiciju održanom" }
};
const mozeOdbiti = (status) => [
    "SUBMITTED", "UNDER_REVIEW", "SHORTLISTED", "INVITED", "AUDITIONED"
].includes(status);

function PregledPrijava({ oglas, onMojiOglasi, csrfToken }) {
    const [prijave, setPrijave] = useState([]);
    const [statusOglasa, setStatusOglasa] = useState("");
    const [ucitavanje, setUcitavanje] = useState(true);
    const [greska, setGreska] = useState("");
    const [spremanje, setSpremanje] = useState(null);
    const [filter, setFilter] = useState("sve");
    const [otvorenaPrijava, setOtvorenaPrijava] = useState(null);
    const oglasId = oglas?.id;
    const zahtjevUTijeku = useRef(false);
    const [poruka, setPoruka] = useState("");
    const [revizija, setRevizija] = useState(0);

    useEffect(() => {
        if (!oglasId) return;
        const kontroler = new AbortController();
        async function ucitajPrijave() {
            try {
                const podaci = await zahtjevPoslodavca(`/castings/${oglasId}/applications`, {
                    signal: kontroler.signal
                });
                if (!Array.isArray(podaci?.applications) || podaci?.casting?.id !== oglasId) {
                    throw new Error("Primljen je neispravan popis prijava.");
                }
                if (!kontroler.signal.aborted) {
                    setPrijave(podaci.applications);
                    setStatusOglasa(podaci.casting.status);
                    setGreska("");
                }
            } catch (x) {
                if (!kontroler.signal.aborted) {
                    setGreska(x.message);
                    // Bez potvrđenog stanja oglasa ne nudimo promjene.
                    setStatusOglasa("");
                }
            } finally {
                if (!kontroler.signal.aborted) setUcitavanje(false);
            }
        }
        ucitajPrijave();
        return () => kontroler.abort();
    }, [oglasId, revizija]);

    const filtriranePrijave = prijave.filter((prijava) => {
        return filter === "sve" || prijava.status === filter;
    });
    const dostupniStatusi = [...new Set(prijave.map((prijava) => prijava.status))];
    if (filter !== "sve" && !dostupniStatusi.includes(filter)) dostupniStatusi.push(filter);
    const brojOdabranih = prijave.filter((prijava) => ["ACCEPTED", "SELECTED"].includes(prijava.status)).length;
    const mozeUpravljati = statusOglasa === "published" || statusOglasa === "closed";

    function prikaziDetalje(prijava) {
        if (otvorenaPrijava === prijava.id) {
            setOtvorenaPrijava(null);
        } else {
            setOtvorenaPrijava(prijava.id);
        }
    }

    function osvjeziPrijave() {
        if (zahtjevUTijeku.current) return;
        setUcitavanje(true);
        setRevizija((prethodna) => prethodna + 1);
    }

    async function promijeniPrijavu(prijava, noviStatus) {
        if (!mozeUpravljati || ucitavanje || zahtjevUTijeku.current) return;
        const odabir = noviStatus === "ACCEPTED";
        const dopusteno = odabir
            ? prijava.status === "AUDITIONED"
            : noviStatus === "REJECTED"
                ? mozeOdbiti(prijava.status)
                : sljedeciKorak[prijava.status]?.status === noviStatus;
        if (!dopusteno) return;
        setGreska("");
        setPoruka("");
        if (!csrfToken) {
            setGreska("Nedostaje potvrda prijave. Osvježite stranicu.");
            return;
        }
        const podaci = { status: noviStatus };
        if (noviStatus === "REJECTED") {
            const razlog = window.prompt("Unesite razlog odbijanja kandidata:");
            if (razlog === null) return;
            if (!razlog.trim() || razlog.trim().length > 2000) {
                setGreska("Razlog odbijanja mora sadržavati od 1 do 2000 znakova.");
                return;
            }
            podaci.rejectionReason = razlog.trim();
        }
        const napomena = noviStatus === "REJECTED"
            ? " Buduća aktivna rezervacija kandidata također će se otkazati."
            : odabir
                ? " Ako time popunite oglas, backend odbija preostale nezavršene prijave i otkazuje buduće termine i njihove aktivne rezervacije."
                : noviStatus === "AUDITIONED"
                    ? " Ova radnja označava održanu audiciju; evidencija dolaska vodi se zasebno."
                    : "";
        if (!window.confirm(
            `Za kandidata ${prijava.firstName} ${prijava.lastName} postaviti status „${naziviStatusa[noviStatus]}”?${napomena}`
        )) return;
        zahtjevUTijeku.current = true;
        setSpremanje(prijava.id);
        try {
            const odgovor = await zahtjevPoslodavca(
                `/castings/${oglasId}/applications/${prijava.id}/${odabir ? "select" : "status"}`,
                { metoda: odabir ? "POST" : "PATCH", csrfToken,
                    ...(odabir ? {} : { podaci }) }
            );
            const status = odabir ? odgovor?.applicationStatus : odgovor?.status;
            if (odgovor?.applicationId !== prijava.id || status !== noviStatus ||
                (odabir && (odgovor.castingId !== oglasId || typeof odgovor.castingStatus !== "string"))) {
                throw new Error("Ishod nije potvrđen. Osvježite prijave prije ponavljanja radnje.");
            }
            setPrijave((prethodne) => prethodne.map((trenutna) =>
                trenutna.id === prijava.id ? { ...trenutna, status } : trenutna
            ));
            if (odabir) setStatusOglasa(odgovor.castingStatus);
            setPoruka("Promjena je spremljena. Ponovno učitavam aktualne prijave.");
        } catch (error) {
            setGreska(error.message || "Zahtjev nije uspio. Osvježite prijave.");
            // Mrežna greška može nastati i nakon upisa. Prvo ponovno učitati stanje.
            setStatusOglasa("");
            return;
        } finally {
            zahtjevUTijeku.current = false;
            setSpremanje(null);
        }
        // Popunjavanje oglasa može promijeniti i prijave drugih kandidata.
        osvjeziPrijave();
    }

    function prikaziDatum(datum) {
        if (!datum) return "Nije dostupan";
        const vrijednost = new Date(datum);
        if (!Number.isFinite(vrijednost.getTime())) return "Nije dostupan";
        return vrijednost.toLocaleDateString("hr-HR");
    }

    //zaštita od otvaranja stranice bez odabranog oglasa
    if (!oglas) {
        return (
            <main className="pregled-prijava">
                <h1>Pregled prijava</h1>

                <p>Nije odabran oglas.</p>

                <button
                    type="button"
                    className="prijave-gumb"
                    onClick={onMojiOglasi}
                >
                    Natrag na moje oglase
                </button>
            </main>
        );
    }

    return (
        <main className="pregled-prijava">
            <div className="prijave-zaglavlje">
                <h1>Pregled prijava</h1>

                <h2>{oglas.naziv}</h2>
                <p>Uloga: {oglas.uloga}</p>
                <p>Ukupno prijava: {prijave.length}</p>
                <p>
                    Odabrani kandidati: {brojOdabranih}
                    {" / "}
                    {oglas.brojKandidata}
                </p>

                <button
                    type="button"
                    className="prijave-gumb prijave-gumb-natrag"
                    disabled={spremanje !== null}
                    onClick={onMojiOglasi}
                >
                    Natrag na moje oglase
                </button>
            </div>

            {greska && <p className="prijave-greska" role="alert">{greska}</p>}
            {poruka && <p role="status">{poruka}</p>}
            {spremanje !== null && <p role="status">Spremanje promjene...</p>}
            <button type="button" className="prijave-gumb" disabled={spremanje !== null || ucitavanje}
                onClick={osvjeziPrijave}>Osvježi prijave</button>
            {ucitavanje && <p>Učitavanje prijava...</p>}
            {statusOglasa === "filled" && <p>Oglas je popunjen.</p>}
            {!ucitavanje && statusOglasa && !mozeUpravljati && (
                <p className="prijave-napomena">
                    U ovom statusu oglasa prijave možete samo pregledavati.
                </p>
            )}

            {/*filtriranje prijava prema statusu*/}
            <div className="prijave-filter">
                <label htmlFor="filter-prijava">
                    Prikaži prijave:
                </label>

                <select
                    id="filter-prijava"
                    className="prijave-unos"
                    value={filter}
                    onChange={(x) => setFilter(x.target.value)}
                >
                    <option value="sve">Sve prijave</option>
                    {dostupniStatusi.map((status) => (
                        <option key={status} value={status}>{naziviStatusa[status] || status}</option>
                    ))}
                </select>
            </div>

            {/*prazan popis ili prijave koje odgovaraju filtru*/}
            {ucitavanje ? null : filtriranePrijave.length === 0 ? (
                <p className="prijave-prazno">
                    {prijave.length === 0
                        ? greska ? "Prijave nisu učitane." : "Na ovaj oglas još nema prijava."
                        : "Nema prijava s odabranim statusom."}
                </p>
            ) : (
                <div className="prijave-popis">
                    {filtriranePrijave.map((prijava) => (
                        <div
                            key={prijava.id}
                            className="prijave-kartica"
                        >
                            <h3>
                                {prijava.firstName} {prijava.lastName}
                            </h3>

                            <div className="prijave-podaci">
                                <p>Grad: {prijava.city || "Nije naveden"}</p>
                                <p>Datum prijave: {prikaziDatum(prijava.submittedAt)}</p>

                                <p className="prijave-status">
                                    Status: {naziviStatusa[prijava.status] || prijava.status}
                                </p>
                            </div>

                            <div className="prijave-akcije">
                                <button
                                    type="button"
                                    className="prijave-gumb prijave-gumb-detalji"
                                    onClick={() => prikaziDetalje(prijava)}
                                >
                                    {otvorenaPrijava === prijava.id
                                        ? "Sakrij detalje"
                                        : "Prikaži detalje"}
                                </button>

                                {mozeUpravljati && sljedeciKorak[prijava.status] && (
                                    <button type="button" className="prijave-gumb prijave-gumb-status"
                                        disabled={spremanje !== null || ucitavanje}
                                        onClick={() => promijeniPrijavu(prijava, sljedeciKorak[prijava.status].status)}>
                                        {sljedeciKorak[prijava.status].naziv}
                                    </button>
                                )}
                                {mozeUpravljati && prijava.status === "AUDITIONED" && (
                                    <button type="button" className="prijave-gumb prijave-gumb-status"
                                        disabled={spremanje !== null || ucitavanje}
                                        onClick={() => promijeniPrijavu(prijava, "ACCEPTED")}>
                                        Odaberi kandidata
                                    </button>
                                )}
                                {mozeUpravljati && mozeOdbiti(prijava.status) && (
                                    <button type="button" className="prijave-gumb prijave-gumb-odbij"
                                        disabled={spremanje !== null || ucitavanje}
                                        onClick={() => promijeniPrijavu(prijava, "REJECTED")}>
                                        Odbij kandidata
                                    </button>
                                )}

                            </div>

                            {/*detalji samo odabrane prijave*/}
                            {otvorenaPrijava === prijava.id && (
                                <div className="prijave-detalji">
                                    <p>Država: {prijava.country || "Nije navedena"}</p>
                                    <p>Biografija: {prijava.bio || "Nije unesena"}</p>
                                    <p>Iskustvo: {prijava.experience || "Nije uneseno"}</p>
                                    <p>Motivacija: {prijava.coverLetter || "Nije unesena"}</p>
                                </div>
                            )}

                        </div>
                    ))}
                </div>
            )}
        </main>
    );
}

export default PregledPrijava;