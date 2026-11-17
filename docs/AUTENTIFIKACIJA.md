# Autentifikacija — Google OAuth i serverske sesije

**Provjera dokumentacije:** 17. 11. 2026., kod `bd785d4`. Područje prati [zadatak #12](https://github.com/paolabbradaric/grupa122/issues/12), F-001–F-005 i UC-001/UC-002. [Arhitektura i dijagrami](4-Arhitektura-i-oblikovanje.md), [baza i migracije](BAZA_PODATAKA.md), [instalacija](6-Postavljanje-instalacija-i-konfiguracija.md) i [dokazi ispitivanja](5-Ispitivanje.md) čine povezanu dokumentaciju ovog doprinosa.

## Što je preuzeto i zašto

Polazište je auth modul ranijeg lokalnog NestJS/TypeScript projekta. Preuzet je pristup s Google prijavom, Passportom, stabilnim identitetom, serverskom sesijom i provjerom aktivnog korisnika. Kod je prilagođen postojećem Express/CommonJS backendu. Uvođenje NestJS-a i TypeORM-a samo radi autentifikacije zahtijevalo bi nepotrebnu promjenu ostatka projekta.

| Izvorni dio | Novi dio u `backend/src/auth` | Razlog |
| --- | --- | --- |
| `google.strategy.ts` | `passport.js` | Google/Passport, potvrđen e-mail, OAuth `state` i dodatni PKCE S256. |
| `session.serializer.ts` | `passport.js` | Sesija pamti samo lokalni ID; svaki zahtjev ponovno provjerava aktivan račun u bazi. |
| `auth.service.ts` | `routes.js` | Passport 0.7 već regenerira ID u `logIn`; novu sesiju izričito spremamo prije odgovora. Nije potrebna dvostruka regeneracija. |
| Kontroler i guardovi | `routes.js`, `middleware.js` | Express rute i middleware zamjenjuju NestJS dekoratore. |
| Vlastiti rate limiter | `express-rate-limit` | Gotovo rješenje s podrškom za IPv6 i `Retry-After`. |
| Izvorni `UsersService` | `userModel.js` | Parametrizirani SQL i postojeći `pg` pool, tablice i ograničenja jedinstvenosti. |

Mobilne bearer sesije, Swagger DTO-ovi i domenske uloge izvornog projekta nisu potrebni ovoj web aplikaciji. Google access/refresh tokeni odbacuju se nakon dohvaćanja identiteta; aplikacija ne treba pristup drugim Google podacima.

Ovo prati postojeće zahtjeve F-001–F-005 i `RAZVOJNI_PLAN.md`: aplikacija ne sprema korisničke lozinke. Demonstracijski obrasci za lozinke zamijenjeni su Google prijavom, a sigurnosne postavke profila vode na Google račun.

## Tok prijave

1. `GET /api/auth/google` otvara Google. Passport sprema nasumični `state` i PKCE verifier u serversku sesiju.
2. Callback provjerava `state` prije razmjene autorizacijskog koda za tokene. Profil mora imati potvrđen e-mail i Googleov trajni identifikator `sub`.
3. Identitet se traži kao `users.auth_id = 'google:' + sub`. Podudaranje e-mail adrese ne povezuje dva različita identiteta.
4. Postojeći aktivan korisnik dobiva novu sesiju sa svojom postojećom ulogom iz baze. Obrisani račun ne može se ponovno prijaviti.
5. Novi identitet dobiva privremenu sesiju od **10 minuta**, bez poslovnih ovlasti. Frontend traži dovršavanje registracije.
6. Korisnik unosi ime, prezime, datum rođenja i bira `candidate` ili `employer`. Server provjerava datum i najmanje 18 godina prema datumu u zoni Europe/Zagreb. Dob se računa iz korisnikova unosa; Google ovime ne dokazuje dob.
7. Poslodavac dodatno unosi naziv tvrtke, OIB s ispravnom kontrolnom znamenkom, kontakt e-mail, telefon i sjedište. Kontakt tvrtke odvojen je od Googleova prijavnog e-maila.
8. Jedna SQL transakcija stvara korisnika i njegov `candidate_profiles` ili `organisations` zapis. Konflikt e-maila, identiteta ili OIB-a poništava cijeli upis.
9. Otvara se nova sesija od **8 sati** i rotira CSRF token. Poslodavac nije automatski verificiran. `admin` nije dopušten pri registraciji.

Frontend pri učitavanju poziva `/me`. Navigacija koristi korisnika i ulogu iz tog odgovora; uklonjen je demo izbornik kojim se gost mogao proglasiti administratorom. Sesija i CSRF token ne spremaju se u localStorage. `sessionStorage` pamti samo početni izbor vrste registracije i nema autoritet nad backendom.

## Zaštite i ovlasti

- Cookie `castme.sid` sadrži potpisani ID. Sadržaj sesije je u PostgreSQL tablici `app_private.sessions` i može se ponovno učitati nakon restarta procesa; stvarni restart cijelog sustava nije provjeren u zapisniku od 17. 11.
- Cookie ima `HttpOnly`, `SameSite=Lax`, putanju `/` i u produkciji `Secure`. Produkcijski URL-ovi moraju biti HTTPS.
- `/onboarding` i `/logout` zahtijevaju dopušteni `Origin` i `X-CSRF-Token` dobiven iz `/me`. OAuth callback zasebno štiti `state`.
- Odjava uništava zapis sesije i briše cookie. Stari cookie ne vraća prijavu.
- Auth odgovori imaju `Cache-Control: no-store`; pogreške ne šalju Google tokene, SQL ni tajne pregledniku.
- OAuth početak/callback i registracija ograničeni su na 20 zahtjeva po IP-u u 15 minuta. Brojač je u memoriji procesa; prije više backend instanci potreban je zajednički limiter ili zaštita na reverse proxyju.
- `requireAuth`, `requireRole('employer')` i `protectMutation(config)` iz [middleware.js](../backend/src/auth/middleware.js) koriste se u zaštićenim poslovnim rutama. `requireAuth` vraća 401 gostu; `requireRole` vraća 403 prijavljenom korisniku s pogrešnom ulogom. Vlasništvo i domenska pravila provjerava konkretni poslovni modul.

Aktualni [app.js](../backend/src/app.js) uz javni GET pregled povezuje prijave, poslodavčeve oglase i audicije koje su razvijali drugi članovi. Sesije i Passport učitavaju se prije tih zaštićenih ruta. Auth middleware sam ne određuje čiji je pojedini oglas niti provodi verifikaciju tvrtke.

## Baza

`db/migrations/auth_sessions.sql` dodaje privatnu tablicu sesija, indeks isteka, `organisations.location` i indeks vlasnika organizacije. Koristi postojeći `users.auth_id`; nema paralelne tablice identiteta ni lozinki. `db/schema.sql` ažuriran je za nove instalacije.

RLS je uključen na `users`, `candidate_profiles`, `organisations` i sesijama. Uloge `anon` i `authenticated` nemaju izravan pristup auth tablicama ni privatnoj shemi. Aplikacija koristi Express/Passport sesiju, a ne Supabase Auth JWT, pa se ne uvode politike koje pogrešno uspoređuju `auth.uid()` s lokalnim cjelobrojnim ID-om. Backend koristi postojeću serversku PG vezu kao vlasnik tablica/BYPASSRLS i mora provoditi autorizaciju u API-ju.

Primjena auth migracije na zajedničku bazu zabilježena je u [PR-u #29](https://github.com/paolabbradaric/grupa122/pull/29). Dana 17. 11. migracija nije ponovno izvršavana nad trajnim tablicama; DB test koristio je privremene tablice. Stare račune s drukčijim `auth_id` ne povezujemo automatski prema e-mailu.

Tijekom izvorne implementacije Supabase CLI bio je blokiran Windows Application Controlom. Zato migracija slijedi postojeću mapu SQL datoteka projekta i izvršava se postojećim `pg` pristupom, u transakciji. Nad očekivanom strukturom može se ponovno pokrenuti:

```powershell
cd C:\progi\grupa122\backend
npm run db:migrate:auth
```

Privatna shema ne smije biti dodana među izložene Supabase Data API sheme. Zaštite su provjerene upitima nad PostgreSQL katalozima.

## Konfiguracija i pokretanje

Svako okruženje treba zaseban nasumični `SESSION_SECRET`; tajne ne ulaze u Git. Ključeve drugog projekta ne treba preuzimati bez odgovarajuće konfiguracije ovog OAuth klijenta. Potpune naredbe i varijable su u [poglavlju 6](6-Postavljanje-instalacija-i-konfiguracija.md). Za stvarnu prijavu:

1. U Google Cloud konzoli pripremiti OAuth klijent vrste **Web application** i consent screen. U načinu Testing dodati račune za ispitivanje.
2. U **Authorized redirect URIs** upisati točno `http://localhost:3000/api/auth/google/callback`.
3. U `backend/.env` dodati `GOOGLE_CLIENT_ID` i `GOOGLE_CLIENT_SECRET` tog klijenta. Ostale postavke su u `backend/.env.example`.
4. U zasebnim terminalima pokrenuti:

```powershell
cd C:\progi\grupa122\backend
npm ci
npm start
```

```powershell
cd C:\progi\grupa122\frontend
npm ci
npm run dev
```

Otvoriti `http://localhost:5173`. Vite prosljeđuje `/api` backendu; API pozivi dolaze s iste domene. Koristiti dosljedno `localhost`, bez miješanja s `127.0.0.1`. Port 5173 je fiksan kako se dopušteni origin ne bi neprimjetno promijenio.

Bez Google ključeva početak prijave vraća `503 GOOGLE_NOT_CONFIGURED`; javne rute i dalje rade. Bez dovoljno dugog `SESSION_SECRET` backend se ne pokreće.

U produkciji postaviti `NODE_ENV=production`, HTTPS URL-ove i zaseban nasumični `SESSION_SECRET`. `/api` treba proslijediti backendu na istoj domeni kao frontend. `TRUST_PROXY_HOPS` mora odgovarati stvarnoj pouzdanoj proxy topologiji. Lokalna razvojna tajna ne koristi se u produkciji.

## API ugovor

| Metoda i putanja | Rezultat |
| --- | --- |
| `GET /api/auth/google` | Preusmjeravanje na Google. |
| `GET /api/auth/google/callback` | Provjera OAuth odgovora, sesija i povratak na frontend. Neuspjeh dodaje `authError=oauth_failed` ili `access_denied`. |
| `GET /api/auth/me` | `200 { user, onboardingRequired, identity, csrfToken }`; gost ili istekla prijava dobiva `401`. |
| `POST /api/auth/onboarding` | JSON profil, Origin i CSRF; `201` s korisnikom i novim tokenom. `400` nevaljani podaci, `401` istek, `403` CSRF, `409` konflikt. |
| `POST /api/auth/logout` | Origin i CSRF; `200 { signedOut: true }`. Vrijedi i za odustajanje od registracije. |

Poslodavčev `user.organization` sadrži njegove spremljene podatke; kandidat ima `organization: null`. `identity` se vraća samo tijekom nepotpune registracije. Google identifikator i tokeni ne vraćaju se pregledniku.

### Tijelo dovršavanja registracije

Preglednik šalje JSON, sesijski cookie i `X-CSRF-Token` dobiven iz `/me`; Origin mora biti dopušten. Prijavni e-mail i vanjski identitet čitaju se iz serverske privremene sesije, a ne iz tijela zahtjeva.

| Polje | Pravilo |
| --- | --- |
| `role` | Samo `candidate` ili `employer`; nije dopušteno samostalno dodijeliti admin ulogu. |
| `firstName`, `lastName` | Obavezni, uklanjanje rubnih razmaka, do 100 znakova po polju. |
| `birthDate` | Stvaran kalendarski datum `YYYY-MM-DD`, godina najmanje 1900 i navršenih 18 godina prema Europe/Zagreb. |
| `companyName` | Za poslodavca obavezno, do 200 znakova. |
| `regNum` | Za poslodavca OIB od 11 znamenki s ispravnom kontrolnom znamenkom; to ne dokazuje stvarno postojanje ni verifikaciju tvrtke. |
| `contactEmail` | Obavezan kontakt tvrtke, do 255 znakova uz provjeru formata; odvojen od Google e-maila. |
| `phone` | Obavezan za poslodavca, do 30 znakova uz format koji prihvaća [validator](../backend/src/auth/validation.js). |
| `location` | Obavezno sjedište poslodavca, do 255 znakova. |

`user` vraća `id`, `email`, `firstName`, `lastName`, `birthDate`, `role` i `organization`. Organizacija sadrži `id`, `company_name`, `reg_num`, `contact_email`, `phone` i `location`. Privremeni `identity` vraća samo e-mail, ime i prezime. Datum rođenja u SQL dohvatu pretvara se u tekst radi izbjegavanja pomaka datuma vremenskom zonom.

`AuthError` odgovori imaju `{ code, error }`. Među šiframa su `AUTH_REQUIRED`, `FORBIDDEN`, `INVALID_CSRF`, `INVALID_PROFILE`, `ACCOUNT_CONFLICT`, `ALREADY_REGISTERED`, `GOOGLE_NOT_CONFIGURED` i `AUTH_RATE_LIMITED`. Opći handler može vratiti samo `error`. OAuth callback ne vraća JSON nego preusmjeravanje s generičkom pogreškom; primjerice deaktivacija se ne izlaže kao detaljan SQL ili profilni odgovor.

### Integracija s klijentom

[auth.js](../frontend/src/services/auth.js) šalje zahtjeve s `credentials: 'same-origin'`; [useAuth.js](../frontend/src/services/useAuth.js) pri učitavanju dohvaća `/me`, izlaže `completeProfile` i `logout` te razlikuje gosta od nepotpune i dovršene registracije. `App.jsx` koristi to stanje za prikaz stranica. OAuth pogreška pretvara se u poruku i uklanja iz URL-a.

Naknadno uređivanje profila nije dio auth API-ja. Prikazi [CandidateProfile](../frontend/src/pages/CandidateProfile.jsx) i [EmployerProfile](../frontend/src/pages/EmployerProfile.jsx) još imaju demonstracijsku lokalnu pohranu. Ona nije autoritet za ovlasti niti dokaz trajnog serverskog spremanja izmjena.

## Provjere i granice

```powershell
# backend
npm test
npm run test:db
# frontend
npm run lint
npm run build
```

HTTP testovi koriste stvarni Express, Passport, cookieje i provjere state/PKCE/CSRF. Simuliraju se Googleovi mrežni odgovori i korisnički model. Pokriveni su nova i ponovljena prijava, dob, datumi, OIB, pokušaj admin uloge, odjava i stari cookie, nedopušteni Origin, neaktivan račun, otkazivanje, nedostajući ključevi i rate limit. Stvarni SQL i sesijski store provjeravaju se zasebnim DB testom.

`test:db` koristi stvarnu konfiguriranu PostgreSQL vezu, privremene tablice i vanjsku transakciju koja se na kraju poništava. Provjerava registraciju obje uloge, povrat datuma bez pomaka vremenske zone, rollback konflikata i upis/dohvat/istek/uništavanje PostgreSQL sesije. Ne stvara trajne testne korisnike.

Dana 17. 11. 2026. prošlo je 11 auth testova i 1 auth DB test. [Zapisnik](verification/2026-11-17/README.md) čuva reviziju, okruženje i ispise. Stvarna Google prijava nije izvedena u toj provjeri; raniji PR navodi da ključeve tek treba konfigurirati. Trenutačno stanje vanjske OAuth konzole nije provjereno. Ručni scenariji zapisani su u [Ispitivanju](5-Ispitivanje.md).

Ranija bilješka implementacije navodi Chrome provjeru početne stranice, prijave obiju uloga i obrasca registracije uz simulirani `/me`. To nije ponovno izvođenje niti dokaz stvarne Google integracije od 17. 11.

Registracijski podaci spremaju se u bazu. Profili i portfolio imaju preostali demonstracijski dio; oglasi i audicije u aktualnom main već imaju naknadno dodane poslovne API-je drugih članova. Lokalni demo profili odvojeni su po ID-u korisnika.

## Status zadatka #12 i potreban završetak

Stariji zadatak još spominje vlastite lozinke i Argon2id. Noviji F-001–F-005, NF-02 i razvojni plan određuju OAuth/OIDC bez lokalnih lozinki. Promjena lozinke pripada Google računu, a F-005 označava siguran ponovni ulazak. Dokumentacija ne proglašava cijeli zadatak #12 završenim.

| Područje zadatka | Dokaz i stanje |
| --- | --- |
| Model baze i migracije | [Baza](BAZA_PODATAKA.md), PR-ovi #23, #25, #29 i #31; implementirano. |
| Registracija i prijava/odjava | API ugovor iznad, 11 auth i 1 DB test; implementirano, stvarna Google provjera još otvorena. |
| Sesije i middleware uloga | Privatni PostgreSQL store, CSRF/Origin i limiter; implementirano uz granice navedene iznad. |
| API dogovor za frontend | auth.js/useAuth i povezani obrasci; ugovor i polja dokumentirani. |
| Dohvat/izmjena profila i portfolio | /me pokriva korisnika i organizaciju; trajne izmjene profila i datoteke nisu dovršene ovim modulom. |
| Demo admin | Registracija admin uloge zabranjena; zaseban ograničeni demo račun nije potvrđen ovim pregledom. |
| Produkcija i puni tok | HTTPS konfiguracija predviđena; javna objava, stvarni Google tok i oporavak sustava nisu potvrđeni ovim zapisnikom. |

Dokumentacijski zahtjevi za ovaj doprinos pokriveni su u poglavljima 4–6, ovome API ugovoru, Bazi podataka, [sljedivosti zahtjeva](2-Analiza-zahtjeva.md#26-sljedivost-zahtjeva) i [evidenciji doprinosa](A-Pregled-aktivnosti-grupe.md). Nisu izmišljeni radni sati, sastanci ni rezultati neprovedenih provjera.

## Referentna dokumentacija

- [Express: express-session](https://expressjs.com/en/resources/middleware/session/) — cookie postavke i životni ciklus sesija.
- [Passport: Sessions](https://www.passportjs.org/concepts/authentication/sessions/) — serijalizacija i ponovno učitavanje korisnika.
- [Google: OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect) — autorizacijski tok, `state` i `sub`.
- [connect-pg-simple](https://github.com/voxpelli/node-connect-pg-simple) — PostgreSQL store.
- [Supabase: Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security) — zaštita pristupa tablicama.
