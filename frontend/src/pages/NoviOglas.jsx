//stranica za stvaranje novog casting oglasa
import { useRef, useState } from "react";
import { zahtjevPoslodavca } from "../services/poslodavac";

function NoviOglas({onMojiOglasi, oglasZaUredivanje, csrfToken}) {
    const [naziv, setNaziv] = useState(oglasZaUredivanje?.naziv ?? "");
    const [vrstaProjekta, setVrstaProjekta] = useState(oglasZaUredivanje?.projectType ?? "");
    const [opisProjekta, setOpisProjekta] = useState(oglasZaUredivanje?.projectDescription ?? "");
    const [opisUloge, setOpisUloge] = useState(oglasZaUredivanje?.roleDescription ?? "");
    const [uloga, setUloga] = useState(oglasZaUredivanje?.uloga ?? "");
    const [rokPrijava, setRokPrijava] = useState(oglasZaUredivanje?.rokPrijava ?? "");
    const [brojKandidata, setBrojKandidata] = useState(oglasZaUredivanje?.brojKandidata ?? "");
    const [maxPrijava, setMaxPrijava] = useState(oglasZaUredivanje?.maxPrijava ?? "1000");
    const [lokacija, setLokacija] = useState(oglasZaUredivanje?.location ?? "");
    const [minimalnaDob, setMinimalnaDob] = useState(oglasZaUredivanje?.minAge ?? "");
    const [maksimalnaDob, setMaksimalnaDob] = useState(oglasZaUredivanje?.maxAge ?? "");
    const [tekstAudicije, setTekstAudicije] = useState(oglasZaUredivanje?.auditionText ?? "");
    const [zahtjeviIzgleda, setZahtjeviIzgleda] = useState(oglasZaUredivanje?.appearanceReq ?? "");
    const [trazenoIskustvo, setTrazenoIskustvo] = useState(oglasZaUredivanje?.experienceReq ?? "");
    const [idOglasa, setIdOglasa] = useState(oglasZaUredivanje?.id ?? null);
    const [spremanje, setSpremanje] = useState(false);
    const [greska, setGreska] = useState("");
    const [poruka, setPoruka] = useState("");
    const zahtjevUTijeku = useRef(false);
    const dopustenoUredivanje = !oglasZaUredivanje || ["nacrt", "draft"].includes(oglasZaUredivanje.status);

    //naziv i vrsta projekta potrebni su i za nacrt
    function provjeriProjekt() {
        if (naziv.trim() === "") {
            alert("Unesite naziv projekta!");
            return false;
        }

        if (naziv.trim().length > 200) {
            alert("Naziv projekta smije imati najviše 200 znakova!");
            return false;
        }

        if (
            vrstaProjekta.trim() === "" ||
            vrstaProjekta.trim().length > 20
        ) {
            alert("Odaberite ispravnu vrstu projekta!");
            return false;
        }

        if (opisProjekta.trim().length > 2000 || opisUloge.trim().length > 2000) {
            alert("Opis projekta i opis uloge mogu imati najviše 2000 znakova.");
            return false;
        }

        if (uloga.trim().length > 200) {
            alert("Naziv uloge može imati najviše 200 znakova.");
            return false;
        }

        if (lokacija.trim().length > 200) {
            alert("Lokacija može imati najviše 200 znakova.");
            return false;
        }

        if (tekstAudicije.trim().length > 5000) {
            alert("Tekst za audiciju može imati najviše 5000 znakova.");
        return false;
        }

        if (zahtjeviIzgleda.trim().length > 1000 || trazenoIskustvo.trim().length > 1000) {
            alert("Zahtjevi izgleda i iskustva mogu imati najviše 1000 znakova.");
            return false;
        }

        return true;
    }

    function provjeriBrojeve() {
        if (
            String(brojKandidata).trim() !== "" &&
            (
                !Number.isSafeInteger(Number(brojKandidata)) ||
                Number(brojKandidata) < 1 ||
                Number(brojKandidata) > 2147483647
            )
        ) {
            alert("Broj kandidata mora biti pozitivan cijeli broj do 2147483647.");
            return false;
        }

        if (
            String(maxPrijava).trim() === "" ||
            !Number.isSafeInteger(Number(maxPrijava)) ||
            Number(maxPrijava) < 1 ||
            Number(maxPrijava) > 1000
        ) {
            alert("Maksimalan broj prijava mora biti cijeli broj od 1 do 1000.");
            return false;
        }

        for (const dob of [minimalnaDob, maksimalnaDob]) {
            if (
                String(dob).trim() !== "" &&
                (
                    !Number.isSafeInteger(Number(dob)) ||
                    Number(dob) < 18 ||
                    Number(dob) > 2147483647
                )
            ) {
                alert("Dob mora biti cijeli broj od 18 do 2147483647.");
                return false;
            }
        }
    
        if (
            String(minimalnaDob).trim() !== "" &&
            String(maksimalnaDob).trim() !== "" &&
            Number(maksimalnaDob) < Number(minimalnaDob)
        ) {
            alert("Maksimalna dob mora biti veća ili jednaka minimalnoj.");
            return false;
        }

        return true;
    }

    function pripremiPodatke() {
        const brojIliNull = (vrijednost) =>
            String(vrijednost).trim() === ""
                ? null
                : Number(vrijednost);

        return {
            projectTitle: naziv.trim(),
            projectType: vrstaProjekta.trim(),
            projectDescription: opisProjekta.trim() || null,
            roleTitle: uloga.trim() || null,
            roleDescription: opisUloge.trim() || null,
            location: lokacija.trim() || null,

            applicationDeadline: rokPrijava || null,
            positionsCount: brojIliNull(brojKandidata),
            maxApplications: Number(maxPrijava),
            minAge: brojIliNull(minimalnaDob),
            maxAge: brojIliNull(maksimalnaDob),

            auditionText: tekstAudicije.trim() || null,
            appearanceReq: zahtjeviIzgleda.trim() || null,
            experienceReq: trazenoIskustvo.trim() || null
        };
    }

    async function spremiNaBackend(zaObjavu) {
        if (zahtjevUTijeku.current) {
            return;
        }

        setGreska("");
        setPoruka("");

        if (!dopustenoUredivanje) {
            setGreska("Uređivati se može samo nacrt oglasa.");
            return;
        }

        if (!csrfToken) {
            setGreska(
                "Nedostaje sigurnosni token. Ponovno se prijavite kao poslodavac."
            );
            return;
        }

        //nacrt može imati prošli rok, ali datum mora biti ispravan.
        if (rokPrijava) {
            const rok = new Date(`${rokPrijava}T23:59:59.999Z`);

            if (
                !Number.isFinite(rok.getTime()) ||
                rok.toISOString().slice(0, 10) !== rokPrijava
            ) {
                setGreska("Unesite ispravan datum roka prijave.");
                return;
            }
        }

        zahtjevUTijeku.current = true;
        setSpremanje(true);

        let nacrtSpremljen = false;

        try {
            const odgovor = await zahtjevPoslodavca(
                idOglasa ? `/castings/${idOglasa}` : "/castings",
                {
                    metoda: idOglasa ? "PATCH" : "POST",
                    csrfToken,
                    podaci: pripremiPodatke()
                }
            );

            const spremljeniId = odgovor?.id;

            if (
                !Number.isSafeInteger(spremljeniId) ||
                spremljeniId <= 0
            ) {
                throw new Error(
                    "Backend nije vratio ispravan ID spremljenog oglasa."
                );
            }

            setIdOglasa(spremljeniId);
            nacrtSpremljen = true;

            if (zaObjavu) {
                await zahtjevPoslodavca(
                    `/castings/${spremljeniId}/publish`,
                    {
                        metoda: "POST",
                        csrfToken
                    }
                );

                onMojiOglasi();
                return;
            }

            setPoruka(
                "Nacrt je spremljen. Možete nastaviti uređivati ili objaviti oglas."
            );
        } catch (error) {
            const opis =
                error instanceof Error
                    ? error.message
                    : "Zahtjev nije uspio.";

            setGreska(
                zaObjavu && nacrtSpremljen
                    ? `Nacrt je spremljen, ali objava nije uspjela: ${opis}`
                    : opis
            );
        } finally {
            zahtjevUTijeku.current = false;
            setSpremanje(false);
        }
    }

    function spremiNacrt() {
        if (!provjeriProjekt() || !provjeriBrojeve()) {
            return;
        }

        void spremiNaBackend(false);
    }

    function provjeriRok() {
        if (!rokPrijava) {
            return false;
        }

        //jednako tumačenje datuma kao na postojećem backendu.
        const rok = new Date(`${rokPrijava}T23:59:59.999Z`);

        return (
            Number.isFinite(rok.getTime()) &&
            rok.toISOString().slice(0, 10) === rokPrijava &&
            rok.getTime() > Date.now()
        );
    }

    function provjeriPodatke() {
        if (
            lokacija.trim() === "" ||
            String(minimalnaDob).trim() === "" ||
            String(maksimalnaDob).trim() === ""
        ) {
            alert("Za objavu unesite lokaciju i obje dobne granice.");
            return false;
        }

        if (!provjeriProjekt()) {
            return false;
        }

        if (opisProjekta.trim() === "" || opisUloge.trim() === "") {
            alert("Za objavu oglasa unesite opis projekta i opis uloge.");
            return false;
        }

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

        void spremiNaBackend(true);
    }

    function spremiPromjene() {
        spremiNacrt();
    }

    return (
        <main>
            <h1>{oglasZaUredivanje ? "Uredi oglas" : "Novi oglas"}</h1>
            <p>{oglasZaUredivanje ? "Uredite svoj casting oglas." : "Ovdje možete stvoriti novi casting oglas."}</p>

            {greska && <p role="alert">{greska}</p>}
            {poruka && <p role="status">{poruka}</p>}
            {spremanje && (<p role="status">Spremanje je u tijeku…</p>)}
            {!dopustenoUredivanje && (<p role="alert">Uređivati se može samo nacrt oglasa.</p>)}

            {/*obrazac za stvaranje novog oglasa*/}
            <form onSubmit={(event) => event.preventDefault()}>
                <fieldset disabled={spremanje || !dopustenoUredivanje}>
                    <legend>Podaci o projektu i ulozi</legend>
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

                {/*vrsta projekta*/}
                <div className="novi-oglas-polje">
                    <label htmlFor="vrsta-projekta">
                        Vrsta projekta:
                    </label>

                    <select
                        id="vrsta-projekta"
                        name="vrstaProjekta"
                        className="novi-oglas-unos"
                        value={vrstaProjekta}
                        onChange={(x) =>
                            setVrstaProjekta(x.target.value)
                        }
                        required
                    >
                        <option value="">Odaberite vrstu projekta</option>
                        <option value="film">Film</option>
                        <option value="serija">Serija</option>
                        <option value="reklama">Reklama</option>

                        {/*čuvamo postojeću vrijednost iz baze*/}
                        {vrstaProjekta !== "" &&
                            !["film", "serija", "reklama"].includes(
                                vrstaProjekta
                            ) && (
                                <option value={vrstaProjekta}>
                                    {vrstaProjekta}
                                </option>
                            )}
                    </select>
                </div>

                <div className="novi-oglas-polje">
                    <label htmlFor="opis-projekta">Opis projekta</label>

                    <textarea
                        id="opis-projekta"
                        name="opisProjekta"
                        className="novi-oglas-unos"
                        value={opisProjekta}
                        onChange={(event) => setOpisProjekta(event.target.value)}
                        maxLength={2000}
                        rows={5}
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

                <div className="novi-oglas-polje">
                    <label htmlFor="opis-uloge">Opis uloge</label>

                    <textarea
                        id="opis-uloge"
                        name="opisUloge"
                        className="novi-oglas-unos"
                        value={opisUloge}
                        onChange={(event) => setOpisUloge(event.target.value)}
                        maxLength={2000}
                        rows={5}
                    />
                </div>

                <div className="novi-oglas-polje">
                    <label htmlFor="lokacija">Lokacija:</label>
                    <input
                        type="text"
                        id="lokacija"
                        name="lokacija"
                        className="novi-oglas-unos"
                        value={lokacija}
                        onChange={(event) => setLokacija(event.target.value)}
                        maxLength={200}
                    />
                </div>

                <div className="novi-oglas-polje">
                    <label htmlFor="minimalnaDob">Minimalna dob kandidata:</label>
                    <input
                        type="number"
                        id="minimalnaDob"
                        name="minimalnaDob"
                        className="novi-oglas-unos"
                        value={minimalnaDob}
                        onChange={(event) => setMinimalnaDob(event.target.value)}
                        min={18}
                        max={2147483647}
                        step={1}
                    />
                </div>

                <div className="novi-oglas-polje">
                    <label htmlFor="maksimalnaDob">Maksimalna dob kandidata:</label>
                    <input
                        type="number"
                        id="maksimalnaDob"
                        name="maksimalnaDob"
                        className="novi-oglas-unos"
                        value={maksimalnaDob}
                        onChange={(event) => setMaksimalnaDob(event.target.value)}
                        min={18}
                        max={2147483647}
                        step={1}
                    />
                </div>

                <div className="novi-oglas-polje">
                    <label htmlFor="tekstAudicije">
                        Dio scenarija / tekst za audiciju — opcionalno:
                    </label>
                    <textarea
                        id="tekstAudicije"
                        name="tekstAudicije"
                        className="novi-oglas-unos"
                        value={tekstAudicije}
                        onChange={(event) => setTekstAudicije(event.target.value)}
                        maxLength={5000}
                        rows={5}
                    />
                </div>

                <div className="novi-oglas-polje">
                    <label htmlFor="zahtjeviIzgleda">
                        Zahtjevi izgleda — opcionalno:
                    </label>
                    <textarea
                        id="zahtjeviIzgleda"
                        name="zahtjeviIzgleda"
                        className="novi-oglas-unos"
                        value={zahtjeviIzgleda}
                        onChange={(event) => setZahtjeviIzgleda(event.target.value)}
                        maxLength={1000}
                        rows={4}
                    />
                </div>

                <div className="novi-oglas-polje">
                    <label htmlFor="trazenoIskustvo">
                        Traženo iskustvo i vještine — opcionalno:
                    </label>
                    <textarea
                        id="trazenoIskustvo"
                        name="trazenoIskustvo"
                        className="novi-oglas-unos"
                        value={trazenoIskustvo}
                        onChange={(event) => setTrazenoIskustvo(event.target.value)}
                        maxLength={1000}
                        rows={4}
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
                <button type="button" onClick={idOglasa ? spremiPromjene : spremiNacrt}>
                    {idOglasa ? "Spremi promjene nacrta" : "Spremi nacrt"}
                </button>

                <button type="button" onClick={objaviOglas}>
                    Objavi oglas
                </button>

                </fieldset>

                {/*povratak na moji oglasi*/}
                <button type="button" onClick={onMojiOglasi} disabled={spremanje}>
                    Natrag na moje oglase
                </button>

            </form>
            
            
        </main>
    );
}

export default NoviOglas;