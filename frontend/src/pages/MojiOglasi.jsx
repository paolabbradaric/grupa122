//prikaz oglasa poslodavaca na stranici moji oglasi
import { useEffect, useState } from "react";
import { zahtjevPoslodavca } from "../services/poslodavac";

const statusi = { draft: "nacrt", published: "objavljen", closed: "prijaveZatvorene", filled: "popunjen", cancelled: "otkazan" };

function MojiOglasi({onNoviOglas, onUrediOglas, onPregledPrijava, onAudicije, csrfToken}) {
    const [oglasi, setOglasi] = useState([]);
    const [ucitavanje, setUcitavanje] = useState(true);
    const [greska, setGreska] = useState("");
    const [spremanje, setSpremanje] = useState(null);

    useEffect(() => {
        const kontroler = new AbortController();
        async function ucitajOglase() {
            try {
                const podaci = await zahtjevPoslodavca("/castings", { signal: kontroler.signal });
                if (!Array.isArray(podaci)) throw new Error("Primljen je neispravan popis oglasa.");
                const popis = podaci.map((oglas) => ({
                    ...oglas,
                    naziv: oglas.projectTitle || "",
                    uloga: oglas.roleTitle || "",
                    rokPrijava: oglas.applicationDeadline ? oglas.applicationDeadline.slice(0, 10) : "",
                    brojKandidata: oglas.positionsCount,
                    maxPrijava: oglas.maxApplications,
                    status: statusi[oglas.status] || oglas.status
                }));
                if (!kontroler.signal.aborted) setOglasi(popis);
            } catch (x) {
                if (!kontroler.signal.aborted) setGreska(x.message);
            } finally {
                if (!kontroler.signal.aborted) setUcitavanje(false);
            }
        }
        ucitajOglase();
        return () => kontroler.abort();
    }, []);

    const [filter, setFilter] = useState("svi")
    const [pretraga, setPretraga] = useState("")

    const filtriraniOglasi = oglasi.filter((oglas) => {
        const odgovaraStatus = filter === "svi" || oglas.status === filter;
        const odgovaraNaziv = oglas.naziv.toLowerCase().includes(pretraga.toLowerCase());
        return odgovaraStatus && odgovaraNaziv
    });

    async function promijeniStatus(oglas, radnja) {
        if (spremanje !== null) return;
        const pitanja = {
            publish: `Želite li objaviti oglas "${oglas.naziv}"?`,
            close: `Želite li zatvoriti prijave za "${oglas.naziv}"?`,
            cancel: `Želite li otkazati oglas "${oglas.naziv}"?`
        };
        if (!window.confirm(pitanja[radnja])) return;
        if (!csrfToken) {
            setGreska("Nedostaje potvrda prijave. Osvježite stranicu.");
            return;
        }
        setSpremanje(oglas.id);
        setGreska("");
        try {
            const odgovor = await zahtjevPoslodavca(`/castings/${oglas.id}/${radnja}`, {
                metoda: "POST", csrfToken
            });
            if (odgovor?.id !== oglas.id || typeof odgovor.status !== "string") {
                throw new Error("Primljen je neočekivan odgovor. Osvježite popis.");
            }
            //Prikaz mijenjamo tek nakon potvrde backenda.
            setOglasi((prethodniOglasi) => prethodniOglasi.map((trenutniOglas) => {
                if (trenutniOglas.id === oglas.id) {
                    return { ...trenutniOglas, status: statusi[odgovor.status] || odgovor.status };
                }
                return trenutniOglas;
            }));
        } catch (x) {
            setGreska(x.message);
        } finally {
            setSpremanje(null);
        }
    }

    return (
        <main>
            <h1>
                Moji oglasi
            </h1>

            <p>
            Ovdje možete pregledavati i
            upravljati svojim casting oglasima.
            </p>

            <button type="button" onClick={onNoviOglas}>
                + Novi oglas
            </button>

            {greska && <p className="oglasi-greska">{greska}</p>}
            {spremanje !== null && <p>Spremanje...</p>}

            {/* Pretraživanje oglasa prema nazivu */}
            <div>
                <label htmlFor="pretraga">Pretraži oglase:</label>
                <input
                    type="text"
                    id="pretraga"
                    placeholder="Unesite naziv projekta..."
                    value={pretraga}
                    onChange={(x) => setPretraga(x.target.value)}
                />
            </div>

            {/*filtriranje oglasa prema statusu*/}
            <div>

                <label htmlFor="filter">Prikaži oglase:</label>

                <select
                    id="filter"
                    value={filter}
                    onChange={(x) => setFilter(x.target.value)}
                >

                    <option value="svi">Svi oglasi</option>
                    <option value="nacrt">Nacrti</option>
                    <option value="objavljen">Objavljeni</option>
                    <option value="prijaveZatvorene">Zatvorene prijave</option>
                    <option value="popunjen">Popunjeni</option>
                    <option value="otkazan">Otkazani</option>

                </select>

            </div>

            {ucitavanje ? <p>Učitavanje oglasa...</p> : filtriraniOglasi.length === 0 ? (
                <p>
                    {greska ? "Popis oglasa nije moguće prikazati." : oglasi.length === 0 ? "Trenutno nemate oglasa." : "Nema oglasa koji odgovaraju pretraživanju ili odabranom statusu."}
                </p>
            ) : (
                <div>
                    {filtriraniOglasi.map((oglas) => (
                        <div key={oglas.id}>
                            <h2>{oglas.naziv}</h2>
                            <p>Uloga: {oglas.uloga}</p>
                            <p>Rok prijave: {oglas.rokPrijava}</p>
                            <p>Status: {oglas.status}</p>
                            <div>
                                {/*jer prosljedujemo bas taj oglas, nova fja React poziva tek pritiskom na gumb*/}
                                {oglas.status === "nacrt" && <button type="button" disabled={spremanje !== null} onClick={() => onUrediOglas(oglas)}>
                                    Uredi
                                </button>}

                                {/* Objavljivanje nacrta */}
                                {oglas.status === "nacrt" && (
                                    <button type="button" disabled={spremanje !== null} onClick={() => promijeniStatus(oglas, "publish")}>
                                        Objavi oglas
                                    </button>
                                )}

                                {oglas.status !== "nacrt" && (
                                    <button
                                        type="button"
                                        className="oglasi-gumb-prijave"
                                        disabled={spremanje !== null}
                                        onClick={() => onPregledPrijava(oglas)}
                                    >
                                        Pregled prijava
                                    </button>
                                )}

                                {(oglas.status === "objavljen" || oglas.status === "prijaveZatvorene") && (
                                    <button type="button" disabled={spremanje !== null} onClick={() => onAudicije(oglas)}>
                                        Audicije
                                    </button>
                                )} 

                                {oglas.status === "objavljen" && (
                                    <button type="button" disabled={spremanje !== null} onClick={() => promijeniStatus(oglas, "close")}>
                                        Zatvori prijave
                                    </button>
                                )}

                                {oglas.status !== "otkazan" && oglas.status !== "popunjen" &&  oglas.status !== "nacrt" &&(
                                    <button type="button" disabled={spremanje !== null} onClick={() => promijeniStatus(oglas, "cancel")}>
                                        Otkaži oglas
                                    </button>
                                )}



                            </div>
                        </div>
                    ))}
                </div>
            )}



        </main>
    )
}

export default MojiOglasi;
