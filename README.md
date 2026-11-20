# CastMeIfYouCan

Web-aplikacija koja povezuje kandidate zainteresirane za casting uloge
s poslodavcima koji traže kandidate za svoje produkcije.

**Projekt na kolegiju:** Aplikaciju razvija grupa 12.2 u sklopu kolegija
Programsko inženjerstvo na Fakultetu elektrotehnike i računarstva
Sveučilišta u Zagrebu (FER).

## Opis aplikacije

CastMeIfYouCan objedinjuje pregled casting oglasa, prijave kandidata
i organizaciju audicija. Kandidati mogu pronaći odgovarajuće oglase
i pratiti svoje prijave, a poslodavci objavljivati oglase, pregledavati
kandidate i organizirati termine audicija. Administrator provjerava
poslodavce i obrađuje prijavljeni sadržaj.

**Ključne funkcionalnosti**

- Prijava Google računom i uređivanje korisničkih profila.
- Pregled i filtriranje oglasa, objava oglasa verificiranih poslodavaca
  i prijavljivanje kandidata.
- Upravljanje prijavama, terminima audicija i obavijestima u aplikaciji.

Slanje obavijesti e-poštom planirano je za nastavak razvoja.

Detaljna projektna dokumentacija nalazi se u [docs/](docs/Home.md).

<a id="deployment"></a>
## Postavljanje (engl. deployment)

**Javno dostupna aplikacija:** https://grupa122.vercel.app/

**Isprobajte:** Pregledajte oglase i njihove detalje bez prijave.
Za slanje prijave prijavite se Google računom i dovršite registraciju
kandidata. Poslodavac prije objave oglasa mora dobiti administratorsko
odobrenje zahtjeva za verifikaciju.

**Demonstracija:** Za demonstraciju administratorskih funkcija
dostupan je poseban Google račun. Pristupni podaci dostavljaju se
asistentima putem privatnog Microsoft Teams kanala TG12.2.

**Ograničenja:** Obavijesti su dostupne unutar aplikacije.
Slanje obavijesti e-poštom još nije implementirano.

Detalji konfiguracije opisani su u
[vodiču za postavljanje](docs/6-Postavljanje-instalacija-i-konfiguracija.md)
i [uputama za Vercel](docs/vercel-deployment.md).

<a id="quick-start"></a>
## Brzi početak / instalacija

**Preduvjeti:** Git, Node.js i npm, dostupna PostgreSQL baza te
konfiguriran Google OAuth klijent. U dokumentaciji je zabilježeno
okruženje s Node.js 24 i npm 11.

Preuzimanje projekta i instalacija paketa:

```bash
git clone https://github.com/paolabbradaric/grupa122.git
cd grupa122/backend
npm ci
```

Za prvo postavljanje kopirajte `backend/.env.example` u `backend/.env`
i dopunite potrebne vrijednosti. Konfiguracija uključuje vezu s bazom,
Google OAuth postavke, tajnu sesije te postavke potrebnih funkcionalnosti.
Pristupne podatke za zajedničke usluge zatražite od nadležnog člana tima.

Baza mora imati pripremljenu shemu i potrebne migracije prema
[uputama za instalaciju](docs/6-Postavljanje-instalacija-i-konfiguracija.md).

Pokretanje backenda iz direktorija `backend`:

```bash
npm start
```

U drugom terminalu, iz korijena repozitorija:

```bash
cd frontend
npm ci
npm run dev
```

**Adresa:** http://localhost:5173  
**Backend:** http://localhost:3000

**Osnovna provjera:** Otvorite početnu stranicu i provjerite prikaz oglasa
te prijavu Google računom.

Na Windowsu, ako PowerShell blokira `npm.ps1`, koristite `npm.cmd`
umjesto `npm`.

## Tehnologije

