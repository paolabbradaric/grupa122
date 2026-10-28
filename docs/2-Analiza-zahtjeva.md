# 2. Analiza zahtjeva — CastMeIfYouCan

**Verzija:** Priprema za M0 (4. tjedan), 28. 10. 2026.  
**Projekt:** CastMeIfYouCan — stranica na kojoj kandidati pronalaze casting oglase i prijavljuju se, a poslodavci objavljuju oglase i biraju kandidate.

Ovdje smo napisali što naša aplikacija treba raditi i kako ćemo provjeriti je li sve napravljeno. Dio stranica već postoji, ali nisu sve povezane s backendom i bazom. Zato zahtjevi opisuju **što planiramo napraviti**, a ne samo što je već gotovo.

## 2.1 Funkcijski zahtjevi

Ovo su funkcije koje naša aplikacija treba imati. Svaka ima oznaku, prioritet, izvor i kriterij po kojem ćemo provjeriti radi li. **Visok** znači najvažnije, **Srednji** važne dodatne funkcije, a **Nizak** stvari koje nisu ključne za osnovni rad.  

| ID | Opis | Prioritet | Izvor | Kriteriji prihvaćanja |
| --- | --- | --- | --- | --- |
| F-001 | Kandidat s 18 ili više godina može napraviti račun pomoću korisničkog imena, e-pošte i lozinke. | Visok | Plan razvoja tima | Za valjane podatke punoljetne osobe nastaje račun kandidata; duplikat korisničkog imena ili e-pošte, datum rođenja osobe mlađe od 18 godina i neispravna lozinka odbijaju se bez stvaranja računa. |
| F-002 | Poslodavac može napraviti račun i upisati podatke svoje tvrtke. | Visok | Plan razvoja tima | Valjan naziv tvrtke, OIB, kontakt, sjedište, korisničko ime i lozinka stvaraju račun poslodavca; nepotpuni podaci i OIB bez 11 znamenki odbijaju se. Registracija sama po sebi ne daje ovlast objave oglasa. |
| F-003 | Kandidati i poslodavci mogu se prijaviti korisničkim imenom i lozinkom, uz različite uloge. | Visok | Dogovor tima (način prijave još trebamo potvrditi) | Valjani podaci omogućuju autentificiranu sesiju s odgovarajućom ulogom; pogrešni podaci ne otvaraju sesiju i ne daju pristup zaštićenim funkcijama. Na M0 potvrditi način prijave. |
| F-004 | Prijavljeni korisnik može se odjaviti iz aplikacije. | Visok | Plan razvoja tima | Nakon odjave korisnik ne može izvršavati radnje koje zahtijevaju prijavu, čak ni izravnim slanjem API zahtjeva sa starom sesijom. |
| F-005 | Korisnik može promijeniti svoju lozinku. | Srednji | Plan razvoja tima | Korisnik koji je unio ispravnu postojeću lozinku i valjanu novu lozinku može se prijaviti novom, ali ne starom lozinkom; neispravna postojeća lozinka ne mijenja podatke. |
| F-006 | Kandidat može pregledavati i uređivati svoj profil, iskustvo i vještine. | Visok | Plan razvoja tima | Kandidat može spremiti ime, prezime, grad, iskustvo, vještine te ponuđene fizičke karakteristike; izmjene se vide nakon ponovne prijave, a drugi kandidat ne može mijenjati taj profil. |
| F-007 | Kandidat može dodati profilnu sliku i najviše pet JPG/PNG slika u portfolio. | Srednji | Plan razvoja tima | Kandidat može dodati i ukloniti fotografije te ih ponovno pregledati nakon prijave; više od pet fotografija ili nepodržan format odbijaju se bez neispravne pohrane. |
| F-008 | Poslodavac može pregledavati i uređivati podatke o svojoj tvrtki. | Visok | Plan razvoja tima | Vlasnik računa može spremiti i ponovno dohvatiti naziv tvrtke, OIB, kontakt, sjedište i logotip; podaci drugih poslodavaca nisu mu dostupni za uređivanje. |
| F-009 | Poslodavac može zatražiti verifikaciju tvrtke, pratiti status i ponovno poslati zahtjev nakon odbijanja. | Visok | Plan razvoja tima | Poslodavac s valjanim podacima može poslati zahtjev; status prelazi u na čekanju odnosno u pregledu, a nakon odluke u odobreno ili odbijeno. Odbijeni poslodavac vidi razlog i može podnijeti novi zahtjev. |
| F-010 | Administrator može pregledati, odobriti ili odbiti zahtjev za verifikaciju tvrtke. | Visok | Plan razvoja tima | Administrator može obraditi zahtjev i zabilježiti odluku; kod odbijanja razlog je obvezan. Korisnik bez administratorske uloge ne može promijeniti status verifikacije. |
| F-011 | Svi posjetitelji mogu vidjeti javno objavljene casting oglase. | Visok | Plan razvoja tima | Posjetitelj vidi samo oglase koji su javno objavljeni i dostupni za pregled; nacrti i otkazani oglasi ne pojavljuju se na popisu aktualnih oglasa. |
| F-012 | Posjetitelj može otvoriti casting oglas i vidjeti njegove detalje. | Visok | Plan razvoja tima | Otvaranjem oglasa prikazuju se projekt, vrsta projekta, opis i uloga, uvjeti, lokacija, rok prijave i broj traženih kandidata; za nepostojeći oglas sustav prikazuje odgovarajuću poruku. |
| F-013 | Oglase je moguće pretraživati i filtrirati prema nazivu, vrsti projekta, lokaciji, dobi i uvjetima uloge. | Srednji | Plan razvoja tima | Pretraga i filtri prikazuju samo oglase koji odgovaraju zadanim kriterijima; bez rezultata se prikazuje poruka, a čišćenjem filtara ponovno se vidi puni popis. |
| F-014 | Prijavljeni kandidat može poslati prijavu na oglas koji još prima prijave. | Visok | Plan razvoja tima | Kandidat može predati prijavu prije roka i prije dosezanja limita prijava; nastaje zapis povezan s kandidatom i oglasom te korisnik prima potvrdu. Gost se upućuje na prijavu u sustav. |
| F-015 | Aplikacija sprječava duple prijave te prijave nakon roka ili nakon dosegnutog limita. | Visok | Plan razvoja tima | Druga prijava istog kandidata, prijava nakon roka, na zatvoren/otkazan/popunjen oglas ili nakon dosegnutog maksimalnog broja prijava odbija se uz razlog; provjera vrijedi i pri izravnom API zahtjevu. |
| F-016 | Kandidat može vidjeti svoje prijave i njihove statuse. | Visok | Plan razvoja tima | Kandidat vidi samo svoje prijave s pripadajućim oglasom, datumom i statusom; ne vidi prijave drugih kandidata. |
| F-017 | Korisnik može vidjeti obavijesti o prijavama i audicijama i označiti ih pročitanima. | Srednji | Plan razvoja tima | Promjena relevantnog statusa ili termina stvara obavijest namijenjenu odgovarajućem korisniku; korisnik može obavijest označiti pročitanom, bez pristupa tuđim obavijestima. |
| F-018 | Poslodavac može napraviti i spremiti nacrt oglasa koji nije javno vidljiv. | Visok | Plan razvoja tima | Poslodavac može spremiti djelomično popunjen nacrt; nacrt ostaje dostupan u Mojim oglasima nakon ponovne prijave, a ne pojavljuje se među javnim oglasima. Nacrt može spremiti i poslodavac koji nije verificiran. |
| F-019 | Samo verificirani poslodavac može objaviti oglas s ispravno ispunjenim podacima. | Visok | Plan razvoja tima | Objava zahtijeva naziv i tip projekta, opis, ulogu, lokaciju, budući rok, pozitivan cijeli broj traženih kandidata te dopušten maksimalan broj prijava (početno 1000). Sustav odbija nepotpune podatke i neverificiranog poslodavca. |
| F-020 | Poslodavac može uređivati svoje oglase dok njihov status to dopušta. | Visok | Plan razvoja tima | Vlasnik može izmijeniti dopuštena polja svog nacrta ili oglasa i ponovno vidjeti promjene; ne može uređivati tuđi oglas ili zaobići pravila statusa. |
| F-021 | Poslodavac može vidjeti, pretraživati i filtrirati svoje oglase prema statusu. | Srednji | Plan razvoja tima | Poslodavac vidi svoje nacrte, objavljene, zatvorene, popunjene i otkazane oglase; pretraga i statusni filtar mijenjaju prikaz, a oglasi drugog poslodavca nisu prikazani. |
| F-022 | Poslodavac može zatvoriti prijave ili otkazati svoj oglas. | Visok | Plan razvoja tima | Ovlašteni poslodavac može potvrditi promjenu statusa; nakon zatvaranja ili otkazivanja nove prijave nisu moguće, a otkazivanje obrađuje i povezane buduće audicije te obavijesti. |
| F-023 | Poslodavac može pregledavati prijave kandidata na svoje oglase. | Visok | Plan razvoja tima | Poslodavac vidi prijave vezane uz vlastiti oglas, uz prikladne podatke kandidata, ali ne može dohvatiti prijave na tuđi oglas; administrator pristupa samo u okviru dodijeljenih ovlasti. |
| F-024 | Poslodavac može mijenjati status prijave i unijeti razlog odbijanja. | Visok | Plan razvoja tima | Ovlašteni poslodavac može mijenjati stanje prijave kroz predana, u pregledu, uži izbor, pozvan na audiciju, audicija održana i odabran/odbijen; odbijanje sadrži razlog, a nevaljani prijelazi i tuđe prijave su odbijeni. |
| F-025 | Administrator može trajno obrisati oglas i podatke povezane s njim. | Visok | Plan razvoja tima | Nakon izričite potvrde administrator uklanja oglas te vezane prijave, termine, rezervacije i odnosne datoteke/zapise prema pravilima brisanja; oglas više nije dohvatljiv. Korisnik bez ovlasti ne može obrisati oglas. Opseg vlasničkog brisanja razjasniti. |
| F-026 | Kandidat može povući prijavu koju je poslao. | Srednji | Plan razvoja tima | Kandidat može povući vlastitu prijavu dok je povlačenje dopušteno; status se ažurira, povezane rezervacije obrađuju se prema pravilima i povučena se prijava ne smatra aktivnom. |
| F-027 | Poslodavac može dodati i otkazati termine audicije s datumom, lokacijom i kapacitetom. | Visok | Plan razvoja tima | Ovlašteni vlasnik oglasa može spremiti termin s početkom, završetkom, lokacijom i pozitivnim kapacitetom; neispravni datumi se odbijaju. Otkazivanje mijenja status termina i pokreće obavijesti rezerviranima. |
| F-028 | Kandidat koji je pozvan na audiciju može rezervirati slobodan termin. | Visok | Plan razvoja tima | Pozvani kandidat može rezervirati jedan raspoloživ termin za svoju prijavu; nepozvan korisnik ili drugi kandidat to ne može. Istodobni zahtjevi ne mogu prekoračiti kapacitet ni stvoriti dvije aktivne rezervacije. |
| F-029 | Kandidat može promijeniti ili otkazati rezervaciju, a poslodavac može označiti dolazak ili nedolazak. | Srednji | Plan razvoja tima | Kandidat može otkazati i, kada je dopušteno, odabrati drugi slobodan termin. Poslodavac može evidentirati dolazak ili nedolazak; oslobođeno mjesto ponovno je dostupno i promjene se prikazuju sudionicima. |
| F-030 | Oglas se automatski označava popunjenim kad je odabran traženi broj kandidata. | Visok | Plan razvoja tima | Kad se odabere točno onoliko kandidata koliko je navedeno u polju broj traženih kandidata, oglas se zatvara za prijave, označava popunjenim i obrađuje preostale prijave/rezervacije; nije moguće odabrati više kandidata od traženog broja. |
| F-031 | Korisnik može prijaviti oglas s neprimjerenim sadržajem. | Srednji | Plan razvoja tima | Korisnik može označiti oglas i poslati prijavu s razlogom; prijava je dostupna administratoru za obradu i ne mijenja automatski status oglasa. |
| F-032 | Administrator može pregledati i obraditi prijave neprimjerenih oglasa. | Srednji | Plan razvoja tima | Administrator može pregledati prijavu, zabilježiti odluku i poduzeti dopuštenu moderatorsku radnju; korisnik bez administratorskih ovlasti to ne može. |
| F-033 | Administrator može vidjeti osnovnu statistiku korisnika, verifikacija, oglasa i prijava. | Nizak | Plan razvoja tima | Administratorski prikaz pokazuje brojeve usklađene sa zapisima u bazi; neovlašteni korisnik nema pristup administrativnoj statistici. |
| F-034 | Aplikacija šalje važne obavijesti o prijavama i audicijama putem e-pošte. | Srednji | Plan tima i upute kolegija (usluga nije odabrana) | Nakon dogovorenog događaja sustav pokušava dostaviti obavijest na adresu korisnika putem konfigurirane vanjske usluge; uspjeh ili neuspjeh dostave može se provjeriti u zapisima. Odabir usluge i točne vrste poruka treba potvrditi. |

