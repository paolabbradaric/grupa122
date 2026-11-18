# Administratorski pristup

Faza A povezuje postojeću Google prijavu s administratorskim ovlastima i putanjom `/admin`. Panel ostaje demonstracijski: njegove verifikacije, prijave i brisanja koriste lokalne testne podatke i nisu poslovne promjene u bazi.

## Konfiguracija i opoziv

Jedini izvor dopuštenih adresa je privatni backend `ADMIN_EMAILS`, koji čita `src/auth/config.js`. Unijeti svih pet dogovorenih punih Google adresa, odvojenih zarezom, bez navodnika oko pojedinih stavki. Javni primjer u `.env.example` namjerno nema stvarni popis. Taj popis ne smije biti u `VITE_*` varijabli, frontend kodu ili Git povijesti.

Primjer sintakse: `ADMIN_EMAILS=admin.one@example.com,admin.two@example.com`.

Normaliziraju se samo rubni razmaci i veličina slova. Točke i `+suffix` ostaju dio adrese; domene, wildcardi i djelomična podudaranja ne vrijede. Nedostajući ili prazan popis zatvara admin pristup. Bilo koja neispravna stavka, uključujući prazan element nakon zareza, zaustavlja pokretanje s generičkom konfiguracijskom pogreškom bez ispisa adresa.

Nakon dodavanja ili uklanjanja adrese ponovno pokrenuti odnosno rasporediti sve backend instance. Popis se učitava pri pokretanju; pozitivne admin odluke ne spremaju se u sesiju ili međupozivni cache. Kad nova konfiguracija vrijedi na svim instancama, sljedeći admin zahtjev postojeće sesije uklonjene osobe dobiva `403`. Promjena DB uloge ili deaktivacija računa također vrijedi pri sljedećem zahtjevu jer Passport ponovno čita korisnika iz baze. Samo uklanjanje adrese ne briše račun ni povezane podatke.

Admin bez osobnih podataka ne može se promijeniti u kandidata ili poslodavca dok se ne dopune podaci koje ta uloga zahtijeva. Za opoziv bez takve dopune ukloniti adresu s popisa ili deaktivirati račun.

## Google identitet i prvi ulaz

Google callback i dalje koristi Passport, `state`, PKCE i strogu potvrdu Google adrese. Stabilni ključ ostaje `google:<sub>`. Server u novoj regeneriranoj sesiji čuva subject i potvrđenu adresu te oznaku da potječu iz provjerenog callbacka. Google access i refresh tokeni ne pohranjuju se. Stare sesije bez tog dokaza ne dobivaju admin pristup; potrebna je nova Google prijava.

Za dopušteni subject postojeći aktivni račun promovira se u admina uz isti ID, auth identitet i povezane podatke. Aktualna potvrđena Google adresa ažurira se samo na tom subjectu i samo ako nije zauzeta. E-mail nije osnova za spajanje s tuđim računom. Konflikt adrese ili deaktiviranog računa završava rollbackom i generičkim neuspjehom prijave. Korisnik izvan popisa ostaje u običnom toku; stara DB admin adresa ne može nadjačati novu Google adresu.

Za novi dopušteni Google identitet kreira se samo `users` zapis s ulogom admin. Ime i prezime preuzimaju se iz Google profila ako su dostupni; nedostupni podaci i datum rođenja ostaju `NULL`. Ne izmišljaju se osobni podaci niti se kreiraju kandidatski profil ili organizacija. Datum rođenja i osobni podaci nisu potrebni za administratorske funkcije, pa je ovo iznimka samo za admina. Kandidat i poslodavac zadržavaju obavezne osobne podatke i postojeću provjeru najmanje 18 godina u javnoj registraciji. Javna registracija i dalje odbija `role: admin`.

Provisioniranje koristi jednu SQL transakciju, zaključavanje subjecta/adrese, provjeru aktivnog računa i jedinstvene indekse. Istodobne prve prijave istog identiteta vraćaju isti račun. Dva različita subjecta ne mogu preuzeti istu normaliziranu adresu. SQL greške i konflikti poništavaju cijelu transakciju.

Mariov postojeći Google račun ID 49 ostaje demo administrator. Kandidatski profil je sačuvan; jedna aktivna uloga ne daje mu istodobno kandidatske ovlasti. Obrisani mock admin ID 48 ne vraća se, a ranije odluke verifikacije ne pripisuju se Mariju. Nema migracije s tim produkcijskim ID-jevima.

## API i prikaz

`/api/admin` registriran je nakon sesija i Passporta. Zajednički `requireAdmin` traži autentificiranog, aktivnog DB korisnika s ulogom admin, podudaranje DB subjecta i adrese s Google dokazom u sesiji te članstvo na aktualnom popisu. Sam e-mail, uloga, kontakt tvrtke, body, zaglavlja, URL ili browser storage ne daju ovlasti. Admin nema automatski kandidatske i poslodavačke ovlasti.

`GET /api/admin/session` vraća `200 { admin: true, userId }`, gost dobiva `401`, a autentificirana sesija bez admin ovlasti `403`. Sve admin odgovore, uključujući greške parsiranja, štiti `Cache-Control: no-store`. Sve metode koje mijenjaju stanje prolaze zajedničku Origin i CSRF provjeru. Nepostojeće poslovne rute vraćaju `404`; nema lažnih API odgovora koji tvrde da je provedena verifikacija ili brisanje.

