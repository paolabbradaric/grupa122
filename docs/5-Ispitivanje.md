# 5. Ispitivanje — autentifikacija i baza

**Izvođenje:** 17. 11. 2026. **Revizija koda:** [bd785d4](https://github.com/paolabbradaric/grupa122/commit/bd785d4265b4a1ed35cfdd254f5f2f9e7c822a4d). **Okruženje:** Windows, Node.js 24.14.0, npm 11.9.0.

Ovo poglavlje bilježi provjere Mariova auth/DB doprinosa i redovnih paketa aktualnog main. Ne predstavlja potvrdu svih poslovnih tokova aplikacije. [Zapisnik i puni ispisi](verification/2026-11-17/README.md) čuvaju dokaze konkretnog izvođenja.

## 5.1 Pristup ispitivanju

[auth.test.js](../backend/test/auth.test.js) provjerava validaciju i stvarni Express/Passport HTTP tok s cookiejima, state/PKCE i CSRF zaštitama. Googleovi mrežni odgovori i korisnički model simuliraju se. Taj paket ne otvara stvarni Google račun niti dokazuje rad cijelog trajnog sustava.

[auth-database.test.js](../backend/test/auth-database.test.js) zasebno provjerava stvarni PostgreSQL korisnički model i sesijski store. Stvara privremene kopije tablica, koristi vanjsku transakciju i rollback. [casting-drafts-database.test.js](../backend/test/casting-drafts-database.test.js) koristi privremene tablice za novu shemu i migraciju nacrta. Testovi ne stvaraju trajne testne korisnike niti migriraju zajedničke tablice.

Redovni npm test uključuje i provjere drugih članova. Preskočeni testovi koji traže posebno lokalno DB okruženje nisu proglašeni izvršenima. Frontend lint i build provjeravaju statičku ispravnost i izgradnju, a ne tok kroz preglednik. Postojeći GitHub workflow generira dijagrame; nije CI dokaz izvršavanja auth testova.

## 5.2 Ispitni slučajevi i sljedivost

ID-ovi A-Txx označavaju provjere auth/DB područja i ne mijenjaju postojeće ID-ove zahtjeva ili UC-ova.

| ID | Zahtjev / UC | Ulaz i koraci | Očekivano | Stvarni rezultat i dokaz |
| --- | --- | --- | --- | --- |
| A-T01 | F-001, F-002, NF-04 / UC-001 | Pokrenuti prvi test auth.test.js: granica 18 godina, nevaljan kalendarski datum, admin uloga i OIB. | Ispravni podaci prolaze, neispravni se odbijaju prije pohrane. | Prošlo; test „validira točnu dob, kalendarski datum, ulogu i OIB”. |
| A-T02 | F-003, F-005, NF-02 / UC-002 | Zadati profil s/bez potvrđenog e-maila; ponoviti ulazak istog vanjskog identiteta. | Prihvaća se potvrđeni google:sub; postojeći račun ne dobiva duplikat. | Prošlo; provjera identiteta i test ponovne prijave u auth.test.js. |
| A-T03 | F-001–F-004 / UC-001, UC-002 | Simulirani Google tok → pending registracija → valjan profil → nova sesija → logout → stari cookie. | Pending nema poslovne ovlasti; dovršetak daje novu sesiju; stari cookie nakon odjave ne vraća prijavu. | Prošlo; integrirani test novog računa u auth.test.js. |
| A-T04 | NF-02 / UC-002 | OAuth callback s pogrešnim ili izostalim state, zatim odustajanje od prijave. | Nema neovlaštene razmjene tokena; vraća se generična ili access_denied pogreška. | Prošlo; dva OAuth negativna testa. |
| A-T05 | NF-01, NF-02 / UC-002 | Pozvati zaštićeni middleware kao gost, pogrešna uloga, bez/uz pogrešan CSRF ili s nedopuštenim Originom. | 401 za gosta, 403 za nedopuštenu ulogu/promjenu, dopušteni zahtjev prolazi. | Prošlo; auth middleware i CSRF testovi, uz dodatne route testove redovnog paketa. |
| A-T06 | NF-02 / UC-002 | Deaktivirati testnog korisnika u simuliranom modelu i ponovno upotrijebiti sesiju. | Aktivni račun se ponovno provjerava i pristup se odbija. | Prošlo; test onemogućenog računa. |
| A-T07 | NF-02, NF-11 | Izostaviti Google ključeve/tajnu i prekoračiti auth limit. | 503 bez OAuth konfiguracije, odbijeno pokretanje bez tajne, 429 i Retry-After za limit. | Prošlo; konfiguracijski i limiter testovi. |
| A-T08 | F-001, F-002, F-005, NF-06 / UC-001 | npm run test:db: registracija obiju uloga, dohvat datuma i identiteta, konflikt e-maila/OIB-a i sesijski set/get/expire/destroy. | Transakcijski upis, datum bez pomaka, rollback konflikta i ispravan sesijski store. | Prošlo; 1 DB test s više tvrdnji, nad privremenim tablicama. |
| A-T09 | F-018, F-019, NF-04 — DB dio | npm run test:db:casting: spremiti/urediti nepotpun draft, pokušati nepotpunu i zatim potpunu objavu. | Draft prolazi; nepotpuna objava i loši brojevi/dob/reference padaju; potpuna objava prolazi. | Prošlo; podtestovi nove sheme i migracije. |
| A-T10 | Migracijski integritet | Isti DB paket: sačuvati postojeće testne retke, ponoviti migraciju i pokušati nadogradnju nevaljanih nenacrta. | Retci ostaju isti; ponavljanje daje isti ugovor; neuspjeh vraća promjene. | Prošlo; podtest rollbacka i usporedba ugovora. |

### Sustavski scenariji koji još nisu izvedeni

| ID | Koraci i preduvjeti | Očekivani ishod | Stanje |
| --- | --- | --- | --- |
| A-S01 | Konfigurirati OAuth klijent i izoliranu testnu bazu; stvarnim Google računima dovršiti kandidata i poslodavca u pregledniku, odjaviti se i ponovno prijaviti. | Isti lokalni račun, odgovarajuća uloga i podaci, bez duplikata. | Nije pokrenuto u ovoj provjeri. |
| A-S02 | Nakon stvarne prijave osvježiti stranicu, ponovno pokrenuti backend i zatim se odjaviti; pokušati stari cookie. | Važeća sesija ponovno se učitava nakon restarta; odjava ukida pristup. | Nije pokrenuto u ovoj provjeri. |
| A-S03 | Dva testna korisnika pokušavaju čitati/mijenjati tuđe podatke kroz svaki konkretni poslovni API. | Vlasništvo se provjerava na backendu i tuđi zapis ostaje zaštićen. | Potrebna koordinirana provjera s vlasnicima poslovnih modula; auth middleware test nije potpuni dokaz. |
| A-S04 | Na javnoj inačici provjeriti HTTPS, cookie postavke, proxy i Google callback. | Sigurna prijava u stvarnom postavljanju. | Nije pokrenuto; javno postavljanje nije potvrđeno ovim zapisnikom. |

## 5.3 Provedene naredbe i rezultati

Sve naredbe iz tablice završile su izlaznim kodom 0.

| Provjera | Naredba / direktorij | Rezultat | Ispis |
| --- | --- | --- | --- |
| Auth paket | node --test test/auth.test.js / backend | 11 uspješnih, 0 neuspješnih, 0 preskočenih | [auth-tests.txt](verification/2026-11-17/auth-tests.txt) |
| Auth i PostgreSQL sesije | npm run test:db / backend, uz postojeću privatnu konfiguraciju veze | 1 uspješan, 0 neuspješnih | [auth-database.txt](verification/2026-11-17/auth-database.txt) |
| Nacrti i migracija | npm run test:db:casting / backend, uz istu vezu | 10 uspješnih, 0 neuspješnih; broj uključuje roditeljski test i podtestove | [casting-drafts-database.txt](verification/2026-11-17/casting-drafts-database.txt) |
| Svi redovni backend testovi | npm test / backend | Ukupno 147: 139 uspješnih, 8 preskočenih, 0 neuspješnih | [backend-tests.txt](verification/2026-11-17/backend-tests.txt) |
| Frontend statička provjera | npm run lint / frontend | Bez prijavljenih pogrešaka | [frontend-lint.txt](verification/2026-11-17/frontend-lint.txt) |
| Frontend izgradnja | npm run build / frontend | Uspješna izgradnja | [frontend-build.txt](verification/2026-11-17/frontend-build.txt) |

Dva auth/draft DB testa koja se preskaču u redovnom paketu izvedena su zasebnim naredbama. Ostale preskočene DB integracije nisu time izvršene. Zasebni auth paket preklapa se s redovnim paketom; rezultate ne treba zbrajati kao neovisne scenarije ili mjeru pokrivenosti.

PlantUML izvori i SVG slike provjereni su zasebno, prema istim imenima u docs/puml/ i docs/assets/diagrams/. Veze između dokumentacije i izvornog koda provjerene su prije PR-a.

## 5.4 Poznati nedostaci i granice dokaza

| Područje | Ograničenje i učinak |
| --- | --- |
| Stvarni Google servis | Simulirani HTTP i zasebni DB test ne dokazuju cijeli tok kroz vanjski Google i preglednik; A-S01 ostaje otvoren. |
| Profili i portfolio | Naknadne izmjene profila još imaju demonstracijsku lokalnu pohranu. F-006–F-008 nisu dovršeni samom registracijom. |
| Demo admin | Samostalna registracija admin uloge odbija se; zaseban ograničeni demo račun nije potvrđen ovim pregledom. |
| Produkcija | HTTPS postavljanje, oporavak, više instanci i stvarni restart nisu provjereni. Limiter je memorijski, a PG račun privilegiran. |
| Poslovni moduli | Middleware uloge ne zamjenjuje provjeru vlasništva, rezervacija, verifikacije i prijelaza statusa u svakom modulu. |
| Neprovedene provjere kvalitete | Nisu izvedena mjerenja NF-05, sustavski testovi Chrome/Firefox, pristupačnost ni sve rezolucije; nema tvrdnje da su ti zahtjevi prošli. |

[Auth API i status zadatka](AUTENTIFIKACIJA.md) · [Baza](BAZA_PODATAKA.md) · [Instalacija](6-Postavljanje-instalacija-i-konfiguracija.md) · [Kazalo](Home.md)