**Još trebamo dogovoriti:** Planirali smo vlastitu prijavu (F-003), ali u uputama kolegija piše OIDC/OAuth. To ćemo pitati asistenta. Također trebamo potvrditi koju vanjsku uslugu koristimo za e-poštu (F-034), tko smije trajno brisati oglase i koja su pravila promjene statusa. Provjere moraju raditi na backendu, a ne samo u sučelju.

## 2.2 Nefunkcijski zahtjevi

Ovo su zahtjevi vezani uz sigurnost, brzinu, pouzdanost i jednostavnost korištenja. Za svaki piše kako ćemo ga provjeriti.

| ID | Opis | Prioritet | Izvor | Način provjere |
| --- | --- | --- | --- | --- |
| NF-01 | Backend mora provjeravati korisničke ovlasti, tako da nitko ne može mijenjati tuđe podatke. | Visok | Dogovor tima i kvaliteta aplikacije | Izravnim API zahtjevima pokušati pristupiti tuđim profilima, oglasima i prijavama te administratorskim radnjama; neovlaštene radnje moraju biti odbijene. |
| NF-02 | Ako koristimo vlastitu prijavu, lozinke se moraju sigurno spremati kao hash sa soli, a ne kao običan tekst. | Visok | Sigurnost i dogovor tima (ako ostane vlastita prijava) | Pregledati tablice i kod za registraciju i provjeriti sigurno hashiranje lozinki (npr. Argon2id) te da se izvorna lozinka ne zapisuje ni šalje u odgovoru API-ja. |
| NF-03 | Objavljena aplikacija mora koristiti HTTPS za prijavu i slanje privatnih podataka. | Visok | Dogovor tima i kvaliteta aplikacije | Na javno postavljenoj aplikaciji provjeriti valjani HTTPS te spriječiti slanje osjetljivih podataka nezaštićenom vezom. |
| NF-04 | Backend mora provjeravati unesene podatke čak i kada je to već napravio frontend. | Visok | Dogovor tima i kvaliteta aplikacije | Izravno poslati nevaljane vrijednosti, npr. negativan broj kandidata, pogrešan OIB, istekao rok ili prekoračen kapacitet; baza se ne smije mijenjati i mora se vratiti razumljiva pogreška. |
| NF-05 | U testnom okruženju najmanje 95 % zahtjeva za dohvat oglasa pri 20 istodobnih korisnika treba završiti unutar 3 sekunde. | Srednji | Prijedlog tima (treba potvrditi) | Izvesti test opterećenja s 20 istodobnih korisnika, izmjeriti 95. percentil i zapisati okolinu i rezultate; brojke nisu mjerene ni unaprijed odobrene. |
| NF-06 | Spremljeni profili, oglasi, prijave i rezervacije moraju ostati spremljeni i nakon osvježavanja stranice ili ponovnog pokretanja aplikacije. | Visok | Dogovor tima i kvaliteta aplikacije | Spremiti testne podatke, osvježiti stranicu i ponovno pokrenuti aplikaciju; provjeriti ponovni dohvat iz baze, a ne samo iz stanja u pregledniku. |
| NF-07 | Stranica treba biti prilagođena mobitelima, tabletima i računalima. | Srednji | Prilagodba različitim uređajima | Na širinama 360 px, 768 px i 1440 px provjeriti prijavu, profile, pregled i predaju prijave te stvaranje oglasa; ne smiju nestajati obavezne kontrole. |
| NF-08 | Glavni obrasci moraju se moći koristiti tipkovnicom, uz vidljiv fokus i razumljive poruke o greškama. | Srednji | Pristupačnost | Proći prijavu, registraciju, pretragu oglasa i obrazac prijave bez miša; provjeriti oznake polja, redoslijed fokusa i poruke. |
| NF-09 | Glavne funkcije trebaju raditi u aktualnim verzijama Chromea i Firefoxa. | Srednji | Podrška preglednicima | Izvršiti isti osnovni scenarij registracije, pregleda oglasa i prijave na oglas u oba preglednika te zabilježiti razlike. |
| NF-10 | Tekstovi, gumbi, statusi i poruke trebaju biti razumljivi i dosljedni na hrvatskom jeziku. | Nizak | Dogovor tima i kvaliteta aplikacije | Proći tipične tijekove kandidata, poslodavca i administratora te pregledati tekstualnu dosljednost. |
| NF-11 | Kod greške aplikacija prikazuje jasnu poruku, bez otkrivanja lozinki, SQL upita ili internih detalja. | Visok | Dogovor tima i kvaliteta aplikacije | Simulirati pogrešnu prijavu, nepostojeći oglas i grešku baze te pregledati odgovore i korisničke poruke. |
| NF-12 | Podaci kandidata, fotografije i prijave moraju biti dostupni samo korisnicima koji imaju ovlasti. | Visok | Zaštita privatnosti | Pokušati dohvatiti privatne podatke kao gost i drugi korisnik; provjeriti odbijanje, kontrolu pristupa datotekama i prikaz samo dopuštenih podataka poslodavcu. |

