# 2. Analiza zahtjeva — CastMeIfYouCan

Verzija: Priprema za M0 (4. tjedan), 28. 10. 2026.

Projekt: CastMeIfYouCan — stranica na kojoj kandidati pronalaze casting oglase i prijavljuju se, a poslodavci objavljuju oglase i biraju kandidate.

Ovdje smo napisali što naša aplikacija treba raditi i kako ćemo provjeriti je li sve napravljeno. Dio stranica već postoji, ali nisu sve povezane s backendom i bazom. Zato zahtjevi opisuju što planiramo napraviti, a ne samo što je već gotovo.

## 2.1 Funkcijski zahtjevi

Ovo su funkcije koje naša aplikacija treba imati. Svaka ima oznaku, prioritet, izvor i kriterij po kojem ćemo provjeriti radi li. Visok znači najvažnije, Srednji važne dodatne funkcije, a Nizak stvari koje nisu ključne za osnovni rad.

### F-001

Kandidat se prvi put prijavljuje putem OAuth 2.0 / OpenID Connect i dovršava svoj profil. Nakon uspješne prijave kandidat odabire ulogu i unosi potrebne podatke. Račun nastaje samo za osobe s najmanje 18 godina; neispravni ili nepotpuni podaci ne spremaju se. Prioritet je visok. Izvor zahtjeva: Dogovor tima o OAuth/OIDC prijavi.

### F-002

Poslodavac se prvi put prijavljuje putem OAuth 2.0 / OpenID Connect i unosi podatke svoje tvrtke. Nakon vanjske prijave poslodavac odabire ulogu i upisuje naziv tvrtke, OIB, kontakt i sjedište. Neispravni podaci odbijaju se; račun nije automatski verificiran. Prioritet je visok. Izvor zahtjeva: Dogovor tima o OAuth/OIDC prijavi.

### F-003

Korisnici se prijavljuju putem vanjskog OAuth 2.0 / OpenID Connect pružatelja identiteta. Korisnik se preusmjerava pružatelju identiteta. Uspješna prijava otvara korisničku sesiju s njegovom ulogom, a neuspjela ili otkazana prijava ne dopušta zaštićene funkcije. Prioritet je visok. Izvor zahtjeva: Dogovor tima (28. 10. 2026.).

### F-004

Prijavljeni korisnik može se odjaviti iz aplikacije. Nakon odjave korisnik ne može izvršavati radnje koje zahtijevaju prijavu, čak ni izravnim slanjem API zahtjeva sa starom sesijom. Prioritet je visok. Izvor zahtjeva: Plan razvoja tima.

### F-005

Aplikacija prepoznaje korisnika pri ponovnoj OAuth/OIDC prijavi i povezuje ga s njegovim postojećim profilom. Kada se korisnik drugi put prijavi preko istog vanjskog identiteta, otvara mu se postojeći profil sa spremljenim podacima. Ne stvara se novi račun i drugi vanjski identitet ne može preuzeti taj profil. Prioritet je visok. Izvor zahtjeva: Razrada dogovorene OAuth/OIDC prijave.

### F-006

Kandidat može pregledavati i uređivati svoj profil, iskustvo i vještine. Kandidat može spremiti ime, prezime, grad, iskustvo, vještine te ponuđene fizičke karakteristike; izmjene se vide nakon ponovne prijave, a drugi kandidat ne može mijenjati taj profil. Prioritet je visok. Izvor zahtjeva: Plan razvoja tima.

### F-007

Kandidat može dodati profilnu sliku i najviše pet JPG/PNG slika u portfolio. Kandidat može dodati i ukloniti fotografije te ih ponovno pregledati nakon prijave; više od pet fotografija ili nepodržan format odbijaju se bez neispravne pohrane. Prioritet je srednji. Izvor zahtjeva: Plan razvoja tima.

### F-008

