# 2. Analiza zahtjeva — CastMeIfYouCan

Verzija: Priprema za prvi ciklus (M1), studeni 2026.

Projekt: CastMeIfYouCan — stranica na kojoj kandidati pronalaze casting oglase i prijavljuju se, a poslodavci objavljuju oglase i biraju kandidate.

Ovdje smo napisali što naša aplikacija treba raditi i kako ćemo provjeriti je li sve napravljeno. Zahtjevi definiraju očekivano ponašanje sustava neovisno o tome je li određena funkcionalnost već implementirana.

## 2.1 Funkcijski zahtjevi

Ovo su funkcije koje naša aplikacija treba imati. Svaka ima oznaku, prioritet, izvor i kriterij po kojem ćemo provjeriti radi li. Visok znači najvažnije, Srednji važne dodatne funkcije, a Nizak stvari koje nisu ključne za osnovni rad.

### F-001

Korisnik se prvi put prijavljuje putem OAuth 2.0 / OpenID Connect, odabire ulogu kandidata ili poslodavca i dovršava svoj profil. Kandidat unosi potrebne podatke; račun nastaje samo za osobe s najmanje 18 godina, a neispravni ili nepotpuni podaci ne spremaju se. Poslodavac upisuje naziv tvrtke, OIB, kontakt i sjedište; neispravni podaci odbijaju se, a račun nije automatski verificiran. Prioritet je visok. Izvor zahtjeva: Dogovor tima o OAuth/OIDC prijavi.

### F-002

Korisnici se prijavljuju putem vanjskog OAuth 2.0 / OpenID Connect pružatelja identiteta. Korisnik se preusmjerava pružatelju identiteta. Uspješna prijava otvara korisničku sesiju s njegovom ulogom, a neuspjela ili otkazana prijava ne dopušta zaštićene funkcije. Pri ponovnoj prijavi preko istog vanjskog identiteta aplikacija otvara postojeći profil sa spremljenim podacima, bez stvaranja novog računa; drugi vanjski identitet ne može preuzeti taj profil. Prioritet je visok. Izvor zahtjeva: Dogovor tima (28. 10. 2026.) i razrada dogovorene OAuth/OIDC prijave.

### F-003

Prijavljeni korisnik može se odjaviti iz aplikacije. Nakon odjave korisnik ne može izvršavati radnje koje zahtijevaju prijavu, čak ni izravnim slanjem API zahtjeva sa starom sesijom. Prioritet je visok. Izvor zahtjeva: Plan razvoja tima.

### F-004

Kandidat može pregledavati i uređivati svoj profil, iskustvo, vještine i fotografije. Kandidat može spremiti ime, prezime, grad, iskustvo, vještine te ponuđene fizičke karakteristike; izmjene se vide nakon ponovne prijave, a drugi kandidat ne može mijenjati taj profil. Kandidat može dodati profilnu sliku te dodati i ukloniti najviše pet JPG/PNG slika u portfoliju i ponovno ih pregledati nakon prijave; više od pet fotografija ili nepodržan format odbijaju se bez neispravne pohrane. Prioritet je visok za podatke profila, a srednji za fotografije. Izvor zahtjeva: Plan razvoja tima.

### F-005

Poslodavac može pregledavati i uređivati podatke o svojoj tvrtki. Vlasnik računa može spremiti i ponovno dohvatiti naziv tvrtke, OIB, kontakt, sjedište i logotip; podaci drugih poslodavaca nisu mu dostupni za uređivanje. Prioritet je visok. Izvor zahtjeva: Plan razvoja tima.

### F-006

Poslodavac može zatražiti verifikaciju tvrtke, pratiti status i ponovno poslati zahtjev nakon odbijanja. Poslodavac s valjanim podacima može poslati zahtjev; status prelazi u na čekanju odnosno u pregledu, a nakon odluke u odobreno ili odbijeno. Odbijeni poslodavac vidi razlog i može podnijeti novi zahtjev. Prioritet je visok. Izvor zahtjeva: Plan razvoja tima.

### F-007

Administrator može pregledati, odobriti ili odbiti zahtjev za verifikaciju tvrtke. Administrator može obraditi zahtjev i zabilježiti odluku; kod odbijanja razlog je obvezan. Korisnik bez administratorske uloge ne može promijeniti status verifikacije. Prioritet je visok. Izvor zahtjeva: Plan razvoja tima.

### F-008