**Napomena:** Brzinu iz NF-05 još nismo mjerili, nego je to naš prijedlog. Ciljeve za uređaje i preglednike također trebamo potvrditi. Ako budemo koristili vanjsku prijavu, moramo prilagoditi NF-02.

## 2.3 Dionici i akteri

Ovdje su navedene uloge koje koriste aplikaciju i što svaka od njih može raditi.

| ID aktera | Uloga i odnos prema sustavu | Korisnički ciljevi | Relevantni zahtjevi |
| --- | --- | --- | --- |
| A-01 | Posjetitelj (neprijavljeni korisnik) | Pregled javnih oglasa i detalja; odlazak na prijavu/registraciju. | F-001–F-003, F-011–F-013 |
| A-02 | Kandidat (registrirani korisnik) | Uređuje profil i portfolio, pregledava i predaje/povlači prijave, rezervira audicije i prima obavijesti. | F-001, F-003–F-007, F-011–F-017, F-026, F-028–F-029, F-034 |
| A-03 | Poslodavac (predstavnik organizacije) | Uređuje organizaciju, traži verifikaciju, upravlja oglasima i odabirom, terminima i prijavama. | F-002–F-005, F-008–F-009, F-018–F-024, F-027, F-029–F-030 |
| A-04 | Administrator (zajednički demo račun) | Provjerava organizacije, obrađuje prijavljeni sadržaj i uklanja oglase; pregledava statistike. | F-010, F-025, F-031–F-033 |
| A-05 | Vanjska usluga e-pošte (sekundarni akter, planirano) | Sudjeluje pri dostavi važnih obavijesti; konkretan pružatelj nije odabran. | F-034 |

