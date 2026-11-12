//pregled prijava kandidata na odabrani oglas
import { useEffect, useState } from "react";
import { zahtjevPoslodavca } from "../services/poslodavac";

const naziviStatusa = { SUBMITTED: "Predana", SELECTED: "Odabran" };

function PregledPrijava({ oglas, onMojiOglasi, csrfToken }) {
    const [prijave, setPrijave] = useState([]);
    const [statusOglasa, setStatusOglasa] = useState("");
    const [ucitavanje, setUcitavanje] = useState(true);
    const [greska, setGreska] = useState("");
    const [spremanje, setSpremanje] = useState(null);
    const [filter, setFilter] = useState("sve");
    const [otvorenaPrijava, setOtvorenaPrijava] = useState(null);
    const oglasId = oglas?.id;

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
                }
            } catch (x) {
                if (!kontroler.signal.aborted) setGreska(x.message);
            } finally {
                if (!kontroler.signal.aborted) setUcitavanje(false);
            }
        }
        ucitajPrijave();
        return () => kontroler.abort();
    }, [oglasId]);

    const filtriranePrijave = prijave.filter((prijava) => {
        return filter === "sve" || prijava.status === filter;
    });
    const dostupniStatusi = [...new Set(prijave.map((prijava) => prijava.status))];
    if (filter !== "sve" && !dostupniStatusi.includes(filter)) dostupniStatusi.push(filter);
    const brojOdabranih = prijave.filter((prijava) => prijava.status === "SELECTED").length;
    const mozeUpravljati = statusOglasa === "published" || statusOglasa === "closed";

    function prikaziDetalje(prijava) {
        if (otvorenaPrijava === prijava.id) {
            setOtvorenaPrijava(null);
        } else {
            setOtvorenaPrijava(prijava.id);
        }
    }

    async function odaberiKandidata(prijava) {
        if (!mozeUpravljati || prijava.status !== "SUBMITTED" || spremanje !== null) return;
        if (!csrfToken) {
            setGreska("Nedostaje potvrda prijave. Osvježite stranicu.");
            return;
        }
        if (!window.confirm(`Želite li odabrati kandidata ${prijava.firstName} ${prijava.lastName}?`)) return;
        setSpremanje(prijava.id);
        setGreska("");
        try {
            const odgovor = await zahtjevPoslodavca(
                `/castings/${oglasId}/applications/${prijava.id}/select`,
                { metoda: "POST", csrfToken }
            );
            if (odgovor?.applicationId !== prijava.id || odgovor.castingId !== oglasId ||
                typeof odgovor.applicationStatus !== "string" || typeof odgovor.castingStatus !== "string") {
                throw new Error("Primljen je neočekivan odgovor. Ponovno otvorite prijave.");
            }
            //Prikaz mijenjamo tek nakon uspješnog spremanja.
            setPrijave((prethodnePrijave) => prethodnePrijave.map((trenutnaPrijava) => {
                if (trenutnaPrijava.id === prijava.id) {
                    return { ...trenutnaPrijava, status: odgovor.applicationStatus };
                }
                return trenutnaPrijava;
            }));
            setStatusOglasa(odgovor.castingStatus);
        } catch (x) {
            setGreska(x.message);
        } finally {
            setSpremanje(null);
        }
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

            {greska && <p className="prijave-greska">{greska}</p>}
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

                                {mozeUpravljati &&
                                    prijava.status === "SUBMITTED" && (
                                        <button
                                            type="button"
                                            className="prijave-gumb prijave-gumb-status"
                                            disabled={spremanje !== null}
                                            onClick={() =>
                                                odaberiKandidata(prijava)
                                            }
                                        >
                                            {spremanje === prijava.id ? "Spremanje..." : "Odaberi kandidata"}
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