| Tehnologija ili alat | Uloga u ovom projektu | Razlog uporabe ili važno ograničenje |
| --- | --- | --- |
| React i Vite | Izrada i pokretanje korisničkog sučelja | Omogućuju izradu povezanih prikaza oglasa, profila, prijava i audicija. |
| Node.js i Express | Poslužiteljski API i poslovna logika | Backend provjerava korisničke ovlasti i obrađuje zahtjeve sučelja. |
| PostgreSQL na Supabaseu | Pohrana korisnika, oglasa, prijava i audicija | Povezani podaci i njihova ograničenja održavaju se u relacijskoj bazi. |
| Supabase Storage | Pohrana profilnih fotografija | Pristup datotekama obrađuje se kroz backend. |
| Google OAuth i Passport | Prijava i potvrda identiteta korisnika | Korisnik treba Google račun; aplikacija ne pohranjuje Google lozinke. |
| Vercel | Javno postavljanje frontenda i backenda | Za rad su potrebne odgovarajuće varijable okruženja i Google callback adresa. |

<a id="team-members"></a>
## Članovi tima

| Član | FER e-mail | Glavna uloga ili doprinos |
| --- | --- | --- |
| Paola Bradarić | paola.bradaric@fer.unizg.hr | Vođenje tima, verifikacija poslodavaca, moderacija i administratorske funkcije |
| Rea Gavranović | rea.gavranovic@fer.unizg.hr | Sučelja prijave, registracije, profila, kandidatovih prijava i obavijesti |
| Mario Halužan | mario.haluzan@fer.unizg.hr | Baza podataka, autentifikacija, sesije i ovlasti |
| Nina Jonjić | nina.jonjic@fer.unizg.hr | Javni prikaz oglasa, detalji i filtriranje |
| Tin Škarpa | tin.skarpa@fer.unizg.hr | Backend oglasa i prijava, statusi, rezervacije i obavijesti |
| Lucija Šprljan | lucija.sprljan@fer.unizg.hr | Backend termina audicija i automatizirani testovi |
| Tara Fošnar | tara.fosnar@fer.unizg.hr | Poslodavčevo sučelje i kandidatov odabir termina audicije |

## Doprinos projektu

Zadaci i nedostaci evidentiraju se kroz GitHub Issues, a promjene koda
predaju se kroz pull requestove i spajaju u glavnu granu.

Sastanci, plan rada i doprinosi članova navedeni su u
[pregledu aktivnosti grupe](docs/A-Pregled-aktivnosti-grupe.md).

<a id="license"></a>
**Status licence:** Izvorni kod aplikacije koji je izradio naš tim
licenciran je pod licencom [ISC](LICENSE-CODE).

Dokumentacijski predložak kolegija sadrži otvorene obrazovne sadržaje
(engl. Open Educational Resources, OER) i licenciran je licencom
Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International
(CC BY-NC-SA 4.0), prema datoteci [LICENSE](LICENSE).
Ta licenca ne određuje automatski licencu studentske aplikacije;
za izvorni kod našeg tima odabrana je licenca ISC.

Kod trećih strana, skupovi podataka, slike, ikone i drugi sadržaji
zadržavaju vlastite licence i uvjete uporabe.

<a id="ai-usage"></a>
## Uporaba umjetne inteligencije

ChatGPT i Codex korišteni su kao pomoć pri razumijevanju i razvoju koda
te pripremi i uređivanju dokumentacije. Provedene provjere i njihova
ograničenja opisani su u projektnoj dokumentaciji.

Detaljniji zapis za dio dokumentacije nalazi se u
[izjavi o uporabi umjetne inteligencije](docs/Home.md#izjava-o-uporabi-umjetne-inteligencije).

<a id="code-of-conduct-and-support"></a>
## Kodeks ponašanja i podrška

Od članova tima očekuje se pridržavanje Kodeksa ponašanja studenata
FER-a, dogovorenih pravila timskog rada i Etičkog kodeksa IEEE-a.
Dodatna pravila nalaze se u [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

Za pitanja o projektu i demonstracijskom pristupu obratite se
voditeljici tima na paola.bradaric@fer.unizg.hr.

---

Struktura dokumentacije prilagođena je predlošku kolegija Programsko
inženjerstvo FER-a autora Vlade Sruka, licenciranom pod
CC BY-NC-SA 4.0. Aplikaciju je izradio navedeni studentski tim.