**Ostali dionici:** naš tim koji razvija aplikaciju te asistent i nastavnik koji prate projekt. Ako odaberemo vanjsku prijavu, dodat ćemo i tu uslugu među aktere.

## 2.4 Ograničenja i pretpostavke

Ovdje smo zapisali pravila projekta i stvari koje još trebamo potvrditi.

| ID | Tip | Opis ograničenja ili pretpostavke | Izvor | Inženjerska posljedica / Provjera |
| --- | --- | --- | --- | --- |
| C-01 | Ograničenje | Jedan casting oglas predstavlja jedan zaseban projekt i jednu ulogu; broj traženih kandidata i maksimalni broj prijava odvojena su polja (početni maksimum prijava 1000). | Plan razvoja tima | Uskladiti bazu, API i obrazac oglasa te testirati pravila za oba broja. |
| C-02 | Ograničenje | Registracija kandidata predviđena je za punoljetne osobe (18+). | Plan razvoja tima | Sustav provjerava datum rođenja pri registraciji i ne dopušta maloljetnički račun. |
| C-03 | Ograničenje | Postojeću PostgreSQL bazu treba sačuvati; usklađenja sheme izvoditi migracijama bez nepotrebnog gubitka podataka. | Dogovor tima (22. 10. 2026.) | Usporediti trenutačni `db/schema.sql` s planom (npr. polje `max_applications`) i izraditi migracijski plan. |
| C-04 | Ograničenje | Za demonstraciju se koristi jedan zajednički administratorski račun; pristupni podaci nisu dio repozitorija. | Dogovor tima | Ograničiti ovlasti i čuvanje tajni; provjeriti postupak demo prijave. |
| C-05 | Otvoreno ograničenje | Nastavni plan za 6. tjedan navodi OpenID Connect/OAuth 2.0 prijavu putem vanjskog pružatelja identiteta, a tim je planirao vlastitu prijavu. | Plan rada kolegija, 6. tjedan; Plan razvoja tima | Prije konačne potvrde F-003 dogovoriti s asistentom: prilagoditi autentifikaciju ili dobiti izričitu odluku o odstupanju. Ovo se ne smatra riješenim. |
| C-06 | Ograničenje | Nastavni plan predviđa domenski relevantnu integraciju s vanjskim sustavom/uslugom najkasnije u nastavku implementacije. | Plan rada kolegija, 10. tjedan; Plan razvoja tima | Potvrditi prihvaća li se e-pošta za audicije kao integracija i odabrati dobavljača; nakon odluke precizirati F-034. |
| AS-01 | Pretpostavka | Pravila prikaza profila i portfolija poslodavcu ograničit će pristup na kandidata povezanog s odgovarajućom prijavom. | Procjena tima, potreban dogovor o privatnosti | Potvrditi s asistentom i u testovima provjeriti autorizaciju privatnih podataka. |
| AS-02 | Pretpostavka | Otkazana audicija oslobađa mjesto, a status oglasa i rezervacije ažuriraju se dosljedno. | Plan razvoja tima | Precizirati statusne prijelaze i testirati otkazivanje, ponovno rezerviranje i konkurentne zahtjeve. |
| AS-03 | Pretpostavka | Maksimalan broj prijava 1000 je početna vrijednost po oglasu, uz mogućnost manje vrijednosti. | Plan razvoja tima | Provjeriti točnu dopuštenu granicu (1–1000 u prototipu) i uskladiti frontend, API i bazu. |

