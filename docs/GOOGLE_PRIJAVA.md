# Google prijava — postavljanje i provjera

Ova dopuna prati [zadatak #12](https://github.com/paolabbradaric/grupa122/issues/12) i postojeću [autentifikaciju](AUTENTIFIKACIJA.md). Opisuje aktualnu jednokratnu Google konfiguraciju i granice provjere.

## Administratorska prijava

Pet ovlaštenih osoba koristi isti postojeći Google tok, svaka sa svojim računom. Backend uspoređuje potvrđenu Google adresu s privatnim `ADMIN_EMAILS`, kreira ili promovira samo isti Google subject i otvara `/admin`. Nema zasebnih admin lozinki ni javnog izbora admin uloge. Mariov postojeći račun ostaje demo administrator, uz sačuvan identitet i kandidatski profil; model i dalje ima jednu aktivnu ulogu.

Prije prve nove admin prijave primijeniti `npm run db:migrate:admin`, privatno postaviti svih pet dogovorenih adresa i ponovno pokrenuti backend. Adrese se ne objavljuju u dokumentaciji, primjeru konfiguracije ili frontend bundleu. Prazan popis zatvara admin pristup; pogrešna sintaksa zaustavlja pokretanje. Stare sesije bez dokaza potvrđenog identiteta zahtijevaju novu Google prijavu. Postupak i granice stvarne provjere opisani su u [admin pristupu](ADMIN_PRISTUP.md).

## Konfiguracija i pokretanje

### Jednokratna postavka održavatelja

Krajnji korisnik samo odabire **Nastavi s Googleom**, odabere ili potvrdi račun i vraća se u aplikaciju. Google može zatražiti lozinku, dodatnu provjeru ili privolu. Novi korisnik jednom dovršava profil; postojeći zadržava svoj račun i ulogu. Korisnik ne otvara Google Cloud projekt i ne unosi OAuth ključeve.

OAuth klijent predstavlja **aplikaciju**, a ne pojedinačnog korisnika. Postojeći Passport tok zahtijeva client ID i tajnu koju čuva backend. Drugi Google tokovi mogu koristiti samo client ID i serversku provjeru ID tokena, ali promjena gumba, popup ili One Tap ne uklanjaju potrebu za registracijom aplikacije.

Održavatelj treba:

1. Član tima zadužen za autentifikaciju vodi Google konfiguraciju aplikacije. Prvo treba pronaći projekt u [Google Cloud konzoli](https://console.cloud.google.com/auth/overview). Ako postoji, koristiti njegov prikladan web-klijent; ne preuzimati ključeve nepovezane aplikacije. Ako projekt još ne postoji, pripremiti zaseban projekt za CastMeIfYouCan na dogovorenom Google računu. Pristup projektu može imati više članova tima; nije potrebna zasebna osoba kao poslovni vlasnik aplikacije.
2. U **Google Auth Platform → Branding** provjeriti **App name** (`CastMeIfYouCan`), **User support email** i kontakt održavatelja. Kontakt treba biti stvarna, nadzirana adresa tima. Provjeriti podatke i status u **Verification Center** prema stvarnim zahtjevima projekta.
3. U **Audience** provjeriti **User type** (`Internal` / `External`) i **Publishing status** (`Testing` / `In production`). `Internal` ograničava pristup na organizaciju projekta. Za širu publiku provjeriti odgovarajuću postavku `External` i pravila organizacijskih Google računa.
4. U **Data Access** zadržati samo identitet: `openid`, `email`, `profile` (Google ih može prikazati i kao `userinfo.email` / `userinfo.profile`). Prema [Googleovim pravilima publike](https://support.google.com/cloud/answer/15549945?hl=en), za isključivo osnovni identitet vrijedi iznimka od uobičajenog Testing popisa testnih korisnika i sedmodnevnog isteka autorizacije. Dodavanje drugih scopes mijenja uvjete. Organizacijske zabrane i zaštite računa i dalje mogu blokirati pristup. Samo osnovni scopes nisu razlog da se bez provjere zahtijeva objava ili dodatna verifikacija.
5. U **Clients** odabrati OAuth klijent vrste **Web application**. Njegov **Authorized redirect URIs** mora sadržavati točno `http://localhost:3000/api/auth/google/callback`, bez dodatne kose crte. To mora odgovarati `GOOGLE_CALLBACK_URL`; `localhost` i `127.0.0.1` nisu zamjenjivi. Ovaj serverski tok ne koristi GIS skriptu u pregledniku pa se ne konfigurira kao frontend ID-token tok.
6. Privatno postaviti `GOOGLE_CLIENT_ID` i `GOOGLE_CLIENT_SECRET` tog klijenta u `backend/.env` ili postojeće spremište tajni backenda. Ne unositi secret u razgovor, issue, PR, frontend ni `VITE_*`. Provjeriti `git check-ignore backend/.env`. Nakon unosa restartati backend.

U uskom prozoru detalja klijenta Google skriva **Client secrets** u bočnom panelu: otvoriti ikonu **ⓘ / Information and summary** gore desno pa **Additional information** pomaknuti dolje. Google novi secret prikazuje samo pri izradi; odmah spremiti **Download JSON** izvan repozitorija. Ako secret nije spremljen, za isti klijent koristiti **Add client secret** i novi secret odmah spremiti. Nakon provjere nove konfiguracije onemogućiti stari, nekorišteni secret. Vidjeti [Googleove upute za klijente i rotaciju](https://support.google.com/cloud/answer/15549257?hl=en).

U lokalnom `backend/.env` već postoji zaseban `SESSION_SECRET`; ne ispisivati ga i ne dodavati u Git. Ostale postavke su u `backend/.env.example`.

### Lokalno pokretanje

U zasebnim terminalima pokrenuti:

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

Bez Google ključeva OAuth navigacija preglednika vraća korisnika na frontend s `authError=google_not_configured` i porukom da prijava trenutačno nije dostupna. JSON API zahtjev i dalje dobiva `503 GOOGLE_NOT_CONFIGURED`. Pri ograničenju pokušaja preglednik dobiva `authError=rate_limited`; JSON API i onboarding zadržavaju `429 AUTH_RATE_LIMITED` i `Retry-After`. Nema otvaranja prijavljene sesije pri tim neuspjesima. Javne rute i dalje rade. Bez dovoljno dugog `SESSION_SECRET` backend se ne pokreće.

### Produkcija

Stvarna produkcijska domena i platforma nisu potvrđene. Primjer Rendera u `6-Postavljanje-instalacija-i-konfiguracija.md` nije potvrda postavljanja ove aplikacije. Prije postavljanja održavatelj treba zabilježiti stvarnu domenu i provjeriti:

| Postavka | Uvjet |
| --- | --- |
| `NODE_ENV` | `production`. |
| `FRONTEND_URL` | Stvarna javna HTTPS adresa aplikacije. |
| `GOOGLE_CALLBACK_URL` | Stvarna javna HTTPS adresa s putanjom `/api/auth/google/callback`; potpuno isti URI dodati web-klijentu u Google konzoli. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Klijent predviđen za to okruženje; tajna samo na backendu. |
| `SESSION_SECRET` | Zasebna nasumična produkcijska tajna od najmanje 32 znaka. |
| Reverse proxy | `/api` na istoj domeni kao frontend, uz prosljeđivanje cookieja i ispravan HTTPS protokol. Vite proxy vrijedi samo u razvoju. |
| `TRUST_PROXY_HOPS` | Stvarni broj pouzdanih proxyja; ne postavljati proizvoljno. |
| Sesije i baza | Dostupna postojeća PostgreSQL baza i `app_private.sessions`; provjeriti `Secure`, `HttpOnly`, `SameSite=Lax` cookie. |

Nije potrebno mijenjati bazu niti uvoditi drugi auth sustav radi unosa OAuth ključeva. U ovom koraku aplikacija nije objavljena na novu platformu.

## Povratak u aplikaciju pri grešci

HTML navigacija na `GET /api/auth/google` i `/api/auth/google/callback` pri nedostajućim ključevima vraća frontend s `authError=google_not_configured`, a pri ograničenju pokušaja s `authError=rate_limited`. Frontend prikazuje razumljivu hrvatsku poruku i uklanja parametar iz URL-a. Odredište dolazi iz serverskog `FRONTEND_URL`.

JSON API pozivi zadržavaju `503 GOOGLE_NOT_CONFIGURED` i `429 AUTH_RATE_LIMITED`; onboarding uvijek zadržava JSON odgovor. `Retry-After` ostaje dostupan pri rate limitu. Otkazivanje i neuspješni OAuth odgovor i dalje koriste `access_denied` i `oauth_failed`.

### Stanje provjere 17. 11. 2026.

Osnovna implementacija već je spojena u PR-u #29. Na računu koji je korisnik odabrao stvoren je zaseban Google Cloud projekt **CastMeIfYouCan** (`castmeifyoucan`), spremljeni su identitet aplikacije, publika **External** i status **Testing** te izrađen web-klijent **CastMeIfYouCan Local Web** s callbackom `http://localhost:3000/api/auth/google/callback`. U **Data Access** spremljeni su samo `openid`, `userinfo.email` i `userinfo.profile`; osjetljivi i ograničeni scopes nisu dodani. Ključevi druge aplikacije nisu korišteni.

Izvorni secret nije uspješno spremljen, pa je za isti klijent izrađen zamjenski secret. Njegov JSON je preuzet izvan repozitorija i provjeren prema točnom client ID-ju. Oba ključa unesena su samo u ignorirane privatne `backend/.env` datoteke izvornog checkouta `C:\progi\grupa122` i radnog worktreeja. Postojeći `SESSION_SECRET` nije mijenjan. Backend je restartan iz worktreeja `C:\progi\worktrees\grupa122-latest-20261117`; runtime strategija je registrirana, a stvarni `/api/auth/google` vraća Googleov redirect s odgovarajućim klijentom, callbackom, osnovnim scopes, stateom, PKCE S256 i sesijskim cookiejem. Produkcijska konfiguracija nije provjerena.

Nakon uspješne nove i ponovljene prijave korisnik je u Google konzoli onemogućio izvorni, nekorišteni secret i potvrdio status **Disabled**. Aktivna privatna konfiguracija koristi zamjenski secret, različit od izvornoga. Provjera svih praćenih datoteka obaju checkouta nije pronašla stvarni client secret.

Automatski auth testovi provjeravaju i točan client ID, callback, scopes te PKCE S256, ponovljenu prijavu istog računa, očuvanje uloge poslodavca, povratak preglednika pri nedostajućim ključevima i rate limitu te očuvanje JSON API ugovora. Googleov mrežni odgovor i korisnički model u HTTP testovima su simulirani; stvarni SQL i PostgreSQL sesije provjerava zaseban DB test. To nije stvarna Google prijava.

Provedene provjere ove dopune:

- `node --test test/auth.test.js`: 14/14 prolazi. Prije ispravka dva nova regresijska testa padaju zbog sirovih `503` / `429` odgovora pregledniku.
- `npm test` u backendu: 142 prolazi, 8 namjenski isključenih baznih testova, bez pada.
- `npm run test:db`: 1/1 prolazi na konfiguriranoj bazi, u privremenim tablicama i transakciji koja se poništava. Prije izvođenja potvrđeno je da ID stupci koriste `IDENTITY`; privremene kopije dobivaju vlastite sekvence.
- Frontend `npm run lint` i `npm run build`: prolaze.
- Stvarni Google tok: korisnik je u Chromeu odabrao račun i dovršio prvi kandidatski profil. SQL provjera pokazala je jedan lokalni račun s Google identitetom, jedan kandidatski profil i jednu aktivnu sesiju. Nakon osvježavanja navigacija ostaje prijavljena. Stvarna odjava uklonila je aktivnu sesiju iz PostgreSQL-a. Ponovna stvarna Google prijava vratila je isti lokalni ID, istu kandidatsku ulogu i postojeći profil bez novog obrasca ili duplikata; u bazi je ponovno jedna aktivna sesija. Tajne, OAuth tokeni i osobni podaci nisu dodani u Git.

**Prije javne objave:** provjeriti produkcijsku domenu, HTTPS callback te predviđene Google račune. Lokalne postavke ne predstavljaju produkcijsko postavljanje. Pregled stvarno provedenih scenarija:

| Scenarij | Očekivano | Trenutačni rezultat stvarnog toka |
| --- | --- | --- |
| Novi Google račun | Dovršavanje registracije kandidata ili poslodavca; zapis u postojećoj bazi. | Stvarni kandidat potvrđen u pregledniku i bazi; poslodavac pokriven automatskim i baznim testovima. |
| Ponovna prijava | Isti lokalni ID i spremljena uloga; bez duplikata. | Potvrđeno stvarnim Google računom i SQL provjerom istog ID-ja, uloge i jednog profila. |
| Osvježavanje stranice | Sesija ostaje valjana. | Potvrđeno u stvarnom pregledniku. |
| Odjava i stari cookie | Sesija se ukida; stari cookie ne vraća prijavu. | Stvarna odjava i uklanjanje aktivne PostgreSQL sesije potvrđeni; replay starog cookieja pokriven HTTP testom. |
| Otkazivanje ili OAuth greška | Razumljiva poruka; gost ne dobiva prijavljenu sesiju. | Pokriveno HTTP testovima; ručno otkazivanje na Googleovoj stranici nije izvedeno. |
| Predviđena Google publika | Osobni i/ili organizacijski računi prema dogovorenoj publici. | Jedan osobni Google račun potvrđen; organizacijska ograničenja nisu provjerena. |

Lokalni stvarni Google tok sada je potvrđen za opisane scenarije. To nije potvrda produkcijskog postavljanja ni dostupnosti za svaki Google račun.

## Službene upute

- [Google: OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect).
- [Google: OAuth za web-poslužitelje](https://developers.google.com/identity/protocols/oauth2/web-server).
- [Google: upravljanje publikom](https://support.google.com/cloud/answer/15549945?hl=en) — pravila provjerena 17. 11. 2026.