Poslodavac može pregledavati i uređivati podatke o svojoj tvrtki. Vlasnik računa može spremiti i ponovno dohvatiti naziv tvrtke, OIB, kontakt, sjedište i logotip; podaci drugih poslodavaca nisu mu dostupni za uređivanje. Prioritet je visok. Izvor zahtjeva: Plan razvoja tima.

### F-009

Poslodavac može zatražiti verifikaciju tvrtke, pratiti status i ponovno poslati zahtjev nakon odbijanja. Poslodavac s valjanim podacima može poslati zahtjev; status prelazi u na čekanju odnosno u pregledu, a nakon odluke u odobreno ili odbijeno. Odbijeni poslodavac vidi razlog i može podnijeti novi zahtjev. Prioritet je visok. Izvor zahtjeva: Plan razvoja tima.

### F-010

Administrator može pregledati, odobriti ili odbiti zahtjev za verifikaciju tvrtke. Administrator može obraditi zahtjev i zabilježiti odluku; kod odbijanja razlog je obvezan. Korisnik bez administratorske uloge ne može promijeniti status verifikacije. Prioritet je visok. Izvor zahtjeva: Plan razvoja tima.

### F-011

Svi posjetitelji mogu vidjeti javno objavljene casting oglase. Posjetitelj vidi samo oglase koji su javno objavljeni i dostupni za pregled; nacrti i otkazani oglasi ne pojavljuju se na popisu aktualnih oglasa. Prioritet je visok. Izvor zahtjeva: Plan razvoja tima.

### F-012

Posjetitelj može otvoriti casting oglas i vidjeti njegove detalje. Otvaranjem oglasa prikazuju se projekt, vrsta projekta, opis i uloga, uvjeti, lokacija, rok prijave i broj traženih kandidata; za nepostojeći oglas sustav prikazuje odgovarajuću poruku. Prioritet je visok. Izvor zahtjeva: Plan razvoja tima.

### F-013

Oglase je moguće pretraživati i filtrirati prema nazivu, vrsti projekta, lokaciji, dobi i uvjetima uloge. Pretraga i filtri prikazuju samo oglase koji odgovaraju zadanim kriterijima; bez rezultata se prikazuje poruka, a čišćenjem filtara ponovno se vidi puni popis. Prioritet je srednji. Izvor zahtjeva: Plan razvoja tima.

### F-014

Prijavljeni kandidat može poslati prijavu na oglas koji još prima prijave. Kandidat može predati prijavu prije roka i prije dosezanja limita prijava; nastaje zapis povezan s kandidatom i oglasom te korisnik prima potvrdu. Gost se upućuje na prijavu u sustav. Prioritet je visok. Izvor zahtjeva: Plan razvoja tima.

### F-015

Aplikacija sprječava duple prijave te prijave nakon roka ili nakon dosegnutog limita. Druga prijava istog kandidata, prijava nakon roka, na zatvoren/otkazan/popunjen oglas ili nakon dosegnutog maksimalnog broja prijava odbija se uz razlog; provjera vrijedi i pri izravnom API zahtjevu. Prioritet je visok. Izvor zahtjeva: Plan razvoja tima.

### F-016

Kandidat može vidjeti svoje prijave i njihove statuse. Kandidat vidi samo svoje prijave s pripadajućim oglasom, datumom i statusom; ne vidi prijave drugih kandidata. Prioritet je visok. Izvor zahtjeva: Plan razvoja tima.

### F-017

Korisnik može vidjeti obavijesti o prijavama i audicijama i označiti ih pročitanima. Promjena relevantnog statusa ili termina stvara obavijest namijenjenu odgovarajućem korisniku; korisnik može obavijest označiti pročitanom, bez pristupa tuđim obavijestima. Prioritet je srednji. Izvor zahtjeva: Plan razvoja tima.

### F-018