Svi posjetitelji mogu pregledavati javno objavljene casting oglase, otvoriti njihove detalje te ih pretraživati i filtrirati. Na popisu aktualnih oglasa prikazuju se samo javno objavljeni oglasi dostupni za pregled; nacrti i otkazani oglasi ne pojavljuju se. Otvaranjem oglasa prikazuju se projekt, vrsta projekta, opis i uloga, uvjeti, lokacija, rok prijave i broj traženih kandidata; za nepostojeći oglas sustav prikazuje odgovarajuću poruku. Pretraga i filtri prema nazivu, vrsti projekta, lokaciji, dobi i uvjetima uloge prikazuju samo odgovarajuće oglase; bez rezultata se prikazuje poruka, a čišćenjem filtara ponovno se vidi puni popis. Prioritet je visok za pregled oglasa i detalja, a srednji za pretraživanje i filtriranje. Izvor zahtjeva: Plan razvoja tima.

### F-009

Prijavljeni kandidat može poslati prijavu na oglas koji još prima prijave. Kandidat može predati prijavu prije roka i prije dosezanja limita prijava; nastaje zapis povezan s kandidatom i oglasom te korisnik prima potvrdu. Gost se upućuje na prijavu u sustav. Druga prijava istog kandidata, prijava nakon roka, na zatvoren, otkazan ili popunjen oglas ili nakon dosegnutog maksimalnog broja prijava odbija se uz razlog; provjera vrijedi i pri izravnom API zahtjevu. Prioritet je visok. Izvor zahtjeva: Plan razvoja tima.

### F-010

Kandidat može pregledati svoje prijave i njihove statuse te povući prijavu koju je poslao. Kandidat vidi samo svoje prijave s pripadajućim oglasom, datumom i statusom; ne vidi prijave drugih kandidata. Vlastitu prijavu može povući dok je povlačenje dopušteno; status se ažurira, povezane rezervacije obrađuju se prema pravilima i povučena se prijava ne smatra aktivnom. Prioritet je visok za pregled prijava, a srednji za povlačenje. Izvor zahtjeva: Plan razvoja tima.

### F-011

Korisnik može vidjeti obavijesti o prijavama i audicijama i označiti ih pročitanima. Promjena relevantnog statusa ili termina stvara obavijest namijenjenu odgovarajućem korisniku; korisnik može obavijest označiti pročitanom, bez pristupa tuđim obavijestima. Prioritet je srednji. Izvor zahtjeva: Plan razvoja tima.

### F-012

Poslodavac može napraviti i spremiti nacrt oglasa ili objaviti oglas s ispravno ispunjenim podacima. Djelomično popunjen nacrt može spremiti i neverificirani poslodavac; nacrt ostaje dostupan u Mojim oglasima nakon ponovne prijave i nije javno vidljiv. Samo verificirani poslodavac može objaviti oglas. Objava zahtijeva naziv i tip projekta, opis, ulogu, lokaciju, budući rok, pozitivan cijeli broj traženih kandidata te dopušten maksimalan broj prijava (početno 1000). Sustav odbija nepotpune podatke i neverificiranog poslodavca. Prioritet je visok. Izvor zahtjeva: Plan razvoja tima.

### F-013

Poslodavac može pregledavati, pretraživati i filtrirati svoje oglase prema statusu te ih uređivati dok njihov status to dopušta. Poslodavac vidi svoje nacrte, objavljene, zatvorene, popunjene i otkazane oglase; pretraga i statusni filtar mijenjaju prikaz, a oglasi drugog poslodavca nisu prikazani. Vlasnik može izmijeniti dopuštena polja svog nacrta ili oglasa i ponovno vidjeti promjene; ne može uređivati tuđi oglas ili zaobići pravila statusa. Prioritet je visok za uređivanje, a srednji za pregled, pretraživanje i filtriranje vlastitih oglasa. Izvor zahtjeva: Plan razvoja tima.

### F-014

Poslodavac može zatvoriti prijave ili otkazati svoj oglas. Ovlašteni poslodavac može potvrditi promjenu statusa; nakon zatvaranja ili otkazivanja nove prijave nisu moguće, a otkazivanje obrađuje i povezane buduće audicije te obavijesti. Prioritet je visok. Izvor zahtjeva: Plan razvoja tima.

### F-015

