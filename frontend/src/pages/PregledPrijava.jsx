//pregled prijava kandidata na odabrani oglas
import { useState } from "react";

function PregledPrijava({ oglas, onMojiOglasi }) {
    //testne prijave povezane s oglasima preko oglasId
    const [prijave, setPrijave] = useState([
        {
            id: 1,
            oglasId: 2,
            ime: "Ana",
            prezime: "Horvat",
            email: "ana@example.com",
            grad: "Zagreb",
            iskustvo: "Sudjelovanje u studentskim filmovima.",
            motivacija: "Želim steći dodatno iskustvo pred kamerom.",
            datum: "2026-11-10",
            status: "predana",
            razlogOdbijanja: ""
        },
        {
            id: 2,
            oglasId: 2,
            ime: "Marko",
            prezime: "Kovač",
            email: "marko@example.com",
            grad: "Varaždin",
            iskustvo: "Dvije godine rada u amaterskom kazalištu.",
            motivacija: "Zanima me sudjelovanje u ovom projektu.",
            datum: "2026-11-11",
            status: "uziIzbor",
            razlogOdbijanja: ""
        },
        {
            id: 3,
            oglasId: 3,
            ime: "Petra",
            prezime: "Novak",
            email: "petra@example.com",
            grad: "Rijeka",
            iskustvo: "Glumačke radionice i kazališne predstave.",
            motivacija: "Želim sudjelovati u kazališnoj produkciji.",
            datum: "2026-10-15",
            status: "audicijaOdrzana",
            razlogOdbijanja: ""
        }
    ]);

    const [filter, setFilter] = useState("sve");
    const [otvorenaPrijava, setOtvorenaPrijava] = useState(null);
    const [prijavaZaOdbijanje, setPrijavaZaOdbijanje] = useState(null);
    const [razlogOdbijanja, setRazlogOdbijanja] = useState("");

    //vrijednosti statusa i njihovi nazivi za prikaz
    const naziviStatusa = {
        predana: "Predana",
        uPregledu: "U pregledu",
        uziIzbor: "Uži izbor",
        pozvanNaAudiciju: "Pozvan na audiciju",
        audicijaOdrzana: "Audicija održana",
        odabran: "Odabran",
        odbijen: "Odbijen"
    };

    //sljedeći dopušteni korak u ovom testnom prikazu
    const sljedeciStatus = {
        predana: "uPregledu",
        uPregledu: "uziIzbor",
        uziIzbor: "pozvanNaAudiciju",
        pozvanNaAudiciju: "audicijaOdrzana",
        audicijaOdrzana: "odabran"
    };

    const naziviRadnji = {
        predana: "Označi kao u pregledu",
        uPregledu: "Dodaj u uži izbor",
        uziIzbor: "Pozovi na audiciju",
        pozvanNaAudiciju: "Označi audiciju održanom",
        audicijaOdrzana: "Odaberi kandidata"
    };

    //najprije izdvajamo prijave odabranog oglasa
    const prijaveOglasa = prijave.filter((prijava) => {
        return prijava.oglasId === oglas?.id;
    });

    //zatim primjenjujemo odabrani statusni filtar
    const filtriranePrijave = prijaveOglasa.filter((prijava) => {
        return filter === "sve" || prijava.status === filter;
    });

    const brojOdabranih = prijaveOglasa.filter((prijava) => {
        return prijava.status === "odabran";
    }).length;

    //promjene su omogućene na objavljenom ili zatvorenom oglasu
    const mozeUpravljati =
        oglas?.status === "objavljen" ||
        oglas?.status === "prijaveZatvorene";

    function promijeniFilter(noviFilter) {
        setFilter(noviFilter);
        setPrijavaZaOdbijanje(null);
        setRazlogOdbijanja("");
    }

    function prikaziDetalje(prijava) {
        if (otvorenaPrijava === prijava.id) {
            setOtvorenaPrijava(null);
        } else {
            setOtvorenaPrijava(prijava.id);
        }
    }

    function napredujPrijavu(prijava) {
        if (!mozeUpravljati || prijava.oglasId !== oglas.id) {
            return;
        }

        const noviStatus = sljedeciStatus[prijava.status];

        //konačni statusi nemaju sljedeći korak
        if (!noviStatus) {
            return;
        }

        if (noviStatus === "odabran") {
            const brojMjesta = Number(oglas.brojKandidata);

            if (!Number.isInteger(brojMjesta) || brojMjesta < 1) {
                alert("Oglas nema ispravan broj traženih kandidata.");
                return;
            }

            if (brojOdabranih >= brojMjesta) {
                alert("Već je odabran traženi broj kandidata.");
                return;
            }
        }

        setPrijave((prethodnePrijave) => {
            return prethodnePrijave.map((trenutnaPrijava) => {
                if (trenutnaPrijava.id === prijava.id) {
                    return {
                        ...trenutnaPrijava,
                        status: noviStatus
                    };
                }

                return trenutnaPrijava;
            });
        });

        //zatvaranje obrasca ako je bio otvoren za ovu prijavu
        if (prijavaZaOdbijanje === prijava.id) {
            odustaniOdOdbijanja();
        }

        console.log("Promjena statusa prijave:", prijava.id, noviStatus);
    }

    function zapocniOdbijanje(prijava) {
        setPrijavaZaOdbijanje(prijava.id);
        setRazlogOdbijanja("");
    }

    function odustaniOdOdbijanja() {
        setPrijavaZaOdbijanje(null);
        setRazlogOdbijanja("");
    }

    function odbijPrijavu(prijava) {
        if (
            !mozeUpravljati ||
            prijava.oglasId !== oglas.id ||
            prijava.status === "odabran" ||
            prijava.status === "odbijen"
        ) {
            return;
        }

        const razlog = razlogOdbijanja.trim();

        if (razlog === "") {
            alert("Morate unijeti razlog odbijanja!");
            return;
        }

        setPrijave((prethodnePrijave) => {
            return prethodnePrijave.map((trenutnaPrijava) => {
                if (trenutnaPrijava.id === prijava.id) {
                    return {
                        ...trenutnaPrijava,
                        status: "odbijen",
                        razlogOdbijanja: razlog
                    };
                }

                return trenutnaPrijava;
            });
        });

        odustaniOdOdbijanja();

        console.log("Odbijena prijava:", prijava.id, razlog);
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
                <p>Ukupno prijava: {prijaveOglasa.length}</p>
                <p>
                    Odabrani kandidati: {brojOdabranih}
                    {" / "}
                    {oglas.brojKandidata}
                </p>

                <p className="prijave-napomena">
                    Koriste se testni podaci. Promjene se ne spremaju
                    u bazu i gube se nakon napuštanja stranice.
                </p>

                <button
                    type="button"
                    className="prijave-gumb prijave-gumb-natrag"
                    onClick={onMojiOglasi}
                >
                    Natrag na moje oglase
                </button>
            </div>

            {!mozeUpravljati && (
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
                    onChange={(x) => promijeniFilter(x.target.value)}
                >
                    <option value="sve">Sve prijave</option>
                    <option value="predana">Predane</option>
                    <option value="uPregledu">U pregledu</option>
                    <option value="uziIzbor">Uži izbor</option>
                    <option value="pozvanNaAudiciju">
                        Pozvani na audiciju
                    </option>
                    <option value="audicijaOdrzana">
                        Audicija održana
                    </option>
                    <option value="odabran">Odabrani</option>
                    <option value="odbijen">Odbijeni</option>
                </select>
            </div>

            {/*prazan popis ili prijave koje odgovaraju filtru*/}
            {filtriranePrijave.length === 0 ? (
                <p className="prijave-prazno">
                    {prijaveOglasa.length === 0
                        ? "Na ovaj oglas još nema prijava."
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
                                {prijava.ime} {prijava.prezime}
                            </h3>

                            <div className="prijave-podaci">
                                <p>Grad: {prijava.grad}</p>
                                <p>Datum prijave: {prijava.datum}</p>

                                <p className="prijave-status">
                                    Status: {naziviStatusa[prijava.status]}
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
                                    sljedeciStatus[prijava.status] && (
                                        <button
                                            type="button"
                                            className="prijave-gumb prijave-gumb-status"
                                            onClick={() =>
                                                napredujPrijavu(prijava)
                                            }
                                        >
                                            {naziviRadnji[prijava.status]}
                                        </button>
                                    )}

                                {mozeUpravljati &&
                                    prijava.status !== "odabran" &&
                                    prijava.status !== "odbijen" && (
                                        <button
                                            type="button"
                                            className="prijave-gumb prijave-gumb-odbij"
                                            onClick={() =>
                                                zapocniOdbijanje(prijava)
                                            }
                                        >
                                            Odbij
                                        </button>
                                    )}
                            </div>

                            {/*detalji samo odabrane prijave*/}
                            {otvorenaPrijava === prijava.id && (
                                <div className="prijave-detalji">
                                    <p>Email: {prijava.email}</p>
                                    <p>Iskustvo: {prijava.iskustvo}</p>
                                    <p>Motivacija: {prijava.motivacija}</p>
                                </div>
                            )}

                            {prijava.status === "odbijen" && (
                                <p className="prijave-razlog">
                                    Razlog odbijanja:
                                    {" "}
                                    {prijava.razlogOdbijanja}
                                </p>
                            )}

                            {/*obrazac odbijanja odabrane prijave*/}
                            {prijavaZaOdbijanje === prijava.id && (
                                <form
                                    className="prijave-obrazac"
                                    onSubmit={(x) => {
                                        x.preventDefault();
                                        odbijPrijavu(prijava);
                                    }}
                                >
                                    <div className="prijave-polje">
                                        <label
                                            htmlFor={`razlog-prijave-${prijava.id}`}
                                        >
                                            Razlog odbijanja:
                                        </label>

                                        <textarea
                                            id={`razlog-prijave-${prijava.id}`}
                                            className="prijave-unos"
                                            name="razlogOdbijanja"
                                            rows={4}
                                            maxLength={2000}
                                            value={razlogOdbijanja}
                                            onChange={(x) =>
                                                setRazlogOdbijanja(
                                                    x.target.value
                                                )
                                            }
                                            required
                                        />
                                    </div>

                                    <div className="prijave-akcije">
                                        <button
                                            type="submit"
                                            className="prijave-gumb prijave-gumb-odbij"
                                        >
                                            Potvrdi odbijanje
                                        </button>

                                        <button
                                            type="button"
                                            className="prijave-gumb prijave-gumb-odustani"
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
        </main>
    );
}

export default PregledPrijava;