Poslodavac može napraviti i spremiti nacrt oglasa koji nije javno vidljiv. Poslodavac može spremiti djelomično popunjen nacrt; nacrt ostaje dostupan u Mojim oglasima nakon ponovne prijave, a ne pojavljuje se među javnim oglasima. Nacrt može spremiti i poslodavac koji nije verificiran. Prioritet je visok. Izvor zahtjeva: Plan razvoja tima.

### F-019

Samo verificirani poslodavac može objaviti oglas s ispravno ispunjenim podacima. Objava zahtijeva naziv i tip projekta, opis, ulogu, lokaciju, budući rok, pozitivan cijeli broj traženih kandidata te dopušten maksimalan broj prijava (početno 1000). Sustav odbija nepotpune podatke i neverificiranog poslodavca. Prioritet je visok. Izvor zahtjeva: Plan razvoja tima.

### F-020

Poslodavac može uređivati svoje oglase dok njihov status to dopušta. Vlasnik može izmijeniti dopuštena polja svog nacrta ili oglasa i ponovno vidjeti promjene; ne može uređivati tuđi oglas ili zaobići pravila statusa. Prioritet je visok. Izvor zahtjeva: Plan razvoja tima.

### F-021

Poslodavac može vidjeti, pretraživati i filtrirati svoje oglase prema statusu. Poslodavac vidi svoje nacrte, objavljene, zatvorene, popunjene i otkazane oglase; pretraga i statusni filtar mijenjaju prikaz, a oglasi drugog poslodavca nisu prikazani. Prioritet je srednji. Izvor zahtjeva: Plan razvoja tima.

### F-022

Poslodavac može zatvoriti prijave ili otkazati svoj oglas. Ovlašteni poslodavac može potvrditi promjenu statusa; nakon zatvaranja ili otkazivanja nove prijave nisu moguće, a otkazivanje obrađuje i povezane buduće audicije te obavijesti. Prioritet je visok. Izvor zahtjeva: Plan razvoja tima.

### F-023

Poslodavac može pregledavati prijave kandidata na svoje oglase. Poslodavac vidi prijave vezane uz vlastiti oglas, uz prikladne podatke kandidata, ali ne može dohvatiti prijave na tuđi oglas; administrator pristupa samo u okviru dodijeljenih ovlasti. Prioritet je visok. Izvor zahtjeva: Plan razvoja tima.

### F-024

Poslodavac može mijenjati status prijave i unijeti razlog odbijanja. Ovlašteni poslodavac može mijenjati stanje prijave kroz predana, u pregledu, uži izbor, pozvan na audiciju, audicija održana i odabran/odbijen; odbijanje sadrži razlog, a nevaljani prijelazi i tuđe prijave su odbijeni. Prioritet je visok. Izvor zahtjeva: Plan razvoja tima.

### F-025

Administrator može trajno obrisati oglas i podatke povezane s njim. Nakon izričite potvrde administrator uklanja oglas te vezane prijave, termine, rezervacije i odnosne datoteke/zapise prema pravilima brisanja; oglas više nije dohvatljiv. Korisnik bez ovlasti ne može obrisati oglas. Opseg vlasničkog brisanja razjasniti. Prioritet je visok. Izvor zahtjeva: Plan razvoja tima.

### F-026

Kandidat može povući prijavu koju je poslao. Kandidat može povući vlastitu prijavu dok je povlačenje dopušteno; status se ažurira, povezane rezervacije obrađuju se prema pravilima i povučena se prijava ne smatra aktivnom. Prioritet je srednji. Izvor zahtjeva: Plan razvoja tima.

### F-027

Poslodavac može dodati i otkazati termine audicije s datumom, lokacijom i kapacitetom. Ovlašteni vlasnik oglasa može spremiti termin s početkom, završetkom, lokacijom i pozitivnim kapacitetom; neispravni datumi se odbijaju. Otkazivanje mijenja status termina i pokreće obavijesti rezerviranima. Prioritet je visok. Izvor zahtjeva: Plan razvoja tima.

