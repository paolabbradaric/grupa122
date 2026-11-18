//administracijska stranica za pregled zahtjeva i prijavljenih oglasa
import { useEffect, useState } from "react";
import { moderationRequest, moderationList } from "../services/moderation";
import ModerationStats from "../components/ModerationStats";

function AdminPanel({ csrfToken, onDenied }) {
    const [prikaz, setPrikaz] = useState("zahtjevi");
    const [podaci, setPodaci] = useState(null);
    const [revizija, setRevizija] = useState(0);
    const [spremanje, setSpremanje] = useState(false);
    const [greska, setGreska] = useState("");
    const [poruka, setPoruka] = useState("");
    const [zahtjevZaOdbijanje, setZahtjevZaOdbijanje] = useState(null);
    const [razlogOdbijanja, setRazlogOdbijanja] = useState("");
    const ucitano = podaci?.revizija === revizija;
    const zahtjevi = ucitano ? podaci.zahtjevi : [];
    const prijavljeniOglasi = ucitano ? podaci.oglasi : [];

    // Zadržavamo postojeće nazive polja i prikaze; probne podatke zamjenjuje API.
    useEffect(() => {
        const controller = new AbortController();
        Promise.all([
            moderationList("/admin/verifications", controller.signal),
            moderationList("/admin/reports?status=open", controller.signal),
        ]).then(([verifikacije, oglasi]) => {
            if (controller.signal.aborted) return;
            const statusi = { pending: "naCekanju", under_review: "uProvjeri", approved: "odobren", rejected: "odbijen" };
            setPodaci({ revizija, zahtjevi: verifikacije.map(v => ({
                id: v.id,
                naziv: v.submittedData?.company_name || v.companyName,
                email: v.submittedData?.contact_email || v.contactEmail,
                opis: `OIB: ${v.submittedData?.reg_num || v.regNum}; telefon: ${v.submittedData?.phone || v.phone}; sjedište: ${v.submittedData?.location || v.location}`,
                datum: new Date(v.submittedAt).toLocaleString("hr-HR"),
                status: statusi[v.status],
                razlogOdbijanja: v.rejectionReason || "",
            })), oglasi: oglasi.map(o => ({
                id: o.id, castingId: o.castingId, naziv: o.castingTitle,
                poslodavac: o.companyName, razlogPrijave: o.reason,
                datum: new Date(o.submittedAt).toLocaleString("hr-HR"),
            })) });
            setGreska("");
        }).catch(error => {
            if (controller.signal.aborted) return;
            if ([401, 403].includes(error.status)) onDenied(error.status);
            else { setGreska(error.message); setPodaci({ revizija, zahtjevi: [], oglasi: [] }); }
        });
        return () => controller.abort();
    }, [revizija, onDenied]);

    const zahtjeviNaCekanju = zahtjevi.filter(zahtjev => ["naCekanju", "uProvjeri"].includes(zahtjev.status));
    const odbijeniZahtjevi = zahtjevi.filter(zahtjev => zahtjev.status === "odbijen");

    function promijeniPrikaz(noviPrikaz) {
        setPrikaz(noviPrikaz);
        setZahtjevZaOdbijanje(null);
        setRazlogOdbijanja("");
    }

    async function spremi(path, method, body) {
        if (spremanje) return;
        setSpremanje(true);
        setGreska("");
        setPoruka("");
        try {
            await moderationRequest(path, { method, body, csrfToken });
            setZahtjevZaOdbijanje(null);
            setRazlogOdbijanja("");
            setPoruka("Promjena je spremljena.");
            setRevizija(prethodna => prethodna + 1);
        } catch (error) {
            if ([401, 403].includes(error.status)) onDenied(error.status);
            else setGreska(error.message);
        } finally { setSpremanje(false); }
    }

    function preuzmiZahtjev(zahtjev) {
        return spremi(`/admin/verifications/${zahtjev.id}`, "PATCH", { status: "under_review" });
    }

    function odobriZahtjev(zahtjev) {
        return spremi(`/admin/verifications/${zahtjev.id}`, "PATCH", { status: "approved" });
    }

    function zapocniOdbijanje(zahtjev) {
        setZahtjevZaOdbijanje(zahtjev.id);
        setRazlogOdbijanja("");
    }

    function odustaniOdOdbijanja() {
        setZahtjevZaOdbijanje(null);
        setRazlogOdbijanja("");
    }

    function odbijZahtjev(zahtjev) {
        if (razlogOdbijanja.trim() === "") {
            alert("Morate unijeti razlog odbijanja zahtjeva!");
            return;
        }
        return spremi(`/admin/verifications/${zahtjev.id}`, "PATCH", {
            status: "rejected", reason: razlogOdbijanja.trim(),
        });
    }

    function zatvoriPrijavu(oglas) {
        const razlog = window.prompt("Unesite razlog zatvaranja prijave bez brisanja oglasa:");
        if (!razlog?.trim()) return;
        return spremi(`/admin/reports/${oglas.id}`, "PATCH", { status: "dismissed", reason: razlog.trim() });
    }

    function obrisiOglas(oglas) {
        const potvrda = window.confirm(
            `Jeste li sigurni da želite nepovratno obrisati oglas "${oglas.naziv}" i povezane prijave, termine i rezervacije?`
        );
        if (!potvrda) return;
        const razlog = window.prompt("Unesite razlog uklanjanja oglasa:");
        if (!razlog?.trim()) return;
        const tekst = `OBRIŠI ${oglas.castingId}`;
        const confirmation = window.prompt(`Za potvrdu trajnog brisanja upišite ${tekst}:`);
        if (confirmation !== tekst) {
            setGreska("Potvrda nije ispravna. Oglas nije obrisan.");
            return;
        }
        return spremi(`/admin/castings/${oglas.castingId}`, "DELETE", { reason: razlog.trim(), confirmation });
    }

    return (
        <main className="admin-panel">
            <div className="admin-zaglavlje">
                <h1>Administracijski panel</h1>

                <p>
                    Ovdje možete pregledavati zahtjeve za verifikaciju
                    poslodavaca, odbijene zahtjeve i prijavljene oglase.
                </p>

                <p className="admin-napomena">
                    Podaci se dohvaćaju iz baze. Odluke se spremaju nakon potvrde.
                </p>
            </div>

            {greska && <p role="alert">{greska}</p>}
            {poruka && <p role="status">{poruka}</p>}
            {!ucitano && <p role="status">Učitavam podatke…</p>}
            <button type="button" className="admin-gumb" disabled={spremanje}
                onClick={() => setRevizija(prethodna => prethodna + 1)}>Osvježi</button>

            {/*odabir prikaza*/}
            <div className="admin-navigacija">
                <button
                    type="button"
                    className="admin-gumb admin-gumb-prikaz"
                    onClick={() => promijeniPrikaz("zahtjevi")}
                    disabled={spremanje || prikaz === "zahtjevi"}
                >
                    Zahtjevi za verifikaciju ({zahtjeviNaCekanju.length})
                </button>

                <button
                    type="button"
                    className="admin-gumb admin-gumb-prikaz"
                    onClick={() => promijeniPrikaz("odbijeni")}
                    disabled={spremanje || prikaz === "odbijeni"}
                >
                    Odbijeni zahtjevi ({odbijeniZahtjevi.length})
                </button>

                <button
                    type="button"
                    className="admin-gumb admin-gumb-prikaz"
                    onClick={() => promijeniPrikaz("oglasi")}
                    disabled={spremanje || prikaz === "oglasi"}
                >
                    Prijavljeni oglasi ({prijavljeniOglasi.length})
                </button>
                <button type="button" className="admin-gumb admin-gumb-prikaz"
                    onClick={() => promijeniPrikaz("statistika")}
                    disabled={spremanje || prikaz === "statistika"}>Statistika</button>
            </div>

            {/*zahtjevi koji čekaju verifikaciju*/}
            {ucitano && prikaz === "zahtjevi" && (
                <div className="admin-prikaz admin-zahtjevi">
                    <h2>Zahtjevi za verifikaciju</h2>

                    {zahtjeviNaCekanju.length === 0 ? (
                        <p className="admin-prazno">
                            Nema zahtjeva koji čekaju pregled.
                        </p>
                    ) : (
                        <div className="admin-popis">
                            {zahtjeviNaCekanju.map((zahtjev) => (
                                <div
                                    key={zahtjev.id}
                                    className="admin-kartica admin-kartica-zahtjev"
                                >
                                    <h3>{zahtjev.naziv}</h3>

                                    <div className="admin-podaci">
                                        <p>Email: {zahtjev.email}</p>
                                        <p>Opis: {zahtjev.opis}</p>
                                        <p>Datum zahtjeva: {zahtjev.datum}</p>
                                    </div>

                                    <div className="admin-akcije">
                                        {zahtjev.status === "naCekanju" && <button type="button"
                                            className="admin-gumb" disabled={spremanje}
                                            onClick={() => preuzmiZahtjev(zahtjev)}>Preuzmi u provjeru</button>}
                                        <button
                                            type="button"
                                            disabled={spremanje || zahtjev.status !== "uProvjeri"}
                                            className="admin-gumb admin-gumb-odobri"
                                            onClick={() => odobriZahtjev(zahtjev)}
                                        >
                                            Odobri
                                        </button>

                                        <button
                                            type="button"
                                            className="admin-gumb admin-gumb-odbij"
                                            disabled={spremanje || zahtjev.status !== "uProvjeri"}
                                            onClick={() => zapocniOdbijanje(zahtjev)}
                                        >
                                            Odbij
                                        </button>
                                    </div>

                                    {/*obrazac se otvara samo uz odabrani zahtjev*/}
                                    {zahtjevZaOdbijanje === zahtjev.id && (
                                        <form
                                            className="admin-obrazac"
                                            onSubmit={(x) => {
                                                x.preventDefault();
                                                odbijZahtjev(zahtjev);
                                            }}
                                        >
                                            <div className="admin-polje">
                                                <label htmlFor={`razlog-${zahtjev.id}`}>
                                                    Razlog odbijanja:
                                                </label>

                                                <textarea
                                                    id={`razlog-${zahtjev.id}`}
                                                    className="admin-unos"
                                                    name="razlogOdbijanja"
                                                    rows={4}
                                                    value={razlogOdbijanja}
                                                    onChange={(x) =>
                                                        setRazlogOdbijanja(x.target.value)
                                                    }
                                                    placeholder="Unesite razlog odbijanja..."
                                                    required
                                                    maxLength={2000}
                                                    disabled={spremanje}
                                                />
                                            </div>

                                            <div className="admin-akcije">
                                                <button
                                                    type="submit"
                                                    disabled={spremanje}
                                                    className="admin-gumb admin-gumb-odbij"
                                                >
                                                    Potvrdi odbijanje
                                                </button>

                                                <button
                                                    type="button"
                                                    className="admin-gumb admin-gumb-odustani"
                                                    disabled={spremanje}
                                                    onClick={odustaniOdOdbijanja}
                                                >
                                                    Odustani
                                                </button>
                                            </div>
                                        </form>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/*odbijeni zahtjevi i razlozi odbijanja*/}
            {ucitano && prikaz === "odbijeni" && (
                <div className="admin-prikaz admin-odbijeni">
                    <h2>Odbijeni zahtjevi</h2>

                    {odbijeniZahtjevi.length === 0 ? (
                        <p className="admin-prazno">
                            Nema odbijenih zahtjeva.
                        </p>
                    ) : (
                        <div className="admin-popis">
                            {odbijeniZahtjevi.map((zahtjev) => (
                                <div
                                    key={zahtjev.id}
                                    className="admin-kartica admin-kartica-odbijena"
                                >
                                    <h3>{zahtjev.naziv}</h3>

                                    <div className="admin-podaci">
                                        <p>Email: {zahtjev.email}</p>
                                        <p>Opis: {zahtjev.opis}</p>
                                        <p>Datum zahtjeva: {zahtjev.datum}</p>
                                    </div>

                                    <p className="admin-razlog">
                                        Razlog odbijanja: {zahtjev.razlogOdbijanja}
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/*oglasi koje su korisnici prijavili zbog problema*/}
            {ucitano && prikaz === "oglasi" && (
                <div className="admin-prikaz admin-oglasi">
                    <h2>Prijavljeni oglasi</h2>

                    {prijavljeniOglasi.length === 0 ? (
                        <p className="admin-prazno">
                            Nema prijavljenih oglasa.
                        </p>
                    ) : (
                        <div className="admin-popis">
                            {prijavljeniOglasi.map((oglas) => (
                                <div
                                    key={oglas.id}
                                    className="admin-kartica admin-kartica-oglas"
                                >
                                    <h3>{oglas.naziv}</h3>

                                    <div className="admin-podaci">
                                        <p>Poslodavac: {oglas.poslodavac}</p>
                                        <p>Datum prijave: {oglas.datum}</p>
                                    </div>

                                    <p className="admin-razlog">
                                        Razlog prijave: {oglas.razlogPrijave}
                                    </p>

                                    <div className="admin-akcije">
                                        <button type="button" className="admin-gumb" disabled={spremanje}
                                            onClick={() => zatvoriPrijavu(oglas)}>Zatvori prijavu bez brisanja</button>
                                        <button
                                            type="button"
                                            disabled={spremanje || !oglas.castingId}
                                            className="admin-gumb admin-gumb-obrisi"
                                            onClick={() => obrisiOglas(oglas)}
                                        >
                                            Obriši oglas
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
            {prikaz === "statistika" && <ModerationStats onDenied={onDenied} key={revizija} />}
        </main>
    );
}

export default AdminPanel;