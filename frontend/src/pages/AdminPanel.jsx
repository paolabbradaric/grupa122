//administracijska stranica za pregled zahtjeva i prijavljenih oglasa
import { useState } from "react";

function AdminPanel() {
    const [prikaz, setPrikaz] = useState("zahtjevi");

    //testni zahtjevi za verifikaciju poslodavaca
    const [zahtjevi, setZahtjevi] = useState([
        {
            id: 1,
            naziv: "Studio Sjever",
            email: "studio@example.com",
            opis: "Produkcijska kuća za film i televiziju.",
            datum: "2026-11-10",
            status: "naCekanju",
            razlogOdbijanja: ""
        },
        {
            id: 2,
            naziv: "Kazalište Primjer",
            email: "kazaliste@example.com",
            opis: "Organizacija kazališnih predstava i audicija.",
            datum: "2026-11-11",
            status: "naCekanju",
            razlogOdbijanja: ""
        },
        {
            id: 3,
            naziv: "Demo produkcija",
            email: "produkcija@example.com",
            opis: "Produkcija reklamnih sadržaja.",
            datum: "2026-11-09",
            status: "odbijen",
            razlogOdbijanja: "Nisu dostavljeni potrebni podaci."
        }
    ]);

    //testni oglasi koje su korisnici prijavili
    const [prijavljeniOglasi, setPrijavljeniOglasi] = useState([
        {
            id: 1,
            naziv: "Reklama za sportski brend",
            poslodavac: "Demo agencija",
            razlogPrijave: "Oglas sadržava neprimjeren sadržaj.",
            datum: "2026-11-11"
        },
        {
            id: 2,
            naziv: "Casting za kratkometražni film",
            poslodavac: "Filmski studio Primjer",
            razlogPrijave: "Sumnja na lažno predstavljanje.",
            datum: "2026-11-12"
        }
    ]);

    const [zahtjevZaOdbijanje, setZahtjevZaOdbijanje] = useState(null);
    const [razlogOdbijanja, setRazlogOdbijanja] = useState("");

    //izdvajanje zahtjeva prema statusu
    const zahtjeviNaCekanju = zahtjevi.filter((zahtjev) => {
        return zahtjev.status === "naCekanju";
    });

    const odbijeniZahtjevi = zahtjevi.filter((zahtjev) => {
        return zahtjev.status === "odbijen";
    });

    function promijeniPrikaz(noviPrikaz) {
        setPrikaz(noviPrikaz);
        setZahtjevZaOdbijanje(null);
        setRazlogOdbijanja("");
    }

    function odobriZahtjev(zahtjev) {
        //mijenja se samo zahtjev s odgovarajućim id-em
        setZahtjevi((prethodniZahtjevi) => {
            return prethodniZahtjevi.map((trenutniZahtjev) => {
                if (trenutniZahtjev.id === zahtjev.id) {
                    return {
                        ...trenutniZahtjev,
                        status: "odobren",
                        razlogOdbijanja: ""
                    };
                }

                return trenutniZahtjev;
            });
        });

        //zatvaranje obrasca ako je otvoren za odobreni zahtjev
        if (zahtjevZaOdbijanje === zahtjev.id) {
            setZahtjevZaOdbijanje(null);
            setRazlogOdbijanja("");
        }

        console.log("Odobren zahtjev:", zahtjev.id);
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
        //razlog ne smije biti prazan niti sadržavati samo razmake
        if (razlogOdbijanja.trim() === "") {
            alert("Morate unijeti razlog odbijanja zahtjeva!");
            return;
        }

        const razlog = razlogOdbijanja.trim();

        setZahtjevi((prethodniZahtjevi) => {
            return prethodniZahtjevi.map((trenutniZahtjev) => {
                if (trenutniZahtjev.id === zahtjev.id) {
                    return {
                        ...trenutniZahtjev,
                        status: "odbijen",
                        razlogOdbijanja: razlog
                    };
                }

                return trenutniZahtjev;
            });
        });

        console.log("Odbijen zahtjev:", zahtjev.id);
        console.log("Razlog odbijanja:", razlog);

        setZahtjevZaOdbijanje(null);
        setRazlogOdbijanja("");
    }

    function obrisiOglas(oglas) {
        const potvrda = window.confirm(
            `Jeste li sigurni da želite nepovratno obrisati oglas "${oglas.naziv}"?`
        );

        if (!potvrda) {
            return;
        }

        //uklanjanje oglasa iz testnog popisa
        setPrijavljeniOglasi((prethodniOglasi) => {
            return prethodniOglasi.filter((trenutniOglas) => {
                return trenutniOglas.id !== oglas.id;
            });
        });

        console.log("Oglas uklonjen iz testnog popisa:", oglas.id);
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
                    Trenutno se koriste testni podaci.
                    Promjene se ne spremaju u bazu.
                </p>
            </div>

            {/*odabir prikaza*/}
            <div className="admin-navigacija">
                <button
                    type="button"
                    className="admin-gumb admin-gumb-prikaz"
                    onClick={() => promijeniPrikaz("zahtjevi")}
                    disabled={prikaz === "zahtjevi"}
                >
                    Zahtjevi za verifikaciju ({zahtjeviNaCekanju.length})
                </button>

                <button
                    type="button"
                    className="admin-gumb admin-gumb-prikaz"
                    onClick={() => promijeniPrikaz("odbijeni")}
                    disabled={prikaz === "odbijeni"}
                >
                    Odbijeni zahtjevi ({odbijeniZahtjevi.length})
                </button>

                <button
                    type="button"
                    className="admin-gumb admin-gumb-prikaz"
                    onClick={() => promijeniPrikaz("oglasi")}
                    disabled={prikaz === "oglasi"}
                >
                    Prijavljeni oglasi ({prijavljeniOglasi.length})
                </button>
            </div>

            {/*zahtjevi koji čekaju verifikaciju*/}
            {prikaz === "zahtjevi" && (
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
                                        <button
                                            type="button"
                                            className="admin-gumb admin-gumb-odobri"
                                            onClick={() => odobriZahtjev(zahtjev)}
                                        >
                                            Odobri
                                        </button>

                                        <button
                                            type="button"
                                            className="admin-gumb admin-gumb-odbij"
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
                                                />
                                            </div>

                                            <div className="admin-akcije">
                                                <button
                                                    type="submit"
                                                    className="admin-gumb admin-gumb-odbij"
                                                >
                                                    Potvrdi odbijanje
                                                </button>

                                                <button
                                                    type="button"
                                                    className="admin-gumb admin-gumb-odustani"
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
            {prikaz === "odbijeni" && (
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
            {prikaz === "oglasi" && (
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
                                        <button
                                            type="button"
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
        </main>
    );
}

export default AdminPanel;