### F-028

Kandidat koji je pozvan na audiciju može rezervirati slobodan termin. Pozvani kandidat može rezervirati jedan raspoloživ termin za svoju prijavu; nepozvan korisnik ili drugi kandidat to ne može. Istodobni zahtjevi ne mogu prekoračiti kapacitet ni stvoriti dvije aktivne rezervacije. Prioritet je visok. Izvor zahtjeva: Plan razvoja tima.

### F-029

Kandidat može promijeniti ili otkazati rezervaciju, a poslodavac može označiti dolazak ili nedolazak. Kandidat može otkazati i, kada je dopušteno, odabrati drugi slobodan termin. Poslodavac može evidentirati dolazak ili nedolazak; oslobođeno mjesto ponovno je dostupno i promjene se prikazuju sudionicima. Prioritet je srednji. Izvor zahtjeva: Plan razvoja tima.

### F-030

Oglas se automatski označava popunjenim kad je odabran traženi broj kandidata. Kad se odabere točno onoliko kandidata koliko je navedeno u polju broj traženih kandidata, oglas se zatvara za prijave, označava popunjenim i obrađuje preostale prijave/rezervacije; nije moguće odabrati više kandidata od traženog broja. Prioritet je visok. Izvor zahtjeva: Plan razvoja tima.

### F-031

Korisnik može prijaviti oglas s neprimjerenim sadržajem. Korisnik može označiti oglas i poslati prijavu s razlogom; prijava je dostupna administratoru za obradu i ne mijenja automatski status oglasa. Prioritet je srednji. Izvor zahtjeva: Plan razvoja tima.

### F-032

Administrator može pregledati i obraditi prijave neprimjerenih oglasa. Administrator može pregledati prijavu, zabilježiti odluku i poduzeti dopuštenu moderatorsku radnju; korisnik bez administratorskih ovlasti to ne može. Prioritet je srednji. Izvor zahtjeva: Plan razvoja tima.

### F-033

Administrator može vidjeti osnovnu statistiku korisnika, verifikacija, oglasa i prijava. Administratorski prikaz pokazuje brojeve usklađene sa zapisima u bazi; neovlašteni korisnik nema pristup administrativnoj statistici. Prioritet je nizak. Izvor zahtjeva: Plan razvoja tima.

### F-034

Aplikacija šalje važne obavijesti o prijavama i audicijama putem e-pošte. Nakon dogovorenog događaja sustav pokušava dostaviti obavijest na adresu korisnika putem konfigurirane vanjske usluge; uspjeh ili neuspjeh dostave može se provjeriti u zapisima. Odabir usluge i točne vrste poruka treba potvrditi. Prioritet je srednji. Izvor zahtjeva: Plan tima i upute kolegija (usluga nije odabrana).