**Što trebamo pitati na M0:** (1) Je li vanjska prijava OpenID Connect/OAuth 2.0 obvezna umjesto vlastite prijave? (2) Koja vanjska domenski relevantna integracija se priznaje — e-pošta za audicije ili druga usluga? (3) Tko ima ovlast nepovratnog brisanja i kako postupati s obavijestima i datotekama? (4) Koji podaci profila postaju vidljivi poslodavcu i kada? (5) Koji su konačni statusni prijelazi oglasa, prijava i rezervacija? (6) Jesu li vrijednosti iz NF-05 prihvatljive i mjerljive?

## 2.5 Značajne promjene zahtjeva

U ovu tablicu upisujemo veće promjene u dogovorima. Dopunit ćemo je nakon razgovora s asistentom.

| Datum | ID zahtjeva | Promjena i razlog | Dogovoreno s / dokaz |
| --- | --- | --- | --- |
| 22. 10. 2026. | F-001–F-034; NF-01–NF-12 | Ponovni početak razvoja uz očuvanje baze; prethodni kod više se ne smatra dovršenim sustavom. Zahtjevi dokumentiraju ciljanu funkcionalnost, ne završenost. | Dogovori i zadaci tima |
| Listopad 2026. (dan nije evidentiran) | F-019, F-030 | Potvrđen odvojeni broj traženih kandidata; u radnom planu dodatno definiran `max_applications` s početnom vrijednošću 1000. | Dogovor tima |
| Listopad 2026. (dan nije evidentiran) | F-025 | Dogovoreno trajno brisanje oglasa i vezanih podataka umjesto samo skrivanja/soft deletea. | Dogovor tima |
| 28. 10. 2026. — dokumentacijski nacrt | F-003; C-05 | Zabilježen nesklad između vlastite prijave iz plana tima i OIDC/OAuth prijave u nastavnom planu. Odluka još nije donesena. | Za raspravu s asistentom na M0 — nije odobrena promjena |