Callback potvrđenog administratora otvara `/admin`. Obnova valjane admin sesije na početnom ulazu također otvara panel. Odabir druge javne stranice ne pokreće petlju vraćanja. `/admin`, osvježavanje i browser povijest koriste istu zaštitu; query i hash ne dodjeljuju ovlasti. Prije odgovora admin API-ja prikazuje se samo učitavanje. Gost dobiva postojeći ulaz na Google prijavu, a neovlaštena prijavljena osoba zabranu.

Panel provjerava sesiju pri ulazu, povratku fokusa/vidljivosti i svakih 15 sekundi dok je otvoren. `401`, `403` ili greška provjere uklanjaju panel i njegovo lokalno stanje. Odjava ga također uklanja. Budući poslovni API pozivi moraju jednako obraditi zabrane i nikad se oslanjati na raniji uspjeh provjere. Javna SPA ljuska i JavaScript bundle nisu tajni resursi.

Vite podržava izravni `/admin` i refresh. Produkcijski hosting mora usmjeriti `/api` na Express, a frontend putanje na SPA `index.html`, kako je opisano u instalaciji. Produkcijsko postavljanje nije dio ove provjere.

## Migracija

Za postojeću bazu iz `backend` pokrenuti `npm run db:migrate:admin` nakon provjere ciljne veze. Skripta u transakciji primjenjuje `db/migrations/admin_access.sql`; može se ponoviti. Nova baza koristi ažurirani `db/schema.sql`.

Migracija dopušta nepoznate osobne podatke samo adminu, uvodi jedinstvenu normaliziranu adresu, zadržava RLS i oduzima javnim DB ulogama pristup `users`. Ne stvara tablice ili korisnike, ne mijenja auth identitete i ne primjenjuje nepovezane migracije. Ako postoje adrese koje se sudaraju nakon trim/case normalizacije, cijela migracija se poništava; sukob se mora zasebno razriješiti uz provjeru vlasništva. Backendova privilegirana PG veza i dalje zahtijeva Express autorizaciju. To odgovara [Supabase pravilima o grants i RLS](https://supabase.com/docs/guides/api/securing-your-api).

U ovom Windows okruženju Supabase CLI blokira Application Control. SQL datoteka zato slijedi postojeću projektnu konvenciju imenovanja i ima zasebnu Node migracijsku skriptu. Primjena na zajedničku bazu provedena je Supabase connectorom nakon izoliranih SQL testova.

## Provjere

`npm test` pokreće auth/admin HTTP regresije. Google mrežna granica i korisnički model mockirani su u HTTP testovima; Express, Passport, `state`, PKCE, sesije, cookieji, Origin i CSRF su stvarni. CI koristi pet izmišljenih adresa. Privatni `ADMIN_TEST_EMAILS` može zadati točno pet ciljnih adresa za isti skup testova bez njihova objavljivanja u repozitoriju ili testnim nazivima.

`ADMIN_TEST_DATABASE_URL` mora pokazivati na lokalni PostgreSQL server na kojem test smije stvarati i brisati zasebnu testnu bazu. `npm run test:admin:db` tada provjerava novu shemu, nadogradnju, rollback migracije, konkurentno provisioniranje, FK veze i javne DB ovlasti. Bez varijable test je izričito preskočen. Udaljena baza je odbijena. Stvarni Google subject i pravilo njegove stabilnosti slijede [Google OIDC dokumentaciju](https://developers.google.com/identity/openid-connect/openid-connect).

Rezultati i granice su u [zapisniku admin provjere](verification/2026-11-17/admin-access.md). Mockirani callback nije dokaz da se svih pet ljudi stvarno prijavilo. Četiri nova računa nastaju tek njihovim prvim stvarnim Google ulazom.

## Preostali posao

- B1, F-009/F-010: slanje i ponovno slanje zahtjeva za verifikaciju, admin dohvat i trajne odluke pending/approved/rejected. Odbijanje traži razlog; reviewer dolazi iz stvarne sesije, uz vrijeme, transakciju i zaštitu od istodobnih odluka. Uskladiti profil i objavu s posljednjom odlukom po `submitted_at DESC, id DESC`.
- B2, F-031: tablica i slanje prijave neprimjerenog oglasa, validiran razlog, autor, oglas, vrijeme i status. Sama prijava ne mijenja automatski status oglasa.
- B3, F-032: admin dohvat i obrada prijava, trajna odluka i obrađivač, zatvaranje neopravdane prijave bez brisanja oglasa, konkurentna obrada, prazna stanja i pogreške.
- B4, F-025: pažljivo definirano trajno brisanje s potvrdom, svim FK vezama, transakcijom, oporavkom i čišćenjem vanjskog storagea. Bez slijepog CASCADE-a i brisanja dijeljenih ili profilnih medija. Testirati na izoliranim podacima; SQL rollback ne vraća već obrisanu vanjsku datoteku.
- B5, F-033: zaštićeni statistički endpoint i prikaz stvarnih agregata, uz dosljedna pravila statusa i soft-deletea.

Sve buduće admin operacije ostaju iza zajedničkog routera i njegovih autorizacijskih i CSRF provjera.