Dogovorena prijava: Koristit ćemo OAuth 2.0 / OpenID Connect preko vanjskog pružatelja identiteta. Ne spremamo vlastite lozinke niti izrađujemo njihovu promjenu. F-005 sada opisuje siguran povratak na postojeći profil nakon ponovne OAuth/OIDC prijave. Google je implementirani pružatelj prema [PR-u #29](https://github.com/paolabbradaric/grupa122/pull/29). Uslugu za e-poštu (F-034) i ostala otvorena domenska pitanja treba potvrditi zasebno.

## 2.2 Nefunkcijski zahtjevi

Ovo su zahtjevi vezani uz sigurnost, brzinu, pouzdanost i jednostavnost korištenja. Za svaki piše kako ćemo ga provjeriti.

### NF-01

Backend mora provjeravati korisničke ovlasti, tako da nitko ne može mijenjati tuđe podatke. Izravnim API zahtjevima pokušati pristupiti tuđim profilima, oglasima i prijavama te administratorskim radnjama; neovlaštene radnje moraju biti odbijene. Prioritet je visok. Izvor zahtjeva: Dogovor tima i kvaliteta aplikacije.

### NF-02

Aplikacija ne sprema korisničke lozinke, a OAuth/OIDC tokeni i sesije moraju biti sigurno obrađeni. Pregledati backend i frontend: korisničke lozinke ne smiju biti u našoj bazi, valjanost prijave mora se provjeravati, a tokeni, sesije i tajne ne smiju biti javno izloženi. Prioritet je visok. Izvor zahtjeva: Sigurnost i dogovor tima o OAuth/OIDC prijavi.

### NF-03

Objavljena aplikacija mora koristiti HTTPS za prijavu i slanje privatnih podataka. Na javno postavljenoj aplikaciji provjeriti valjani HTTPS te spriječiti slanje osjetljivih podataka nezaštićenom vezom. Prioritet je visok. Izvor zahtjeva: Dogovor tima i kvaliteta aplikacije.

### NF-04

Backend mora provjeravati unesene podatke čak i kada je to već napravio frontend. Izravno poslati nevaljane vrijednosti, npr. negativan broj kandidata, pogrešan OIB, istekao rok ili prekoračen kapacitet; baza se ne smije mijenjati i mora se vratiti razumljiva pogreška. Prioritet je visok. Izvor zahtjeva: Dogovor tima i kvaliteta aplikacije.

### NF-05

U testnom okruženju najmanje 95 % zahtjeva za dohvat oglasa pri 20 istodobnih korisnika treba završiti unutar 3 sekunde. Izvesti test opterećenja s 20 istodobnih korisnika, izmjeriti 95. percentil i zapisati okolinu i rezultate; brojke nisu mjerene ni unaprijed odobrene. Prioritet je srednji. Izvor zahtjeva: Prijedlog tima (treba potvrditi).

### NF-06

Spremljeni profili, oglasi, prijave i rezervacije moraju ostati spremljeni i nakon osvježavanja stranice ili ponovnog pokretanja aplikacije. Spremiti testne podatke, osvježiti stranicu i ponovno pokrenuti aplikaciju; provjeriti ponovni dohvat iz baze, a ne samo iz stanja u pregledniku. Prioritet je visok. Izvor zahtjeva: Dogovor tima i kvaliteta aplikacije.

### NF-07

Stranica treba biti prilagođena mobitelima, tabletima i računalima. Na širinama 360 px, 768 px i 1440 px provjeriti prijavu, profile, pregled i predaju prijave te stvaranje oglasa; ne smiju nestajati obavezne kontrole. Prioritet je srednji. Izvor zahtjeva: Prilagodba različitim uređajima.

### NF-08

Glavni obrasci moraju se moći koristiti tipkovnicom, uz vidljiv fokus i razumljive poruke o greškama. Proći prijavu, registraciju, pretragu oglasa i obrazac prijave bez miša; provjeriti oznake polja, redoslijed fokusa i poruke. Prioritet je srednji. Izvor zahtjeva: Pristupačnost.

### NF-09

Glavne funkcije trebaju raditi u aktualnim verzijama Chromea i Firefoxa. Izvršiti isti osnovni scenarij registracije, pregleda oglasa i prijave na oglas u oba preglednika te zabilježiti razlike. Prioritet je srednji. Izvor zahtjeva: Podrška preglednicima.

### NF-10

Tekstovi, gumbi, statusi i poruke trebaju biti razumljivi i dosljedni na hrvatskom jeziku. Proći tipične tijekove kandidata, poslodavca i administratora te pregledati tekstualnu dosljednost. Prioritet je nizak. Izvor zahtjeva: Dogovor tima i kvaliteta aplikacije.

### NF-11

Kod greške aplikacija prikazuje jasnu poruku, bez otkrivanja lozinki, SQL upita ili internih detalja. Simulirati pogrešnu prijavu, nepostojeći oglas i grešku baze te pregledati odgovore i korisničke poruke. Prioritet je visok. Izvor zahtjeva: Dogovor tima i kvaliteta aplikacije.

### NF-12

Podaci kandidata, fotografije i prijave moraju biti dostupni samo korisnicima koji imaju ovlasti. Pokušati dohvatiti privatne podatke kao gost i drugi korisnik; provjeriti odbijanje, kontrolu pristupa datotekama i prikaz samo dopuštenih podataka poslodavcu. Prioritet je visok. Izvor zahtjeva: Zaštita privatnosti.

## 2.3 Dionici i akteri

Ovdje su navedene uloge koje koriste aplikaciju i što svaka od njih može raditi.

A-01. Posjetitelj (neprijavljeni korisnik). Pregled javnih oglasa i detalja; odlazak na prijavu/registraciju. F-001–F-003, F-011–F-013.

A-02. Kandidat (registrirani korisnik). Uređuje profil i portfolio, pregledava i predaje/povlači prijave, rezervira audicije i prima obavijesti. F-001, F-003–F-007, F-011–F-017, F-026, F-028–F-029, F-034.

A-03. Poslodavac (predstavnik organizacije). Uređuje organizaciju, traži verifikaciju, upravlja oglasima i odabirom, terminima i prijavama. F-002–F-005, F-008–F-009, F-018–F-024, F-027, F-029–F-030.

A-04. Administrator (zajednički demo račun). Provjerava organizacije, obrađuje prijavljeni sadržaj i uklanja oglase; pregledava statistike. F-010, F-025, F-031–F-033.

A-05. Vanjska usluga e-pošte (sekundarni akter, planirano). Sudjeluje pri slanju važnih obavijesti; usluga još nije odabrana. F-034.

A-06. OAuth/OIDC pružatelj identiteta (sekundarni akter). Provjerava korisnički identitet; implementirana je Google prijava uz zasebnu lokalnu sesiju i ulogu. F-001, F-002, F-003.

Ostali dionici: naš tim i nastavno osoblje koje prati projekt. Vanjski pružatelj identiteta je akter A-06 jer sudjeluje u prijavi.

## 2.4 Ograničenja i pretpostavke

Ovdje smo zapisali pravila projekta i stvari koje još trebamo potvrditi.

### C-01

Jedan casting oglas predstavlja jedan zaseban projekt i jednu ulogu; broj traženih kandidata i maksimalni broj prijava odvojena su polja (početni maksimum prijava 1000). Uskladiti bazu, API i obrazac oglasa te testirati pravila za oba broja. Izvor: Plan razvoja tima. Vrsta zapisa: Ograničenje.

### C-02

Registracija kandidata predviđena je za punoljetne osobe (18+). Sustav provjerava datum rođenja pri registraciji i ne dopušta maloljetnički račun. Izvor: Plan razvoja tima. Vrsta zapisa: Ograničenje.

### C-03

Postojeću PostgreSQL bazu treba sačuvati; usklađenja sheme izvoditi migracijama bez nepotrebnog gubitka podataka. Usporediti trenutačni `db/schema.sql` s planom (npr. polje `max_applications`) i izraditi migracijski plan. Izvor: Dogovor tima (22. 10. 2026.). Vrsta zapisa: Ograničenje.

### C-04

Za demonstraciju se koristi jedan zajednički administratorski račun; pristupni podaci nisu dio repozitorija. Ograničiti ovlasti i čuvanje tajni; provjeriti postupak demo prijave. Izvor: Dogovor tima. Vrsta zapisa: Ograničenje.

### C-05

Za prijavu koristimo vanjskog pružatelja identiteta preko OAuth 2.0 / OpenID Connect, a ne vlastiti sustav lozinki. Odabrati pružatelja identiteta, povezati prijavu s korisničkim ulogama i testirati uspješnu i neuspješnu prijavu. Izvor: Dogovor tima (28. 10. 2026.) i plan rada kolegija. Vrsta zapisa: Ograničenje.

### C-06

Nastavni plan predviđa domenski relevantnu integraciju s vanjskim sustavom/uslugom najkasnije u nastavku implementacije. Potvrditi prihvaća li se e-pošta za audicije kao integracija i odabrati dobavljača; nakon odluke precizirati F-034. Izvor: Plan rada kolegija, 10. tjedan; Plan razvoja tima. Vrsta zapisa: Ograničenje.

### AS-01

Pravila prikaza profila i portfolija poslodavcu ograničit će pristup na kandidata povezanog s odgovarajućom prijavom. Potvrditi s asistentom i u testovima provjeriti autorizaciju privatnih podataka. Izvor: Procjena tima, potreban dogovor o privatnosti. Vrsta zapisa: Pretpostavka.

### AS-02

Otkazana audicija oslobađa mjesto, a status oglasa i rezervacije ažuriraju se dosljedno. Precizirati statusne prijelaze i testirati otkazivanje, ponovno rezerviranje i konkurentne zahtjeve. Izvor: Plan razvoja tima. Vrsta zapisa: Pretpostavka.

### AS-03

Maksimalan broj prijava 1000 je početna vrijednost po oglasu, uz mogućnost manje vrijednosti. Provjeriti točnu dopuštenu granicu (1–1000 u prototipu) i uskladiti frontend, API i bazu. Izvor: Plan razvoja tima. Vrsta zapisa: Pretpostavka.

Pitanja evidentirana pri pripremi M0: (1) Koji OAuth/OIDC pružatelj identiteta ćemo koristiti? (2) Je li e-pošta za audicije dovoljna kao vanjska integracija? (3) Tko smije trajno brisati oglase i koje podatke brišemo? (4) Koje podatke kandidata vidi poslodavac? (5) Koji su dopušteni statusi prijava i rezervacija? (6) Je li NF-05 prihvatljiv?

Pružatelj iz prvog pitanja naknadno je odabran: Google, implementiran u PR-u #29. Ostale stavke ovdje se ne proglašavaju riješenima.

## 2.5 Značajne promjene zahtjeva

Ovdje bilježimo veće promjene u dogovorima. Dopunit ćemo je nakon razgovora s asistentom.

U razdoblju Listopad 2026. (dan nije evidentiran) promjena se odnosi na F-019, F-030. Potvrđen odvojeni broj traženih kandidata; u radnom planu dodatno definiran `max_applications` s početnom vrijednošću 1000. Dokaz ili dogovor: Dogovor tima.

U razdoblju Listopad 2026. (dan nije evidentiran) promjena se odnosi na F-025. Dogovoreno trajno brisanje oglasa i vezanih podataka umjesto samo skrivanja/soft deletea. Dokaz ili dogovor: Dogovor tima.

U razdoblju 28. 10. 2026. promjena se odnosi na F-001–F-003, F-005, NF-02, C-05. Tim je odlučio koristiti OAuth 2.0 / OpenID Connect. Prilagođena je registracija i sigurnost, a F-005 smo prilagodili ponovnoj prijavi i povezivanju s postojećim profilom jer lozinkama upravlja vanjski pružatelj. Dokaz ili dogovor: Dogovor tima.

U razdoblju 3. 11. 2026. promjena se odnosi na F-001–F-005, NF-02. Implementirana Google prijava i lokalne PostgreSQL sesije; nema vlastitih lozinki. Dokaz ili dogovor: [PR #29](https://github.com/paolabbradaric/grupa122/pull/29).

Ostale važne promjene dodaju se nakon potvrde.

## 2.6 Sljedivost zahtjeva

Za autentifikaciju i bazu provedene su automatizirane provjere 17. 11. 2026. [Poglavlje 5](5-Ispitivanje.md) povezuje ih s UC-001/UC-002 i testovima A-T01–A-T10, uz neizvedene sustavske scenarije A-S01–A-S04. Ostali redci ostaju plan provjera ako nemaju konkretan dokaz.

Zahtjevi F-001–F-005 odnose se na Prijava, odjava i računi / UC-001, UC-002. [A-T01–A-T08](5-Ispitivanje.md#52-ispitni-slučajevi-i-sljedivost): auth i DB testovi prošli; stvarni Google tok A-S01/A-S02 još nije izveden.

Zahtjevi F-006–F-008 odnose se na Profili kandidata i poslodavaca. Mogu li korisnici spremati svoje podatke, dodati do pet fotografija i uređivati samo vlastiti profil.

Zahtjevi F-009–F-010 odnose se na Verifikacija poslodavaca. Može li poslodavac poslati zahtjev, a administrator odobriti ili odbiti verifikaciju.

Zahtjevi F-011–F-013 odnose se na Pregled i pretraga oglasa. Prikazuju li se javni oglasi, detalji i rezultati pretrage.

Zahtjevi F-014–F-016, F-026 odnose se na Prijave kandidata. Mogu li se kandidati prijaviti i povući prijavu te jesu li spriječene dvostruke i zakašnjele prijave.

Zahtjevi F-017, F-034 odnose se na Obavijesti. Prikazuju li se obavijesti pravim korisnicima i radi li planirano slanje e-pošte.

Zahtjevi F-018–F-022 odnose se na Izrada i upravljanje oglasima. [A-T09/A-T10](5-Ispitivanje.md#52-ispitni-slučajevi-i-sljedivost) potvrđuju DB dio nacrta/objave i migraciju; potpuni API/UI tok i ovlasti nisu dokazani samo tim testom.

Zahtjevi F-023–F-024, F-030 odnose se na Pregled prijava i odabir kandidata. Može li poslodavac obraditi prijave i označiti oglas popunjenim kada odabere dovoljan broj kandidata.

Zahtjevi F-025 odnose se na Brisanje oglasa. Može li administrator obrisati oglas i povezane podatke te je li brisanje zabranjeno ostalima.

Zahtjevi F-027–F-029 odnose se na Audicije i rezervacije. Mogu li se dodavati termini, rezervirati slobodna mjesta i otkazivati rezervacije.

Zahtjevi F-031–F-033 odnose se na Administracija. Može li se prijaviti neprimjeren oglas, obraditi prijava i pregledati statistika.

Zahtjevi NF-01–NF-04, NF-11–NF-12 odnose se na Sigurnost i privatnost. Jesu li podaci i korisničke ovlasti zaštićeni i prikazuju li se razumljive pogreške.

Zahtjevi NF-05–NF-10 odnose se na Brzina i jednostavnost korištenja. Radi li aplikacija dovoljno brzo, pamti li podatke i može li se koristiti na različitim uređajima i preglednicima.

Napomena: Potvrđeni auth/DB rezultati su u [Ispitivanju](5-Ispitivanje.md) i [zapisniku](verification/2026-11-17/README.md). Prolaz middleware testa nije dokaz ovlasti svih poslovnih modula, a registracija nije dovršena trajna izmjena profila F-006–F-008.

## 2.7 Pregled zahtjeva

Ovdje ćemo nakon prezentacija upisati komentare asistenta i promjene koje dogovorimo.

M0 — 4. tjedan. Tim je odlučio koristiti OAuth/OIDC; još trebamo odabrati pružatelja i razjasniti e-poštu i pristup podacima. Na čekanju — nakon prezentacije upisati komentar asistenta.

M1 — 7. tjedan. Još nije održano. Na čekanju.

M2 — 12. tjedan. Još nije održano. Na čekanju.

M3 — 14. tjedan. Još nije održano. Na čekanju.

---

Za M0: Napisali smo 34 funkcijska i 12 nefunkcijskih zahtjeva. F-005 je prilagođen OAuth/OIDC prijavi. Otvorena pitanja i dalje trebamo provjeriti s ekipom i asistentom.
