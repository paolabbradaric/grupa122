# 3. Obrasci uporabe — CastMeIfYouCan

**Verzija:** Priprema za M0 (4. tjedan), listopad 2026.

U ovom dijelu opisujemo kako će se koristiti naša aplikacija: tko što radi, koji su koraci i što se događa ako nešto ne uspije. Koristimo iste oznake funkcijskih zahtjeva kao u [2. Analizi zahtjeva](2-Analiza-zahtjeva.md). Ovo je **planirano ponašanje aplikacije** — ne znači da su sve funkcije već gotove.

## 3.1 Dijagram obrazaca uporabe

Na dijagramu je prikazano tko koristi CastMeIfYouCan i koje su glavne radnje dostupne pojedinim korisnicima.

**Glavni akteri:** Posjetitelj (A-01), kandidat (A-02), poslodavac (A-03) i administrator (A-04). Vanjska usluga e-pošte (A-05) služi kao pomoćni akter za obavijesti; ta je integracija zasad u planu.

![Dijagram obrazaca uporabe aplikacije CastMeIfYouCan](https://www.plantuml.com/plantuml/png/RPJ1Zjem48RlVeeHToH20WkthL1LLTMggsuvjCfbY8UiGx2HuqJgLds8FaBVfNslEjOcPfdSc7--tyoC9nRtZKFhsdCjQZewS0QiAfyTI6MfSCfeqPoKlg35CromE659J-v7JT2dKPSr2O65CnPcZwQfo2b7TJK3RE23QToG-uHQAeak98RWobWRYHqM8Ht30NWdpqghnbdqOM22CgJtJTsM23I_c7z_70NW_HbLBSHO9SnssBW7-dZyPjeTwXdy501jGmKsFhdVpHUB9DTVg0p_KwWAmpdxdTSPkSpre_L8Xw30IFyZqaj6fxdUM_hxMtMeAuABDKTLHqFA35b_FFcg9PYonYQo6MDNkVwEpwwY3buGEhBgg4vz_UreMZ7JEjUV3nRb6mEDXZKptENwoNLeGmCAp27qVbFS7RDjVESNYrrT1MFWrJawDionZPFL23xXb2v7VdlB9ujSFvX-gC4qjE1rHYQ-Pua7PU7qkdyuqWcZ_Gr_9Tkl7M0hrTK--1oZqtvpNiXss8E38rQJCaVMtm1s7l8TZbp6k5MO1v-spp1stSz2abNXccxvjVWbHFzDmdp-kjRNKIR4y5sE05EMJ4cPaZ5bUwia2wQaJCcOiX8YlWsnIAuj9xHqGiicjDM4TZUXRRYM91FQSaBZ_nkQ2uzQxE5DkBuAmsMAyCB54-z9o_uP_my0)

**Slika 3.1. Dijagram obrazaca uporabe — CastMeIfYouCan**

**PlantUML izvor:** [3-1-castmeifyoucan-system-UC.puml](puml/3-1-castmeifyoucan-system-UC.puml). Za sliku smo upotrijebili PlantUML prikaz dijagrama koji smo odabrali za projekt.

Dijagram prikazuje 16 glavnih obrazaca uporabe: registraciju i prijavu, profile, oglase, prijave kandidata, audicije, obavijesti, verifikaciju i administraciju. Neke manje radnje nalaze se unutar tih obrazaca, zato ne crtamo poseban oval za svaku funkciju iz dokumenta 2.

**Napomena:** U našem prvotnom planu prijava ide korisničkim imenom i lozinkom. U nastavnom planu kolegija spominje se i OpenID Connect / OAuth 2.0. Ako se dogovorimo za vanjsku prijavu, nadopunit ćemo dijagram i specifikaciju UC-002 vanjskim pružateljem identiteta.

## 3.2 Specifikacije obrazaca uporabe

Za svaki obrazac uporabe napisali smo tko ga pokreće, što treba biti ispunjeno, glavni tijek, važne iznimke i rezultat. Tekst je namjerno kratak i prati korisničke radnje, a tehnički detalji pripadaju implementaciji.

### UC-001: Registracija

| Element specifikacije | Opis |
| :--- | :--- |
| **Primarni akter** | Posjetitelj (A-01) |
| **Povezani zahtjevi** | F-001, F-002 |
| **Preduvjeti** | Korisnik još nema račun. |
| **Glavni uspješni tok** | 1. Korisnik otvara registraciju.<br>2. Odabire želi li se registrirati kao kandidat ili poslodavac.<br>3. Unosi podatke i šalje obrazac.<br>4. Aplikacija provjerava podatke i stvara račun.<br>5. Korisnik vidi potvrdu registracije. |
| **Alternativni tokovi / Iznimke** | **3a – Nepotpuni ili neispravni podaci:** prikazuje se poruka i korisnik ih ispravlja.<br>**4a – Korisničko ime ili e-pošta već postoje:** račun se ne stvara.<br>**4b – Kandidat nema 18 godina:** registracija se odbija.<br>**4c – Poslodavac nema ispravan OIB:** traži se ispravak. |
| **Posljedice (ishod)** | Račun je stvoren. Poslodavac prije objavljivanja oglasa mora proći verifikaciju. |

### UC-002: Prijava i odjava

| Element specifikacije | Opis |
| :--- | :--- |
| **Primarni akter** | Kandidat (A-02), poslodavac (A-03), administrator (A-04) |
| **Povezani zahtjevi** | F-003, F-004 |
| **Preduvjeti** | Korisnik ima račun ili dodijeljen administratorski pristup. |
| **Glavni uspješni tok** | 1. Korisnik otvara prijavu.<br>2. Unosi korisničko ime i lozinku.<br>3. Aplikacija provjerava podatke i ulogu.<br>4. Korisnik dobiva pristup dopuštenim funkcijama.<br>5. Na kraju odabire odjavu i aplikacija završava sesiju. |
| **Alternativni tokovi / Iznimke** | **3a – Pogrešni podaci:** prijava se odbija i prikazuje se poruka.<br>**3b – Greška prilikom prijave:** korisnik dobiva obavijest da može pokušati ponovno.<br>**5a – Odjavljena sesija:** zaštićene funkcije više nisu dostupne. |
| **Posljedice (ishod)** | Korisnik se uspješno prijavio ili odjavio. **Napomena:** način prijave (vlastita prijava ili OIDC/OAuth) još trebamo potvrditi s asistentom. |

### UC-003: Uređivanje profila

| Element specifikacije | Opis |
| :--- | :--- |
| **Primarni akter** | Kandidat (A-02), poslodavac (A-03) |
| **Povezani zahtjevi** | F-005, F-006, F-007, F-008 |
| **Preduvjeti** | Korisnik je prijavljen. |
| **Glavni uspješni tok** | 1. Korisnik otvara svoj profil.<br>2. Aplikacija prikazuje postojeće podatke.<br>3. Kandidat mijenja podatke, iskustvo, vještine ili fotografije; poslodavac uređuje podatke tvrtke.<br>4. Korisnik odabire spremanje.<br>5. Aplikacija provjerava unos i sprema promjene. |
| **Alternativni tokovi / Iznimke** | **3a – Previše fotografija:** kandidat ne može spremiti više od pet fotografija u portfoliju.<br>**3b – Pogrešan format fotografije:** dopušteni su JPG i PNG.<br>**5a – Neispravni podaci:** prikazuje se poruka bez spremanja.<br>**3c – Promjena lozinke:** kod vlastite prijave korisnik može zatražiti promjenu lozinke uz provjeru stare. |
| **Posljedice (ishod)** | Promjene su spremljene i vide se nakon ponovne prijave; tuđi profil ne može se uređivati. |

### UC-004: Pregled oglasa

| Element specifikacije | Opis |
| :--- | :--- |
| **Primarni akter** | Posjetitelj (A-01); pregled je dostupan i prijavljenim korisnicima |
| **Povezani zahtjevi** | F-011, F-012, F-013 |
| **Preduvjeti** | Aplikacija je dostupna. |
| **Glavni uspješni tok** | 1. Korisnik otvara početnu stranicu.<br>2. Aplikacija prikazuje javno objavljene oglase.<br>3. Korisnik može upisati pretragu ili odabrati filtre.<br>4. Odabire zanimljiv oglas.<br>5. Aplikacija prikazuje opis projekta i uloge, uvjete, lokaciju i rok. |
| **Alternativni tokovi / Iznimke** | **3a – Nema rezultata:** prikazuje se poruka da nema odgovarajućih oglasa.<br>**4a – Oglas ne postoji ili nije javno dostupan:** prikazuje se odgovarajuća poruka. |
| **Posljedice (ishod)** | Korisnik je pronašao i pregledao oglas, bez potrebe za prijavom. |

### UC-005: Zahtjev za verifikaciju

| Element specifikacije | Opis |
| :--- | :--- |
| **Primarni akter** | Poslodavac (A-03) |
| **Povezani zahtjevi** | F-009 |
| **Preduvjeti** | Poslodavac je registriran i prijavljen. |
| **Glavni uspješni tok** | 1. Poslodavac otvara profil tvrtke.<br>2. Unosi potrebne podatke.<br>3. Odabire slanje zahtjeva za verifikaciju.<br>4. Aplikacija provjerava podatke.<br>5. Zahtjev se sprema sa statusom na čekanju. |
| **Alternativni tokovi / Iznimke** | **4a – Nepotpuni podaci:** aplikacija traži dopunu.<br>**3a – Zahtjev je već na čekanju:** prikazuje se postojeći status.<br>**3b – Prethodni zahtjev je odbijen:** poslodavac vidi razlog i može poslati novi zahtjev. |
| **Posljedice (ishod)** | Zahtjev za verifikaciju čeka odluku administratora. |

### UC-006: Obrada verifikacije

| Element specifikacije | Opis |
| :--- | :--- |
| **Primarni akter** | Administrator (A-04) |
| **Povezani zahtjevi** | F-010 |
| **Preduvjeti** | Administrator je prijavljen i postoji zahtjev za verifikaciju. |
| **Glavni uspješni tok** | 1. Administrator otvara popis zahtjeva.<br>2. Odabire zahtjev i pregledava podatke tvrtke.<br>3. Odobrava ili odbija zahtjev.<br>4. Aplikacija sprema odluku i mijenja status. |
| **Alternativni tokovi / Iznimke** | **3a – Odbijanje:** administrator mora navesti razlog.<br>**3b – Odustajanje:** zahtjev ostaje nepromijenjen.<br>**4a – Korisnik nema ovlasti:** aplikacija odbija radnju. |
| **Posljedice (ishod)** | Poslodavac vidi novi status; nakon odobrenja može objavljivati oglase. |

### UC-007: Stvaranje i objava oglasa

| Element specifikacije | Opis |
| :--- | :--- |
| **Primarni akter** | Poslodavac (A-03) |
| **Povezani zahtjevi** | F-018, F-019 |
| **Preduvjeti** | Poslodavac je prijavljen. Za javnu objavu treba biti verificiran. |
| **Glavni uspješni tok** | 1. Poslodavac otvara obrazac Novi oglas.<br>2. Unosi naziv i tip projekta, opis, ulogu, lokaciju i rok prijave.<br>3. Posebno upisuje broj traženih kandidata i maksimalan broj prijava (zadano 1000).<br>4. Odabire Objavi.<br>5. Aplikacija provjerava podatke i verifikaciju.<br>6. Oglas se sprema kao objavljen. |
| **Alternativni tokovi / Iznimke** | **4a – Spremi nacrt:** oglas se sprema bez javne objave; nacrt može spremiti i neverificirani poslodavac.<br>**5a – Poslodavac nije verificiran:** objava se odbija.<br>**5b – Nedostaju podaci ili rok nije u budućnosti:** traži se ispravak.<br>**5c – Broj kandidata ili limit prijava nije ispravan:** objava se odbija. |
| **Posljedice (ishod)** | Oglas je javno objavljen ili spremljen kao nacrt. Prema našem dogovoru jedan oglas predstavlja jedan projekt i jednu ulogu. |

### UC-008: Upravljanje oglasima

| Element specifikacije | Opis |
| :--- | :--- |
| **Primarni akter** | Poslodavac (A-03) |
| **Povezani zahtjevi** | F-020, F-021, F-022 |
| **Preduvjeti** | Poslodavac je prijavljen i ima barem jedan oglas. |
| **Glavni uspješni tok** | 1. Poslodavac otvara Moji oglasi.<br>2. Aplikacija prikazuje samo njegove oglase.<br>3. Može ih pretraživati i filtrirati prema statusu.<br>4. Odabire svoj oglas i mijenja dopuštene podatke.<br>5. Sprema promjene. |
| **Alternativni tokovi / Iznimke** | **4a – Zatvori prijave:** nakon potvrde oglas više ne prima prijave.<br>**4b – Otkaži oglas:** nakon potvrde mijenja se status i obrađuju se buduće audicije.<br>**4c – Pokušaj uređivanja tuđeg oglasa:** radnja se odbija.<br>**5a – Nedopuštena promjena:** aplikacija prikazuje poruku i ne sprema izmjenu. |
| **Posljedice (ishod)** | Oglas je ažuriran ili mu je promijenjen status prema pravilima. |

### UC-009: Prijava na casting

| Element specifikacije | Opis |
| :--- | :--- |
| **Primarni akter** | Kandidat (A-02) |
| **Povezani zahtjevi** | F-014, F-015 |
| **Preduvjeti** | Kandidat je prijavljen; oglas je objavljen i još prima prijave. |
| **Glavni uspješni tok** | 1. Kandidat otvara željeni oglas.<br>2. Odabire prijavu na casting.<br>3. Ispunjava obrazac i potvrđuje prijavu.<br>4. Aplikacija provjerava rok, status oglasa, limit i postojeće prijave.<br>5. Prijava se sprema i prikazuje se potvrda. |
| **Alternativni tokovi / Iznimke** | **2a – Korisnik nije prijavljen:** preusmjerava se na prijavu u sustav.<br>**4a – Kandidat se već prijavio:** nova prijava se odbija.<br>**4b – Rok je istekao ili su prijave zatvorene:** prijava se odbija.<br>**4c – Dosegnut maksimalan broj prijava ili je oglas popunjen/otkazan:** prijava se odbija.<br>**5a – Greška spremanja:** nema lažne potvrde. |
| **Posljedice (ishod)** | Prijava je spremljena i dostupna kandidatu u Mojim prijavama. |

### UC-010: Moje prijave

| Element specifikacije | Opis |
| :--- | :--- |
| **Primarni akter** | Kandidat (A-02) |
| **Povezani zahtjevi** | F-016, F-026 |
| **Preduvjeti** | Kandidat je prijavljen. |
| **Glavni uspješni tok** | 1. Kandidat otvara Moje prijave.<br>2. Aplikacija prikazuje njegove prijave i statuse.<br>3. Kandidat odabire prijavu.<br>4. Pregledava detalje oglasa i status. |
| **Alternativni tokovi / Iznimke** | **2a – Nema prijava:** prikazuje se poruka da zasad nema prijava.<br>**3a – Kandidat želi povući prijavu:** potvrđuje povlačenje; aplikacija ga dopušta samo ako pravila to dozvoljavaju.<br>**3b – Pokušaj pregleda tuđe prijave:** pristup se odbija. |
| **Posljedice (ishod)** | Kandidat je pregledao prijave ili povukao dopuštenu prijavu. |

### UC-011: Odabir kandidata

| Element specifikacije | Opis |
| :--- | :--- |
| **Primarni akter** | Poslodavac (A-03) |
| **Povezani zahtjevi** | F-023, F-024, F-030 |
| **Preduvjeti** | Poslodavac je prijavljen i na njegov oglas stigle su prijave. |
| **Glavni uspješni tok** | 1. Poslodavac otvara vlastiti oglas i popis prijava.<br>2. Pregledava dopuštene podatke prijavljenih kandidata.<br>3. Po potrebi mijenja status (u pregledu, uži izbor, poziv na audiciju).<br>4. Nakon procesa odabira označava kandidata odabranim ili odbijenim.<br>5. Aplikacija sprema odluku i ažurira status. |
| **Alternativni tokovi / Iznimke** | **1a – Nema prijava:** prikazuje se poruka.<br>**4a – Kandidat je odbijen:** poslodavac unosi razlog.<br>**5a – Odabran je traženi broj kandidata:** oglas postaje popunjen i zatvara se za nove prijave.<br>**5b – Nedopušten prijelaz statusa ili previše odabranih:** radnja se odbija.<br>**1b – Tuđi oglas:** pristup prijavama se odbija. |
| **Posljedice (ishod)** | Statusi prijava su ažurirani, a odabir se sprema bez prekoračenja broja traženih kandidata. |

### UC-012: Termini audicija

| Element specifikacije | Opis |
| :--- | :--- |
| **Primarni akter** | Poslodavac (A-03) |
| **Povezani zahtjevi** | F-027, F-029 |
| **Preduvjeti** | Poslodavac je prijavljen i ima oglas za koji organizira audicije. |
| **Glavni uspješni tok** | 1. Poslodavac otvara audicije svojeg oglasa.<br>2. Odabire dodavanje termina.<br>3. Unosi datum, početak, završetak, lokaciju i broj mjesta.<br>4. Aplikacija provjerava podatke.<br>5. Termin se sprema i dostupan je pozvanim kandidatima. |
| **Alternativni tokovi / Iznimke** | **4a – Pogrešno vrijeme ili kapacitet:** termin se ne sprema.<br>**2a – Otkazivanje termina:** poslodavac otkazuje termin i rezervirani kandidati dobivaju obavijest.<br>**5a – Nakon audicije:** poslodavac može evidentirati dolazak ili nedolazak. |
| **Posljedice (ishod)** | Termin je spremljen ili otkazan; status dolaska evidentira se kada je potrebno. |

### UC-013: Rezervacija audicije

| Element specifikacije | Opis |
| :--- | :--- |
| **Primarni akter** | Kandidat (A-02) |
| **Povezani zahtjevi** | F-028, F-029 |
| **Preduvjeti** | Kandidat je prijavljen i pozvan je na audiciju. |
| **Glavni uspješni tok** | 1. Kandidat otvara poziv na audiciju.<br>2. Aplikacija prikazuje slobodne termine.<br>3. Kandidat odabire termin.<br>4. Aplikacija provjerava ima li mjesta i smije li kandidat rezervirati.<br>5. Rezervacija se sprema i kandidat dobiva potvrdu. |
| **Alternativni tokovi / Iznimke** | **2a – Nema mjesta:** prikazuje se poruka.<br>**4a – Mjesto se upravo popunilo:** rezervacija se odbija i kandidat može odabrati drugi termin.<br>**4b – Kandidat nije pozvan ili već ima aktivnu rezervaciju:** nova rezervacija se odbija.<br>**5a – Promjena/otkazivanje:** kandidat oslobađa mjesto i po pravilima bira drugi termin. |
| **Posljedice (ishod)** | Kandidat ima potvrđenu rezervaciju ili je uspješno otkazao odnosno promijenio prethodnu. |

### UC-014: Obavijesti

| Element specifikacije | Opis |
| :--- | :--- |
| **Primarni akter** | Kandidat (A-02), poslodavac (A-03); usluga e-pošte (A-05) je sekundarni akter |
| **Povezani zahtjevi** | F-017, F-034 |
| **Preduvjeti** | Korisnik ima račun; nastao je događaj važan za njegovu prijavu ili audiciju. |
| **Glavni uspješni tok** | 1. Nakon promjene sustav stvara obavijest za odgovarajućeg korisnika.<br>2. Korisnik otvara Obavijesti.<br>3. Aplikacija prikazuje poruku i datum.<br>4. Korisnik je može označiti pročitanom. |
| **Alternativni tokovi / Iznimke** | **2a – Nema obavijesti:** prikazuje se odgovarajuća poruka.<br>**1a – Važna promjena:** ako je dogovorena vanjska usluga, pokušava se poslati i e-mail.<br>**1b – Slanje e-pošte nije uspjelo:** greška se bilježi, bez prikazivanja lažne potvrde dostave. |
| **Posljedice (ishod)** | Korisnik vidi obavijest i po potrebi mijenja njezin status u pročitano. E-pošta je još planirana integracija. |

### UC-015: Prijava oglasa

| Element specifikacije | Opis |
| :--- | :--- |
| **Primarni akter** | Kandidat (A-02), poslodavac (A-03) |
| **Povezani zahtjevi** | F-031 |
| **Preduvjeti** | Korisnik je prijavljen i može pregledati oglas. |
| **Glavni uspješni tok** | 1. Korisnik otvara oglas s neprimjerenim sadržajem.<br>2. Odabire opciju Prijavi oglas.<br>3. Unosi razlog prijave.<br>4. Potvrđuje slanje.<br>5. Aplikacija sprema prijavu za administratora. |
| **Alternativni tokovi / Iznimke** | **3a – Nema razloga:** aplikacija traži unos razloga.<br>**4a – Korisnik odustaje:** prijava se ne sprema.<br>**5a – Problem sa spremanjem:** prikazuje se greška. |
| **Posljedice (ishod)** | Administrator može pregledati prijavu; samim slanjem oglas se ne briše. |

### UC-016: Moderiranje oglasa

| Element specifikacije | Opis |
| :--- | :--- |
| **Primarni akter** | Administrator (A-04) |
| **Povezani zahtjevi** | F-025, F-032 |
| **Preduvjeti** | Administrator je prijavljen i postoji oglas ili prijava sadržaja za pregled. |
| **Glavni uspješni tok** | 1. Administrator otvara popis prijavljenih oglasa.<br>2. Pregledava prijavu, razlog i oglas.<br>3. Odlučuje hoće li prijavu odbiti ili poduzeti moderatorsku radnju.<br>4. Aplikacija provjerava ovlasti i sprema odluku. |
| **Alternativni tokovi / Iznimke** | **3a – Trajno brisanje oglasa:** administrator mora potvrditi brisanje; uklanjaju se oglas i dogovoreni povezani zapisi i datoteke.<br>**3b – Prijava nije opravdana:** zatvara se bez brisanja oglasa.<br>**3c – Administrator odustaje:** oglas ostaje nepromijenjen.<br>**4a – Neovlašten korisnik:** radnja se odbija. |
| **Posljedice (ishod)** | Prijava je obrađena. Kod potvrđenog brisanja oglas i povezani podaci više nisu dostupni. |


## 3.3 Provjera dosljednosti obrazaca uporabe

Usporedili smo obrasce s ulogama i funkcijskim zahtjevima iz [2. Analize zahtjeva](2-Analiza-zahtjeva.md).

| Provjera | Kako ćemo provjeriti |
| --- | --- |
| Povezanost sa zahtjevima | Svaki opisani UC navodi postojeće oznake F-001 do F-034 iz dokumenta 2. |
| Korisničke uloge | Provjerit ćemo da kandidat ne može uređivati tuđe oglase, poslodavac ne vidi tuđe prijave i samo administrator izvršava administrativne radnje. |
| Glavni tijek | Svaki opisani postupak treba imati jasan početak, korake i rezultat. |
| Alternativni tijekovi | Obrađujemo važne slučajeve: krive podatke, istek roka, duple prijave, popunjene termine i radnje bez ovlasti. |
| Usklađenost s implementacijom | Tijekom razvoja provjeravat ćemo odgovara li stvarni rad aplikacije ovim opisima. |
| Testiranje | Konkretne testove i njihove rezultate dodat ćemo u [5. Ispitivanje](5-Ispitivanje.md) kada budu provedeni. |

**Zahtjevi koje nismo izdvojili u zaseban oval:** F-005 (promjena lozinke) dio je uređivanja profila UC-003, a F-033 (administratorska statistika) jednostavan je prikaz koji ostaje opisan u dokumentu 2. Povezivanje svih zahtjeva s modulima i budućim testovima vodit ćemo u tablici sljedivosti dokumenta 2, a ne u još jednoj zasebnoj tablici ovdje.

**Što još trebamo potvrditi na M0:**

- Hoćemo li koristiti vlastitu prijavu ili OIDC/OAuth?
- Koju vanjsku uslugu ćemo koristiti za e-poštu i je li ona dovoljna kao vanjska integracija?
- Tko točno smije trajno brisati oglase i koje sve povezane podatke brišemo?
- Koje podatke kandidata smije vidjeti poslodavac?
- Koji su točni dopušteni prijelazi statusa oglasa, prijava i rezervacija?

**Zaključak:** Opisali smo 16 važnih obrazaca uporabe aplikacije CastMeIfYouCan. Oni nam služe kao plan za daljnji razvoj i testiranje, a ažurirat ćemo ih kada potvrdimo otvorene dogovore i povežemo sve dijelove sustava.
