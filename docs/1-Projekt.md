# 1. Opseg projekta — CastMeIfYouCan

**Projekt:** CastMeIfYouCan  
**Verzija:** Priprema za M0 (4. tjedan), listopad 2026.

CastMeIfYouCan je web-aplikacija koja povezuje osobe zainteresirane za glumu i druge uloge u produkcijama s poslodavcima koji traže kandidate. Ovdje opisujemo problem koji želimo riješiti, kome je aplikacija namijenjena i što planiramo napraviti. Funkcionalnosti navedene u ovom dokumentu dio su našeg plana; nisu sve još implementirane.

## 1.1 Problem i cilj projekta

Kada netko traži glumačku ulogu, statistiranje ili sličan angažman, informacije o castinzima mogu biti objavljene na različitim mjestima, primjerice na društvenim mrežama ili u pojedinačnim objavama produkcijskih timova. Kandidatu tada može biti teško pronaći oglase koji mu odgovaraju i pratiti na koje se već prijavio. S druge strane, poslodavac treba način da na jednom mjestu objavi potrebnu ulogu, pregleda prijavljene kandidate i dogovori audicije.

**Cilj našeg projekta** je napraviti web-aplikaciju koja će ta dva procesa povezati. Kandidati će moći pregledavati casting oglase, pretraživati ih, uređivati svoje profile i slati prijave. Poslodavci će moći objavljivati oglase, pregledavati prijave, birati kandidate i organizirati termine audicija.

Želimo da kandidat na jednom mjestu može pronaći priliku koja ga zanima i pratiti status prijave, a da poslodavac lakše organizira izbor kandidata. Aplikacija neće sama odlučivati tko je najbolji za ulogu — konačnu odluku donosi poslodavac.

**Primjer korištenja:** Kandidat pronađe oglas za ulogu u kratkometražnom filmu, pročita uvjete i prijavi se. Poslodavac nakon pregleda prijava kandidata može pozvati na audiciju, a kandidat zatim odabire slobodan termin. Ovo je planirani način rada aplikacije, a ne tvrdnja da je cijeli proces već gotov.

## 1.2 Ciljani korisnici i dionici

Našu aplikaciju koristit će četiri glavne skupine korisnika.

| Skupina korisnika ili dionika | Potreba ili interes relevantan za ovaj projekt |
| --- | --- |
| **Posjetitelj (neprijavljeni korisnik)** | Želi pregledati javne casting oglase i saznati više o ulozi prije registracije. |
| **Kandidat** | Želi napraviti svoj profil i portfolio, pronaći odgovarajuće oglase, prijaviti se i pratiti status prijave. Ako dobije poziv na audiciju, želi odabrati slobodan termin. |
| **Poslodavac / organizacija** | Želi objaviti casting oglas, pregledati pristigle prijave, odabrati kandidate i organizirati audicije. Za objavu oglasa prvo mora imati verificiran račun. |
| **Administrator** | Provjerava zahtjeve za verifikaciju poslodavaca, obrađuje prijavljene neprimjerene oglase te po potrebi trajno uklanja oglase i povezane podatke. Za demonstraciju planiramo jedan zajednički administratorski račun. |
| **Razvojni tim i nastavno osoblje (dionici)** | Naš tim razvija i održava aplikaciju, a asistent i nastavnik prate napredak projekta i daju povratne informacije. Ne koriste nužno aplikaciju kao kandidat ili poslodavac. |

Kandidati prema našem planu moraju imati **najmanje 18 godina**. Svaki tip prijavljenog korisnika ima svoje mogućnosti, pa kandidat ne može uređivati tuđi oglas, a poslodavac ne može pregledavati prijave na oglase drugih poslodavaca. Osobni podaci kandidata i prijave trebaju biti dostupni samo ovlaštenim korisnicima.

## 1.3 Granice projekta

U ovom dijelu navodimo što želimo imati u aplikaciji, što zasad ne planiramo i o kojim drugim sustavima ovisimo.

### Uključeno u projekt

