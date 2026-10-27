//prikaz oglasa poslodavaca na stranici moji oglasi
import {useState} from "react"

function MojiOglasi({onNoviOglas, onUrediOglas}) {
    const oglasi = [
        {
        id: 1,
        naziv: "Studentski kratkometražni film",
        uloga: "Glavna ženska uloga",
        rokPrijava: "2026-11-15",
        brojKandidata: 2,
        maxPrijava: 1000,
        status: "nacrt"
    },
    {
        id: 2,
        naziv: "Reklama za sportski brend",
        uloga: "Sportaš",
        rokPrijava: "2026-12-01",
        brojKandidata: 3,
        maxPrijava: 500,
        status: "objavljen"
    },
    {
        id: 3,
        naziv: "Kazališna predstava Hamlet",
        uloga: "Hamlet",
        rokPrijava: "2026-10-20",
        brojKandidata: 1,
        maxPrijava: 200,
        status: "prijaveZatvorene"
    },
    {
        id: 4,
        naziv: "Televizijska serija",
        uloga: "Sporedna muška uloga",
        rokPrijava: "2026-09-30",
        brojKandidata: 2,
        maxPrijava: 300,
        status: "popunjen"
    },
    {
        id: 5,
        naziv: "Glazbeni spot",
        uloga: "Plesačica",
        rokPrijava: "2026-11-10",
        brojKandidata: 4,
        maxPrijava: 150,
        status: "otkazan"
    }
    ];

    const [filter, setFilter] = useState("svi")
    const [pretraga, setPretraga] = useState("")

    const filtriraniOglasi = oglasi.filter((oglas) => {
        const odgovaraStatus = filter === "svi" || oglas.status === filter;
        const odgovaraNaziv = oglas.naziv.toLowerCase().includes(pretraga.toLowerCase());
        return odgovaraStatus && odgovaraNaziv
    });

    function otkaziOglas(oglas) {
        const potvrda = window.confirm(`Jeste li sigurni da želite otkazati oglas "${oglas.naziv}"?`);
        if (!potvrda) {
            return;
        }

        console.log("Oglas za otkazivanje: ", oglas);
    }

    function zatvoriPrijave(oglas) {
        if(oglas.status !== "objavljen") {
            return;
        }

        const potvrda = window.confirm(
            `Jeste li sigurni da želite zatvoriti prijave za oglas "${oglas.naziv}"?`
        );

        if(!potvrda) {
            return;
        }

        console.log("Zatvaranje prijava za oglas:", oglas.id);
    }

    function objaviNacrt(oglas) {
    // Objavljivati se mogu samo nacrti
    if (oglas.status !== "nacrt") {
        return;
    }

    // Provjera obaveznih polja
    if (!oglas.naziv?.trim() || !oglas.uloga?.trim() ||
        !oglas.rokPrijava || oglas.brojKandidata === "" ||
        oglas.brojKandidata == null ||
        oglas.maxPrijava === "" || oglas.maxPrijava == null) {
        alert("Za objavu oglasa morate ispuniti sva polja!");
        return;
    }

    // Provjera brojčanih vrijednosti
    const broj = Number(oglas.brojKandidata);
    const max = Number(oglas.maxPrijava);

    if (!Number.isInteger(broj) || broj < 1 ||
        !Number.isInteger(max) || max < 1 || max > 1000) {
        alert("Provjerite broj kandidata i maksimalan broj prijava!");
        return;
    }

    // Provjera roka prijave
    const danas = new Date();
    danas.setHours(0, 0, 0, 0);

    const rok = new Date(oglas.rokPrijava);

    if (!Number.isFinite(rok.getTime()) || rok <= danas) {
        alert("Rok prijave mora biti budući datum!");
        return;
    }

    const objavljeniOglas = {
        ...oglas,
        status: "objavljen"
    };

    console.log("Oglas spreman za objavu:", objavljeniOglas);
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

            {filtriraniOglasi.length === 0 ? (
                <p>
                    {filter === "svi" ? "Trenutno nemate oglasa." : "Nema oglasa koji odgovaraju pretraživanju ili odabranom statusu."}
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
                                <button type="button" onClick={() => onUrediOglas(oglas)}> 
                                    Uredi
                                </button>

                                {/* Objavljivanje nacrta */}
                                {oglas.status === "nacrt" && (
                                    <button type="button" onClick={() => objaviNacrt(oglas)}>
                                        Objavi oglas
                                    </button>
                                )}

                                {oglas.status !== "nacrt" && (
                                    <button type="button">
                                        Pregled prijava
                                    </button>
                                )}

                                {oglas.status === "objavljen" && (
                                    <button type="button" onClick={() => zatvoriPrijave(oglas)}>
                                        Zatvori prijave
                                    </button>
                                )}
                                
                                {oglas.status !== "otkazan" && oglas.status !== "popunjen" &&  oglas.status !== "nacrt" &&(
                                    <button type="button" onClick={() => otkaziOglas(oglas)}>
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