Poslodavac može pregledavati prijave kandidata na svoje oglase, mijenjati njihov status i unijeti razlog odbijanja. Poslodavac vidi prijave vezane uz vlastiti oglas, uz prikladne podatke kandidata, ali ne može dohvatiti prijave na tuđi oglas; administrator pristupa samo u okviru dodijeljenih ovlasti. Ovlašteni poslodavac može mijenjati stanje prijave kroz predana, u pregledu, uži izbor, pozvan na audiciju, audicija održana i odabran/odbijen; odbijanje sadrži razlog, a nevaljani prijelazi i tuđe prijave su odbijeni. Prioritet je visok. Izvor zahtjeva: Plan razvoja tima.

### F-016

Administrator može pregledati i obraditi prijave neprimjerenih oglasa te trajno obrisati oglas i podatke povezane s njim. Administrator može pregledati prijavu, zabilježiti odluku i poduzeti dopuštenu moderatorsku radnju. Nakon izričite potvrde administrator uklanja oglas te vezane prijave, termine, rezervacije i odnosne datoteke/zapise prema pravilima brisanja; oglas više nije dohvatljiv. Korisnik bez administratorskih ovlasti ne može obraditi prijavu ni obrisati oglas. Opseg vlasničkog brisanja razjasniti. Prioritet je visok za trajno brisanje, a srednji za obradu prijava neprimjerenih oglasa. Izvor zahtjeva: Plan razvoja tima.

### F-017

Poslodavac može dodati i otkazati termine audicije s datumom, lokacijom i kapacitetom. Ovlašteni vlasnik oglasa može spremiti termin s početkom, završetkom, lokacijom i pozitivnim kapacitetom; neispravni datumi se odbijaju. Otkazivanje mijenja status termina i pokreće obavijesti rezerviranima. Prioritet je visok. Izvor zahtjeva: Plan razvoja tima.

### F-018

Kandidat koji je pozvan na audiciju može rezervirati slobodan termin te promijeniti ili otkazati rezervaciju. Pozvani kandidat može rezervirati jedan raspoloživ termin za svoju prijavu; nepozvan korisnik ili drugi kandidat to ne može. Istodobni zahtjevi ne mogu prekoračiti kapacitet ni stvoriti dvije aktivne rezervacije. Kandidat može otkazati i, kada je dopušteno, odabrati drugi slobodan termin; oslobođeno mjesto ponovno je dostupno i promjene se prikazuju sudionicima. Prioritet je visok za rezervaciju, a srednji za promjenu i otkazivanje. Izvor zahtjeva: Plan razvoja tima.

### F-019

Poslodavac može označiti dolazak ili nedolazak kandidata na audiciju. Evidentirani dolazak ili nedolazak prikazuje se sudionicima. Prioritet je srednji. Izvor zahtjeva: Plan razvoja tima.

### F-020

Oglas se automatski označava popunjenim kad je odabran traženi broj kandidata. Kad se odabere točno onoliko kandidata koliko je navedeno u polju broj traženih kandidata, oglas se zatvara za prijave, označava popunjenim i obrađuje preostale prijave/rezervacije; nije moguće odabrati više kandidata od traženog broja. Prioritet je visok. Izvor zahtjeva: Plan razvoja tima.

### F-021

Korisnik može prijaviti oglas s neprimjerenim sadržajem. Korisnik može označiti oglas i poslati prijavu s razlogom; prijava je dostupna administratoru za obradu i ne mijenja automatski status oglasa. Prioritet je srednji. Izvor zahtjeva: Plan razvoja tima.

### F-022

Administrator može vidjeti osnovnu statistiku korisnika, verifikacija, oglasa i prijava. Administratorski prikaz pokazuje brojeve usklađene sa zapisima u bazi; neovlašteni korisnik nema pristup administrativnoj statistici. Prioritet je nizak. Izvor zahtjeva: Plan razvoja tima.

### F-023

Aplikacija šalje važne obavijesti o prijavama i audicijama putem e-pošte. Nakon dogovorenog događaja sustav pokušava dostaviti obavijest na adresu korisnika putem konfigurirane vanjske usluge; uspjeh ili neuspjeh dostave može se provjeriti u zapisima. Odabir usluge i točne vrste poruka treba potvrditi. Prioritet je srednji. Izvor zahtjeva: Plan tima i upute kolegija (usluga nije odabrana).