„Dokumentacijski nacrt” znači da smo primijetili otvoreno pitanje, a ne da je asistent već odlučio. Nakon M0 ćemo upisati što smo stvarno dogovorili.

## 2.6 Sljedivost zahtjeva

U ovoj tablici povezujemo zahtjeve s dijelovima aplikacije i planiranim testovima. **Testovi još nisu provedeni.** Oznake obrazaca uporabe dodat ćemo kada uskladimo dokument [3-Obrasci-uporabe.md](3-Obrasci-uporabe.md).

| ID zahtjeva | Obrazac uporabe / modul | Arhitekturna realizacija | Ispitivanje ili provjera |
| --- | --- | --- | --- |
| F-001–F-005 | Registracija / autentifikacija / odjava | Planirani modul autentifikacije; postojeći UI: `Login.jsx`, `Register.jsx`, `EmployerLogin.jsx`, `EmployerRegister.jsx`. | Planirano: registracija 18+, duplikat, neispravni podaci, prava nakon odjave i promjena lozinke. |
| F-006–F-008 | Korisnički profili i portfolio | Postojeći UI: `CandidateProfile.jsx`, `EmployerProfile.jsx`; planirani profilni API. | Planirano: spremanje nakon ponovne prijave, 5 slika, format datoteke, pristup tuđem profilu. |
| F-009–F-010 | Zahtjev za verifikaciju / admin odluka | Planirani modul verifikacije i admin prikaz. | Planirano: valjan zahtjev, odbijanje s razlogom, ponovni zahtjev, neovlaštena odluka. |
| F-011–F-013 | Pregled i pretraga javnih oglasa | Postojeći `Home.jsx` (ogledni podaci); backend `castingModel.js` (dohvat objavljenih); dorada , . | Planirano: javni popis, detalj, filtriranje, nepostojeći i nedostupni oglas. |
| F-014–F-016; F-026 | Predaja, provjera i povlačenje prijave; Moje prijave | Planirani API oglasa/prijava i frontend. | Planirano: valjana prijava, duplikat, istek, maksimum, tuđe prijave, povlačenje. |
| F-017; F-034 | Obavijesti u aplikaciji i putem e-pošte | Postojeći `CandidateNotifications.jsx` (prikaz); planirane usluge. | Planirano: ispravan primatelj, označavanje pročitanim, dostava/greška vanjske usluge. |
| F-018–F-022 | Nacrti, objava, uređivanje i stanja oglasa | Postojeći UI: `NoviOglas.jsx`, `MojiOglasi.jsx`; planirani API i statusna pravila. | Planirano: nacrt, objava verificiranog korisnika, broj kandidata, rok, vlasništvo, otkaz. |
| F-023–F-024; F-030 | Pregled prijava, statusi i odabir kandidata | Planirani modul prijava i odabira, sučelje poslodavca. | Planirano: pristup samo vlastitom oglasu, prijelazi statusa, razlog odbijanja, popunjavanje. |
| F-025 | Administratorsko brisanje oglasa | Planirana admin API/DB logika; izravno povezani zapisi u bazi. | Planirano: potvrda brisanja, kaskadno uklanjanje, odbijanje neovlaštenog zahtjeva. |
| F-027–F-029 | Termini i rezervacije audicija | Planirani API i model rezervacija, prikaz prijava i audicija. | Planirano: kapacitet, poziv, zabrana duple rezervacije, otkazivanje, promjena termina, dolazak. |
| F-031–F-033 | Prijava sadržaja, moderacija i statistika | Planirani administracijski modul i panel. | Planirano: prijava, administratorska odluka, autorizacija i usklađen broj statistika. |
| NF-01–NF-04; NF-11–NF-12 | Sigurnost i privatnost | Autentifikacija i ovlasti; zaštita pristupa u API-ju; plan implementacije. | Planirano: autorizacijski, validacijski, privatnosni i sigurnosni testovi. |
| NF-05–NF-10 | Performanse, pouzdanost, responzivnost i pristupačnost | Web-klijent, API i PostgreSQL, nakon povezivanja modula. | Planirano: mjerenje p95, ponovno pokretanje, responzivne veličine, tipkovnica i preglednici. |