- **Korisnički računi i profili:** registracija i prijava kandidata i poslodavaca, uređivanje profila, osnovni podaci o iskustvu i vještinama kandidata te portfolio s najviše pet fotografija.
- **Verifikacija poslodavaca:** poslodavac može poslati zahtjev za verifikaciju, a administrator ga može odobriti ili odbiti uz razlog. Samo verificirani poslodavac može objaviti oglas.
- **Casting oglasi:** javni pregled, detalji i pretraživanje oglasa te stvaranje, spremanje nacrta i uređivanje vlastitih oglasa. Prema dogovoru, **jedan oglas predstavlja jedan projekt i jednu ulogu**.
- **Prijave kandidata:** kandidat se može prijaviti dok je oglas otvoren, pogledati svoje prijave i njihove statuse te povući prijavu kada je to dopušteno. Na isti oglas ne može poslati više prijava.
- **Odabir kandidata:** poslodavac pregledava prijave i mijenja njihove statuse (npr. u pregledu, uži izbor, poziv na audiciju, odabran ili odbijen). Oglas se može označiti popunjenim kad se odabere traženi broj kandidata.
- **Audicije i obavijesti:** poslodavac može definirati termine audicije s kapacitetom, a pozvani kandidat odabrati slobodan termin. Planirane su i obavijesti o važnim promjenama prijave ili termina.
- **Administracija:** pregled verifikacija, obrada prijavljenog sadržaja i trajno brisanje oglasa s povezanim podacima uz odgovarajuće ovlasti.

Kod objave oglasa zasebno se upisuju **broj traženih kandidata** i **maksimalan broj prijava**. Za maksimalan broj prijava predviđena je početna vrijednost od **1000**, koju ćemo uskladiti s pravilima sustava.

### Izvan opsega ili odgođeno

- **Automatski odabir glumaca:** aplikacija može pomoći u organizaciji prijava, ali sama ne ocjenjuje kandidate i ne donosi konačnu odluku umjesto poslodavca.
- **Ugovaranje i isplata honorara:** plaćanja i sklapanje ugovora nisu planirani dio aplikacije.
- **Održavanje audicije putem videopoziva:** aplikacija organizira termine audicije, ali ne razvijamo vlastiti sustav za videopozive.
- **Povezivanje s Google Calendarom:** to je moguća dodatna funkcija ako ostane vremena; nije dio osnovnog planiranog rješenja.

Ove granice postavili smo da se prvo možemo usredotočiti na objavu oglasa, prijave i odabir kandidata, što je glavni dio projekta.

### Vanjske ovisnosti

- **PostgreSQL baza podataka:** koristimo je za spremanje korisnika, oglasa, prijava, audicija i drugih podataka. Postojeću bazu čuvamo i po potrebi je mijenjamo migracijama.
- **Usluga za javno postavljanje aplikacije:** za kasniju demonstraciju aplikacija mora biti dostupna putem interneta; konkretan pružatelj još nije naveden u ovom dokumentu.
- **Vanjska usluga za slanje e-pošte:** planiramo je za važnije obavijesti o prijavama i audicijama, ali još trebamo dogovoriti koju ćemo uslugu koristiti i hoće li ona zadovoljiti zahtjev kolegija za vanjskom integracijom.
- **Prijava putem vanjskog pružatelja identiteta:** naš prvotni dogovor bio je vlastita prijava korisničkim imenom i lozinkom. U planu kolegija za 6. tjedan navodi se OpenID Connect / OAuth 2.0, pa taj dio moramo razjasniti s asistentom prije konačne odluke.

## 1.4 Postojeći pristupi i opravdanost projekta

Jedan mogući način traženja castinga danas je pregledavanje različitih objava na društvenim mrežama i slanje zasebnih poruka ili prijava za svaki oglas. U takvom načinu rada kandidat treba sam pratiti gdje se prijavio i je li dobio odgovor, a poslodavac odvojeno vodi prijave i termine. Naš projekt želi objediniti te korake u jednoj aplikaciji: od pronalaska oglasa i prijave do pregleda statusa i rezervacije audicije.

Ovo je primjer problema koji želimo riješiti, a ne rezultat provedenog istraživanja tržišta ili usporedba s konkretnom postojećom platformom. Ne tvrdimo da takvo rješenje već ne postoji — CastMeIfYouCan je naš projekt u kojem želimo osmisliti i napraviti povezani proces prijava na castinge.

---

**Napomena za M0:** Opis odgovara trenutačnom dogovoru tima i dokumentu **2. Analiza zahtjeva**. Prije konačne potvrde s asistentom trebamo razjasniti način prijave (vlastita prijava ili OIDC/OAuth), obveznu vanjsku integraciju i detalje ovlasti za brisanje i pristup podacima. Ovaj dokument opisuje plan projekta, a ne završene funkcionalnosti.