Dogovorena prijava: Koristit ćemo OAuth 2.0 / OpenID Connect preko vanjskog pružatelja identiteta. Ne spremamo vlastite lozinke niti izrađujemo njihovu promjenu. F-002 sada opisuje siguran povratak na postojeći profil nakon ponovne OAuth/OIDC prijave. Google je implementirani pružatelj prema [PR-u #29](https://github.com/paolabbradaric/grupa122/pull/29). Uslugu za e-poštu (F-023) i ostala otvorena domenska pitanja treba potvrditi zasebno.

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

A-01. Posjetitelj (neprijavljeni korisnik). Pregled javnih oglasa i detalja; odlazak na prijavu/registraciju. F-001–F-002, F-008.

A-02. Kandidat (registrirani korisnik). Uređuje profil i portfolio, pregledava i predaje/povlači prijave, rezervira audicije i prima obavijesti. F-001–F-004, F-008–F-011, F-018, F-023.

A-03. Poslodavac (predstavnik organizacije). Uređuje organizaciju, traži verifikaciju, upravlja oglasima i odabirom, terminima i prijavama. F-001–F-003, F-005–F-006, F-012–F-015, F-017, F-019–F-020.

A-04. Administrator (ovlašteni Google račun). Provjerava organizacije, obrađuje prijavljeni sadržaj i uklanja oglase; pregledava statistike. F-007, F-016, F-021–F-022.

A-05. Vanjska usluga e-pošte (sekundarni akter, planirano). Sudjeluje pri slanju važnih obavijesti; usluga još nije odabrana. F-023.

A-06. OAuth/OIDC pružatelj identiteta (sekundarni akter). Provjerava korisnički identitet; implementirana je Google prijava uz zasebnu lokalnu sesiju i ulogu. F-001, F-002.

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

Administratorski pristup imaju pojedinačni ovlašteni Google računi iz privatnog serverskog popisa; demonstracija koristi jedan postojeći ovlašteni račun. Popis i tajne nisu dio repozitorija. Izvor: [Razvojni plan](RAZVOJNI_PLAN.md). Vrsta zapisa: Ograničenje.

### C-05

Za prijavu koristimo Google preko OAuth 2.0 / OpenID Connect, a ne vlastiti sustav lozinki. Vanjski identitet povezuje se s lokalnim računom i ulogom; uspješnu, neuspješnu i ponovljenu prijavu treba provjeravati za predviđeno okruženje. Implementacija i granice stvarne lokalne provjere opisane su u [Autentifikaciji](AUTENTIFIKACIJA.md) i [Google prijavi](GOOGLE_PRIJAVA.md). Izvor: Dogovor tima (28. 10. 2026.), plan rada kolegija i PR-ovi #29/#44. Vrsta zapisa: Ograničenje.

### C-06

Nastavni plan predviđa domenski relevantnu integraciju s vanjskim sustavom/uslugom najkasnije u nastavku implementacije. Potvrditi prihvaća li se e-pošta za audicije kao integracija i odabrati dobavljača; nakon odluke precizirati F-023. Izvor: Plan rada kolegija, 10. tjedan; Plan razvoja tima. Vrsta zapisa: Ograničenje.

### AS-01

Pravila prikaza profila i portfolija poslodavcu ograničit će pristup na kandidata povezanog s odgovarajućom prijavom. Potvrditi s asistentom i u testovima provjeriti autorizaciju privatnih podataka. Izvor: Procjena tima, potreban dogovor o privatnosti. Vrsta zapisa: Pretpostavka.

### AS-02

Otkazana audicija oslobađa mjesto, a status oglasa i rezervacije ažuriraju se dosljedno. Precizirati statusne prijelaze i testirati otkazivanje, ponovno rezerviranje i konkurentne zahtjeve. Izvor: Plan razvoja tima. Vrsta zapisa: Pretpostavka.

### AS-03

Maksimalan broj prijava 1000 je početna vrijednost po oglasu, uz mogućnost manje vrijednosti. Provjeriti točnu dopuštenu granicu (1–1000 u prototipu) i uskladiti frontend, API i bazu. Izvor: Plan razvoja tima. Vrsta zapisa: Pretpostavka.

Pitanja evidentirana pri pripremi M0: (1) Koji OAuth/OIDC pružatelj identiteta ćemo koristiti? (2) Je li e-pošta za audicije dovoljna kao vanjska integracija? (3) Tko smije trajno brisati oglase i koje podatke brišemo? (4) Koje podatke kandidata vidi poslodavac? (5) Koji su dopušteni statusi prijava i rezervacija? (6) Je li NF-05 prihvatljiv?

Pružatelj iz prvog pitanja naknadno je odabran: Google, implementiran u PR-u #29. Ostale stavke ovdje se ne proglašavaju riješenima.

## 2.5 Značajne promjene zahtjeva

Ovdje bilježimo veće promjene u dogovorima i potvrđene razvojne odluke.

U razdoblju Listopad 2026. (dan nije evidentiran) promjena se odnosi na F-012, F-020. Potvrđen odvojeni broj traženih kandidata; u radnom planu dodatno definiran `max_applications` s početnom vrijednošću 1000. Dokaz ili dogovor: Dogovor tima.

U razdoblju Listopad 2026. (dan nije evidentiran) promjena se odnosi na F-016. Dogovoreno trajno brisanje oglasa i vezanih podataka umjesto samo skrivanja/soft deletea. Dokaz ili dogovor: Dogovor tima.

U razdoblju 28. 10. 2026. promjena se odnosi na F-001–F-002, NF-02, C-05. Tim je odlučio koristiti OAuth 2.0 / OpenID Connect. Prilagođena je registracija i sigurnost, a F-002 smo prilagodili ponovnoj prijavi i povezivanju s postojećim profilom jer lozinkama upravlja vanjski pružatelj. Dokaz ili dogovor: Dogovor tima.

U razdoblju 3. 11. 2026. promjena se odnosi na F-001–F-003, NF-02. Implementirana Google prijava i lokalne PostgreSQL sesije; nema vlastitih lozinki. Dokaz ili dogovor: [PR #29](https://github.com/paolabbradaric/grupa122/pull/29).

Dana 17. 11. 2026. konfiguriran je lokalni Google OAuth klijent i potvrđeni su stvarna kandidatska registracija, ponovna prijava istog računa, osvježavanje i odjava. Pri nedostajućoj konfiguraciji ili ograničenju pokušaja preglednik se vraća u aplikaciju, a JSON API zadržava odgovore 503/429. Zahtjevi se time ne proširuju; dopunjeni su rezultati provjere F-001–F-003, NF-02 i NF-11. Dokaz: [PR #44](https://github.com/paolabbradaric/grupa122/pull/44) i [Google prijava](GOOGLE_PRIJAVA.md).

Dana 17. 11. 2026. trajna pohrana i uređivanje profila kandidata i poslodavaca povezani su s backendom i privatnom pohranom medija. Zahtjevi F-004–F-005; [PR #46](https://github.com/paolabbradaric/grupa122/pull/46).

Dana 18. 11. 2026. dodani su verifikacija poslodavaca, moderacija i administratorska statistika. Zahtjevi F-006–F-007, F-016, F-021–F-022; [PR #48](https://github.com/paolabbradaric/grupa122/pull/48).

Dana 18. 11. 2026. backend za rezervacije, evidenciju dolazaka i privatne obavijesti dovršen je kroz [PR #58](https://github.com/paolabbradaric/grupa122/pull/58), a prikazi kandidatovih prijava i obavijesti povezani su s API-jem kroz [PR #66](https://github.com/paolabbradaric/grupa122/pull/66). Time su dopunjene implementacije F-010–F-011 i F-018–F-019.

Dana 18. 11. 2026. dodano je korisničko sučelje za rezerviranje, promjenu i otkazivanje termina audicije unutar kandidatovih prijava; [PR #68](https://github.com/paolabbradaric/grupa122/pull/68) i [PR #69](https://github.com/paolabbradaric/grupa122/pull/69).

## 2.6 Sljedivost zahtjeva

Za autentifikaciju i bazu provedene su automatizirane provjere 17. 11. 2026. [Poglavlje 5](5-Ispitivanje.md) povezuje ih s UC-001/UC-002 i testovima A-T01–A-T10 te navodi stupanj provjere sustavskih scenarija A-S01–A-S04. Naknadna stvarna lokalna provjera kandidata zabilježena je u [Google prijavi](GOOGLE_PRIJAVA.md). Za ostale zahtjeve opisani su očekivani scenariji; ostvarene implementacije dodatno su potkrijepljene navedenim PR-ovima.

Zahtjevi F-001–F-003 odnose se na Prijava, odjava i računi / UC-001, UC-002. [A-T01–A-T08](5-Ispitivanje.md#52-ispitni-slučajevi-i-sljedivost): auth i DB testovi prošli. Stvarni kandidatski dijelovi A-S01/A-S02 potvrđeni su za registraciju, ponovnu prijavu, osvježavanje i odjavu; stvarni poslodavački tok, restart sustava i produkcija nisu potvrđeni tim provjerama.

Zahtjevi F-004–F-005 odnose se na profile kandidata i poslodavaca. Trajna pohrana profila i privatnih medija implementirana je kroz [PR #46](https://github.com/paolabbradaric/grupa122/pull/46); provjere korisničkog sučelja i dopuštenih ograničenja ostaju zasebni testni scenariji.

Zahtjevi F-006–F-007 odnose se na Verifikacija poslodavaca. Može li poslodavac poslati zahtjev, a administrator odobriti ili odbiti verifikaciju.

Zahtjevi F-008 odnose se na Pregled i pretraga oglasa. Prikazuju li se javni oglasi, detalji i rezultati pretrage.

Zahtjevi F-009–F-010 odnose se na prijave kandidata. API za pregled i povlačenje prijava implementiran je kroz [PR #50](https://github.com/paolabbradaric/grupa122/pull/50), a stranica „Moje prijave” povezana je s API-jem kroz [PR #66](https://github.com/paolabbradaric/grupa122/pull/66). Ostaju provjere dvostrukih, zakašnjelih i nedopuštenih prijava.

Zahtjevi F-011 i F-023 odnose se na obavijesti. Privatne obavijesti implementirane su na backendu u [PR-u #58](https://github.com/paolabbradaric/grupa122/pull/58), a kandidatov prikaz povezan je s API-jem u [PR-u #66](https://github.com/paolabbradaric/grupa122/pull/66). Vanjsko slanje e-pošte (F-023) ostaje planirano.

Zahtjevi F-012–F-014 odnose se na Izrada i upravljanje oglasima. [A-T09/A-T10](5-Ispitivanje.md#52-ispitni-slučajevi-i-sljedivost) potvrđuju DB dio nacrta/objave i migraciju; potpuni API/UI tok i ovlasti nisu dokazani samo tim testom.

Zahtjevi F-015, F-020 odnose se na Pregled prijava i odabir kandidata. Može li poslodavac obraditi prijave i označiti oglas popunjenim kada odabere dovoljan broj kandidata.

Zahtjevi F-016 odnose se na Brisanje oglasa. Može li administrator obrisati oglas i povezane podatke te je li brisanje zabranjeno ostalima.

Zahtjevi F-017–F-019 odnose se na audicije i rezervacije. Upravljanje terminima implementirano je kroz [PR #35](https://github.com/paolabbradaric/grupa122/pull/35), backend rezervacija i evidencije dolaska kroz [PR #58](https://github.com/paolabbradaric/grupa122/pull/58), a kandidatov odabir termina kroz [PR #68](https://github.com/paolabbradaric/grupa122/pull/68).

Zahtjevi F-016, F-021–F-022 odnose se na Administracija. Može li se prijaviti neprimjeren oglas, obraditi prijava i pregledati statistika.

Zahtjevi NF-01–NF-04, NF-11–NF-12 odnose se na Sigurnost i privatnost. Jesu li podaci i korisničke ovlasti zaštićeni i prikazuju li se razumljive pogreške.

Zahtjevi NF-05–NF-10 odnose se na Brzina i jednostavnost korištenja. Radi li aplikacija dovoljno brzo, pamti li podatke i može li se koristiti na različitim uređajima i preglednicima.

Napomena: Potvrđeni auth/DB rezultati su u [Ispitivanju](5-Ispitivanje.md) i [zapisniku](verification/2026-11-17/README.md). Prolaz middleware testa nije dokaz ovlasti svih poslovnih modula, a trajno uređivanje profila F-004–F-005 ima zasebnu implementaciju u [PR-u #46](https://github.com/paolabbradaric/grupa122/pull/46).

## 2.7 Pregled zahtjeva

U nastavku se po ciklusima bilježe povratne informacije i promjene zahtjeva.

M0 — 4. tjedan. Dogovorena je OAuth/OIDC prijava. Naknadno je implementiran Google kao pružatelj identiteta ([PR #29](https://github.com/paolabbradaric/grupa122/pull/29)).

M1 — rok prve predaje 20. 11. 2026. Povratne informacije još nisu evidentirane.

M2 — 12. tjedan. Još nije održano. Na čekanju.

M3 — 14. tjedan. Još nije održano. Na čekanju.

---

Definirano je 23 funkcijska i 12 nefunkcijskih zahtjeva. F-002 je prilagođen OAuth/OIDC prijavi. Neriješene integracije i odluke navedene su u poglavlju 2.4.