**Trenutačno stanje:** Ako piše „planirano”, taj dio ili test još trebamo završiti. Kasnije ćemo dodati stvarne testove iz [5-Ispitivanje.md](5-Ispitivanje.md). Neke stranice već imamo, ali nisu sve povezane.

## 2.7 Pregled zahtjeva

Ovdje ćemo nakon prezentacija upisati komentare asistenta i promjene koje dogovorimo.

| Kontrolna točka | Povratna informacija ili nalaz | Odluka o zahtjevu ili opsegu |
| --- | --- | --- |
| M0 — 4. tjedan | Rasprava s asistentom tek predstoji: posebno F-003/C-05, F-034/C-06 i politika pristupa podacima. | Na čekanju — upisati isključivo stvarni dogovor nakon prezentacije. |
| M1 — 7. tjedan | Još nije održano. | Na čekanju. |
| M2 — 12. tjedan | Još nije održano. | Na čekanju. |
| M3 — 14. tjedan | Još nije održano. | Na čekanju. |

---

**Za M0:** Napisali smo 34 funkcijska i 12 nefunkcijskih zahtjeva te povezali uloge, pravila i načine provjere. Još trebamo s ekipom proći otvorena pitanja i uskladiti ih s [Obrascima uporabe](3-Obrasci-uporabe.md).
