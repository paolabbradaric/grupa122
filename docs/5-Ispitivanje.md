# 5. Ispitivanje — autentifikacija i baza

Početno izvođenje: 17. 11. 2026. Revizija koda: [bd785d4](https://github.com/paolabbradaric/grupa122/commit/bd785d4265b4a1ed35cfdd254f5f2f9e7c822a4d). Okruženje: Windows, Node.js 24.14.0, npm 11.9.0. Naknadni rezultati Google dopune iz [PR-a #44](https://github.com/paolabbradaric/grupa122/pull/44) navedeni su zasebno u ovom poglavlju.

Ovo poglavlje bilježi provjere Mariova auth/DB doprinosa i redovnih paketa na navedenim revizijama. Ne predstavlja potvrdu svih poslovnih tokova aplikacije. [Zapisnik i puni ispisi](verification/2026-11-17/README.md) čuvaju dokaze početnog izvođenja na `bd785d4`; [Google prijava](GOOGLE_PRIJAVA.md) opisuje naknadne provjere.

## 5.1 Pristup ispitivanju

[auth.test.js](../backend/test/auth.test.js) provjerava validaciju i stvarni Express/Passport HTTP tok s cookiejima, state/PKCE i CSRF zaštitama. Googleovi mrežni odgovori i korisnički model simuliraju se. Taj paket ne otvara stvarni Google račun niti dokazuje rad cijelog trajnog sustava.

[auth-database.test.js](../backend/test/auth-database.test.js) zasebno provjerava stvarni PostgreSQL korisnički model i sesijski store. Stvara privremene kopije tablica, koristi vanjsku transakciju i rollback. [casting-drafts-database.test.js](../backend/test/casting-drafts-database.test.js) koristi privremene tablice za novu shemu i migraciju nacrta. Testovi ne stvaraju trajne testne korisnike niti migriraju zajedničke tablice.

Redovni npm test uključuje i provjere drugih članova. Preskočeni testovi koji traže posebno lokalno DB okruženje nisu proglašeni izvršenima. Frontend lint i build provjeravaju statičku ispravnost i izgradnju, a ne tok kroz preglednik. Postojeći GitHub workflow generira dijagrame; nije CI dokaz izvršavanja auth testova.

## 5.2 Ispitni slučajevi i sljedivost

ID-ovi A-Txx označavaju provjere auth/DB područja i ne mijenjaju postojeće ID-ove zahtjeva ili UC-ova.

### A-T01

Ova provjera odnosi se na F-001, NF-04 / UC-001. Pokrenuti prvi test auth.test.js: granica 18 godina, nevaljan kalendarski datum, admin uloga i OIB. Očekivano ponašanje: Ispravni podaci prolaze, neispravni se odbijaju prije pohrane. Prošlo; test „validira točnu dob, kalendarski datum, ulogu i OIB”.

### A-T02

Ova provjera odnosi se na F-002, NF-02 / UC-002. Zadati profil s/bez potvrđenog e-maila; ponoviti ulazak istog vanjskog identiteta. Očekivano ponašanje: Prihvaća se potvrđeni google:sub; postojeći račun ne dobiva duplikat. Prošlo; provjera identiteta i test ponovne prijave u auth.test.js.

### A-T03

Ova provjera odnosi se na F-001–F-003 / UC-001, UC-002. Simulirani Google tok, zatim pending registracija, zatim valjan profil, zatim nova sesija, zatim logout, zatim stari cookie. Očekivano ponašanje: Pending nema poslovne ovlasti; dovršetak daje novu sesiju; stari cookie nakon odjave ne vraća prijavu. Prošlo; integrirani test novog računa u auth.test.js.

### A-T04

Ova provjera odnosi se na NF-02 / UC-002. OAuth callback s pogrešnim ili izostalim state, zatim odustajanje od prijave. Očekivano ponašanje: Nema neovlaštene razmjene tokena; vraća se generična ili access_denied pogreška. Prošlo; dva OAuth negativna testa.

### A-T05

Ova provjera odnosi se na NF-01, NF-02 / UC-002. Pozvati zaštićeni middleware kao gost, pogrešna uloga, bez/uz pogrešan CSRF ili s nedopuštenim Originom. Očekivano ponašanje: 401 za gosta, 403 za nedopuštenu ulogu/promjenu, dopušteni zahtjev prolazi. Prošlo; auth middleware i CSRF testovi, uz dodatne route testove redovnog paketa.

### A-T06

Ova provjera odnosi se na NF-02 / UC-002. Deaktivirati testnog korisnika u simuliranom modelu i ponovno upotrijebiti sesiju. Očekivano ponašanje: Aktivni račun se ponovno provjerava i pristup se odbija. Prošlo; test onemogućenog računa.

### A-T07

Ova provjera odnosi se na NF-02, NF-11. Izostaviti Google ključeve/tajnu i prekoračiti auth limit. Početni zapisnik na `bd785d4` potvrđuje 503 bez OAuth konfiguracije, odbijeno pokretanje bez tajne te 429 i Retry-After za limit. Nakon PR-a #44 JSON API zadržava 503/429, a OAuth navigacija preglednika dobiva 302 na frontend s `authError=google_not_configured` ili `authError=rate_limited`; pri ograničenju ostaje Retry-After. Onboarding zadržava JSON 429 i kada zahtjev prihvaća HTML. Naknadni auth testovi potvrđuju oba ugovora.

### A-T08

Ova provjera odnosi se na F-001, F-002, NF-06 / UC-001. npm run test:db: registracija obiju uloga, dohvat datuma i identiteta, konflikt e-maila/OIB-a i sesijski set/get/expire/destroy. Očekivano ponašanje: Transakcijski upis, datum bez pomaka, rollback konflikta i ispravan sesijski store. Prošlo; 1 DB test s više tvrdnji, nad privremenim tablicama.

### A-T09

Ova provjera odnosi se na F-012, NF-04 — DB dio. npm run test:db:casting: spremiti/urediti nepotpun draft, pokušati nepotpunu i zatim potpunu objavu. Očekivano ponašanje: Draft prolazi; nepotpuna objava i loši brojevi/dob/reference padaju; potpuna objava prolazi. Prošlo; podtestovi nove sheme i migracije.

### A-T10

Ova provjera odnosi se na Migracijski integritet. Isti DB paket: sačuvati postojeće testne retke, ponoviti migraciju i pokušati nadogradnju nevaljanih nenacrta. Očekivano ponašanje: Retci ostaju isti; ponavljanje daje isti ugovor; neuspjeh vraća promjene. Prošlo; podtest rollbacka i usporedba ugovora.

### Sustavski scenariji i stanje provjere

### A-S01

Planirani postupak: konfigurirati OAuth klijent i izoliranu testnu bazu; stvarnim Google računima dovršiti kandidata i poslodavca u pregledniku, odjaviti se i ponovno prijaviti. Očekuje se isti lokalni račun, odgovarajuća uloga i podaci, bez duplikata. Početno izvođenje na `bd785d4` nije uključivalo taj scenarij. Naknadni [PR #44](https://github.com/paolabbradaric/grupa122/pull/44) potvrđuje kandidatsku registraciju, odjavu i ponovnu prijavu u lokalno pokrenutoj aplikaciji uz konfiguriranu zajedničku bazu: ostaju isti lokalni ID, uloga i jedan profil. Stvarni poslodavački dio i puni scenarij na izoliranoj bazi nisu potvrđeni tom provjerom; registracija poslodavca pokrivena je automatiziranim HTTP/DB testovima.

### A-S02

Nakon stvarne prijave osvježiti stranicu, ponovno pokrenuti backend i zatim se odjaviti; pokušati stari cookie. Očekuje se da se važeća sesija ponovno učita nakon restarta, a odjava ukine pristup. U početnom izvođenju na `bd785d4` scenarij nije pokrenut. Naknadna [Google provjera](GOOGLE_PRIJAVA.md) potvrđuje očuvanje stvarne kandidatske prijave nakon osvježavanja i uklanjanje aktivne PostgreSQL sesije pri odjavi. Ponovna uporaba starog cookieja pokrivena je HTTP testom; stvarni restart sustava uz očuvanje postojeće prijave nije provjeren. Scenarij zato ostaje djelomično potvrđen.

### A-S03

Dva testna korisnika pokušavaju čitati/mijenjati tuđe podatke kroz svaki konkretni poslovni API. Očekuje se sljedeći ishod: Vlasništvo se provjerava na backendu i tuđi zapis ostaje zaštićen. Potrebna koordinirana provjera s vlasnicima poslovnih modula; auth middleware test nije potpuni dokaz.

### A-S04

Na javnoj inačici provjeriti HTTPS, cookie postavke, proxy i Google callback. Očekuje se sljedeći ishod: Sigurna prijava u stvarnom postavljanju. Nije pokrenuto; javno postavljanje nije potvrđeno ovim zapisnikom.

## 5.3 Provedene naredbe i rezultati

Sljedeći sačuvani rezultati pripadaju početnoj reviziji `bd785d4`; sve navedene naredbe završile su izlaznim kodom 0.

Auth paket. Naredba se izvodi ovako: node --test test/auth.test.js / backend. Rezultat: 11 uspješnih, 0 neuspješnih, 0 preskočenih. Sačuvan je [ispis izvođenja](verification/2026-11-17/auth-tests.txt).

Auth i PostgreSQL sesije. Naredba se izvodi ovako: npm run test:db / backend, uz postojeću privatnu konfiguraciju veze. Rezultat: 1 uspješan, 0 neuspješnih. Sačuvan je [ispis izvođenja](verification/2026-11-17/auth-database.txt).

Nacrti i migracija. Naredba se izvodi ovako: npm run test:db:casting / backend, uz istu vezu. Rezultat: 10 uspješnih, 0 neuspješnih; broj uključuje roditeljski test i podtestove. Sačuvan je [ispis izvođenja](verification/2026-11-17/casting-drafts-database.txt).

Svi redovni backend testovi. Naredba se izvodi ovako: npm test / backend. Rezultat: Ukupno 147: 139 uspješnih, 8 preskočenih, 0 neuspješnih. Sačuvan je [ispis izvođenja](verification/2026-11-17/backend-tests.txt).

Frontend statička provjera. Naredba se izvodi ovako: npm run lint / frontend. Rezultat: Bez prijavljenih pogrešaka. Sačuvan je [ispis izvođenja](verification/2026-11-17/frontend-lint.txt).

Frontend izgradnja. Naredba se izvodi ovako: npm run build / frontend. Rezultat: Uspješna izgradnja. Sačuvan je [ispis izvođenja](verification/2026-11-17/frontend-build.txt).

Dva auth/draft DB testa koja se preskaču u redovnom paketu izvedena su zasebnim naredbama. Ostale preskočene DB integracije nisu time izvršene. Zasebni auth paket preklapa se s redovnim paketom; rezultate ne treba zbrajati kao neovisne scenarije ili mjeru pokrivenosti.

PlantUML izvori i SVG slike provjereni su zasebno, prema istim imenima u docs/puml/ i docs/assets/diagrams/. Veze između dokumentacije i izvornog koda provjerene su prije PR-a.

### 5.3.1 Naknadna Google provjera

[PR #44](https://github.com/paolabbradaric/grupa122/pull/44), spojen u `f42e73d`, bilježi 14 uspješnih auth testova i redovni backend paket sa 142 uspješna i 8 preskočenih testova, bez pada. Zasebni auth PostgreSQL test prolazi 1/1, a frontend lint i build prolaze. [Google prijava](GOOGLE_PRIJAVA.md#stanje-provjere-17-11-2026) opisuje okruženje, stvarne kandidatske scenarije i preostale granice.

Stvarna provjera uključuje prvi kandidatski profil, ponovnu prijavu bez duplikata, osvježavanje i odjavu s uklanjanjem sesije iz baze. Stvarni poslodavački ulazak, ručno otkazivanje na Googleovoj stranici, organizacijski računi, restart s postojećom sesijom i produkcija nisu potvrđeni tim izvođenjem. Stari ispisi s 11 auth i 139 redovnih uspješnih testova ostaju povijesni dokaz revizije `bd785d4`; ne zamjenjuju se novim brojevima.

## 5.4 Poznati nedostaci i granice dokaza

Stvarni Google servis. Lokalni kandidatski tok potvrđen je zasebnim stvarnim Google računom u opsegu PR-a #44. A-S01/A-S02 ostaju djelomično potvrđeni: stvarni poslodavac, restart s postojećom prijavom i dio negativnih scenarija nisu ručno izvedeni. Automatizirani HTTP/DB testovi imaju zasebnu dokaznu vrijednost.

Profili i portfolio. Naknadne izmjene profila još imaju demonstracijsku lokalnu pohranu. F-004–F-005 nisu dovršeni samom registracijom.

Demo admin. Samostalna registracija admin uloge odbija se; zaseban ograničeni demo račun nije potvrđen ovim pregledom.

Produkcija. HTTPS postavljanje, oporavak, više instanci i stvarni restart nisu provjereni. Limiter je memorijski, a PG račun privilegiran.

Poslovni moduli. Middleware uloge ne zamjenjuje provjeru vlasništva, rezervacija, verifikacije i prijelaza statusa u svakom modulu.

Neprovedene provjere kvalitete. Nisu izvedena mjerenja NF-05, sustavski testovi Chrome/Firefox, pristupačnost ni sve rezolucije; nema tvrdnje da su ti zahtjevi prošli.

[Auth API i status zadatka](AUTENTIFIKACIJA.md), [Baza](BAZA_PODATAKA.md), [Instalacija](6-Postavljanje-instalacija-i-konfiguracija.md), [Kazalo](Home.md)
