//stranica za stvaranje novog casting oglasa
import { useState } from "react";

function NoviOglas({onMojiOglasi, oglasZaUredivanje}) {
    const [naziv, setNaziv] = useState(oglasZaUredivanje?.naziv ?? "");
    const [uloga, setUloga] = useState(oglasZaUredivanje?.uloga ?? "");
    const [rokPrijava, setRokPrijava] = useState(oglasZaUredivanje?.rokPrijava ?? "");
    const [brojKandidata, setBrojKandidata] = useState(oglasZaUredivanje?.brojKandidata ?? "");
    const [maxPrijava, setMaxPrijava] = useState(oglasZaUredivanje?.maxPrijava ?? "1000");

    function provjeriBrojeve() {
        if (brojKandidata !== "" &&
            (!Number.isInteger(Number(brojKandidata)) ||
            Number(brojKandidata) < 1)) {
            alert("Broj kandidata mora biti pozitivan cijeli broj!");
            return false;
        }

        if (maxPrijava !== "" &&
            (!Number.isInteger(Number(maxPrijava)) ||
            Number(maxPrijava) < 1 ||
            Number(maxPrijava) > 1000)) {
            alert("Maksimalan broj prijava mora biti između 1 i 1000!");
            return false;
        }

        return true;
    }

    function spremiNacrt() {
        if(!provjeriBrojeve()) {return;}

        const noviOglas = {
            naziv: naziv,
            uloga: uloga,
            rokPrijava: rokPrijava,
            brojKandidata: brojKandidata,
            maxPrijava:maxPrijava,
            status: "nacrt"
        };

        console.log("Nacrt oglasa: ", noviOglas);
    }

    function provjeriRok() {
        if (!rokPrijava) {
            return false;
        }

        const danas = new Date();
        danas.setHours(0, 0, 0, 0);

        const rok = new Date(rokPrijava);

        return rok > danas;
    }

    function provjeriPodatke() {
        if (!provjeriBrojeve()) {
            return false;
        }

        if (naziv.trim() === "" || uloga.trim() === "" ||
            rokPrijava === "" || brojKandidata === "" ||
            maxPrijava === "") {
            alert("Morate ispuniti sva polja!");
            return false;
        }

        if (!provjeriRok()) {
            alert("Rok prijave mora biti budući datum!");
            return false;
        }

        return true;
    }

    function objaviOglas() {
        if (!provjeriPodatke()) {
            return;
        }

        const noviOglas = {
            naziv: naziv,
            uloga: uloga,
            rokPrijava: rokPrijava,
            brojKandidata: brojKandidata,
            maxPrijava:maxPrijava,
            status: "objavljen"
        };

        console.log("Oglas za objavu: ", noviOglas);
    }

    function spremiPromjene() {
        if (oglasZaUredivanje.status === "nacrt") {
            if (!provjeriBrojeve()) {
                return;
            }
        } else {
            if (!provjeriPodatke()) {
                return;
            }
        }

        const izmijenjeniOglas = {
            id: oglasZaUredivanje.id,
            naziv: naziv,
            uloga: uloga,
            rokPrijava: rokPrijava,
            brojKandidata: brojKandidata,
            maxPrijava: maxPrijava,
            status: oglasZaUredivanje.status
        }

        console.log("Izmijenjeni oglas: ", izmijenjeniOglas);
    }

    return (
        <main>
            <h1>{oglasZaUredivanje ? "Uredi oglas" : "Novi oglas"}</h1>
            <p>{oglasZaUredivanje ? "Uredite svoj casting oglas." : "Ovdje možete stvoriti novi casting oglas."}</p>

            {/*obrazac za stvaranje novog oglasa*/}
            <form>
                {/*naziv projetka*/}
                <div>
                    <label htmlFor="naziv">Naziv projekta:</label>
                    <input
                        type="text"
                        id="naziv"
                        name="naziv"
                        value={naziv}
                        onChange={(x) => setNaziv(x.target.value)}
                        placeholder="Unesite naziv projekta..."
                        required
                    />
                </div>
                
                {/*uloga*/}
                <div>
                    <label htmlFor="uloga">Uloga:</label>
                    <input
                        type="text"
                        id="uloga"
                        name="uloga"
                        value={uloga}
                        onChange={(x) => setUloga(x.target.value)}
                        placeholder="Unesite naziv uloge..."
                        required
                    />
                </div>

                {/*rok prijave*/}
                <div>
                    <label htmlFor="rokPrijava">Rok prijava:</label>
                    <input
                        type="date"
                        id="rokPrijava"
                        name="rokPrijava"
                        value={rokPrijava}
                        onChange={(x) => setRokPrijava(x.target.value)}
                        required
                    />
                </div>

                {/*broj traženih kandidata*/}
                <div>
                    <label htmlFor="brojKandidata">Broj traženih kandidata:</label>
                    <input
                        type="number"
                        id="brojKandidata"
                        name="brojKandidata"
                        value={brojKandidata}
                        onChange={(x) => setBrojKandidata(x.target.value)}
                        min="1"
                        step="1" 
                        required
                    />
                </div>

                {/*maksimalan broj prijava*/}
                <div>
                    <label htmlFor="maxPrijava">Maksimalan broj prijava:</label>
                    <input
                        type="number"
                        id="maxPrijava"
                        name="maxPrijava"
                        max="1000"
                        min="1"
                        placeholder="max 1000"
                        value={maxPrijava}
                        onChange={(x) => setMaxPrijava(x.target.value)}
                        step="1" 
                        required
                    />
                </div>

                {/* Različiti gumbi za uređivanje i stvaranje oglasa */}
                {oglasZaUredivanje ? (
                    <button type="button" onClick={spremiPromjene}>
                        Spremi promjene
                    </button>
                    ) : (
                    <>
                        <button type="button" onClick={objaviOglas}>
                            Objavi oglas
                        </button>

                        <button type="button" onClick={spremiNacrt}>
                            Spremi nacrt
                        </button>
                    </>
                )}

                {/*povratak na moji oglasi*/}
                <button type="button" onClick={onMojiOglasi}>
                    Odustani
                </button>

            </form>
            
            
        </main>
    );
}

export default NoviOglas;