# Autentifikacija — Google OAuth i serverske sesije

## Što je preuzeto i zašto

Polazište je `C:\VibeCodedBs\apps\api\src\auth`. Preuzet je pristup s Google prijavom, Passportom, stabilnim identitetom, serverskom sesijom i provjerom aktivnog korisnika. Kod je prilagođen postojećem Express/CommonJS backendu. Uvođenje NestJS-a i TypeORM-a samo radi autentifikacije zahtijevalo bi nepotrebnu promjenu ostatka projekta.

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

- Cookie `castme.sid` sadrži potpisani ID. Sadržaj sesije je u PostgreSQL tablici `app_private.sessions`, pa prijava preživljava restart backenda.
- Cookie ima `HttpOnly`, `SameSite=Lax`, putanju `/` i u produkciji `Secure`. Produkcijski URL-ovi moraju biti HTTPS.
- `/onboarding` i `/logout` zahtijevaju dopušteni `Origin` i `X-CSRF-Token` dobiven iz `/me`. OAuth callback zasebno štiti `state`.
- Odjava uništava zapis sesije i briše cookie. Stari cookie ne vraća prijavu.
- Auth odgovori imaju `Cache-Control: no-store`; pogreške ne šalju Google tokene, SQL ni tajne pregledniku.
- OAuth početak/callback i registracija ograničeni su na 20 zahtjeva po IP-u u 15 minuta. Brojač je u memoriji procesa; prije više backend instanci potreban je zajednički limiter ili zaštita na reverse proxyju.
- `requireAuth`, `requireRole('employer')` i `protectMutation(config)` iz `middleware.js` spremni su za buduće zaštićene rute. Poslovne rute trebaju provjeriti i vlasništvo zapisa. Skrivanje gumba nije serverska autorizacija.

Postojeće casting rute su javni GET zahtjevi. Poslovni API-ji za uređivanje oglasa, prijave i verifikaciju nisu dio ove implementacije.

## Baza

`db/migrations/auth_sessions.sql` dodaje privatnu tablicu sesija, indeks isteka, `organisations.location` i indeks vlasnika organizacije. Koristi postojeći `users.auth_id`; nema paralelne tablice identiteta ni lozinki. `db/schema.sql` ažuriran je za nove instalacije.

RLS je uključen na `users`, `candidate_profiles`, `organisations` i sesijama. Uloge `anon` i `authenticated` nemaju izravan pristup auth tablicama ni privatnoj shemi. Aplikacija koristi Express/Passport sesiju, a ne Supabase Auth JWT, pa se ne uvode politike koje pogrešno uspoređuju `auth.uid()` s lokalnim cjelobrojnim ID-om. Backend koristi postojeću serversku PG vezu kao vlasnik tablica/BYPASSRLS i mora provoditi autorizaciju u API-ju.

Konfigurirana baza pregledana je prije promjene i migracija je primijenjena. Podaci nisu brisani ni povezivani prema e-mailu. Ako postoje stari testni računi s drukčijim `auth_id`, njihovo povezivanje s Google identitetom treba izričito provjeriti.

Instalirani Supabase CLI blokira Windows Application Control. Migracija zato slijedi postojeću mapu SQL migracija projekta i izvršena je postojećim `pg` pristupom, u transakciji. Može se ponovno pokrenuti:

```powershell
cd C:\progi\grupa122\backend
npm run db:migrate:auth
```

Privatna shema ne smije biti dodana među izložene Supabase Data API sheme. Zaštite su provjerene upitima nad PostgreSQL katalozima.

## Konfiguracija i pokretanje

U `backend/.env` generiran je zaseban lokalni `SESSION_SECRET`; nije ispisan ni dodan u Git. Google ključevi iz drugog projekta nisu kopirani. Za stvarnu prijavu:

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

## Provjere i granice

```powershell
# backend
npm test
npm run test:db
# frontend
npm run lint
npm run build
```

HTTP testovi koriste stvarni Express, Passport, cookieje i provjere state/PKCE/CSRF. Simulira se samo Googleov mrežni odgovor. Pokriveni su nova i ponovljena prijava, dob, datumi, OIB, pokušaj dodjele admin uloge, odjava i stari cookie, nedopušteni Origin, neaktivan račun, otkazivanje, nedostajući ključevi i rate limit.

`test:db` koristi stvarnu konfiguriranu PostgreSQL vezu, privremene tablice i vanjsku transakciju koja se na kraju poništava. Provjerava registraciju obje uloge, povrat datuma bez pomaka vremenske zone, rollback konflikata i upis/dohvat/istek/uništavanje PostgreSQL sesije. Ne stvara trajne testne korisnike.

Stvarna Google prijava još nije potvrđena jer nedostaju ključevi. Nakon njihova unosa ručno provjeriti prvi i ponovljeni ulazak, osvježavanje i odjavu.

U Chromeu su dodatno provjereni početna stranica gosta, prijava kandidata i poslodavca te prikaz dovršavanja registracije i dodatnih polja poslodavca. Za prikaz nepotpune registracije simuliran je odgovor `/me`, bez stvaranja korisnika.

Registracijski podaci sada se spremaju u bazu. Postojeće naknadno uređivanje profila, portfolio, obavijesti i oglasi i dalje sadrže demonstracijske funkcije; ova promjena ne implementira njihove poslovne API-je. Lokalni demo podaci profila odvojeni su po ID-u korisnika.

## Referentna dokumentacija

- [Express: express-session](https://expressjs.com/en/resources/middleware/session/) — cookie postavke i životni ciklus sesija.
- [Passport: Sessions](https://www.passportjs.org/concepts/authentication/sessions/) — serijalizacija i ponovno učitavanje korisnika.
- [Google: OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect) — autorizacijski tok, `state` i `sub`.
- [connect-pg-simple](https://github.com/voxpelli/node-connect-pg-simple) — PostgreSQL store.
- [Supabase: Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security) — zaštita pristupa tablicama.
