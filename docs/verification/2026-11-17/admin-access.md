# Provjera administratorskog pristupa

Provjera 17. 11. 2026. polazi od aktualnog `origin/main` commita `bc6c9c0bbff5142d5ecfd0c3292af7592546347b`. Implementacija je u čistom worktreeju, bez izmjena ranijih lokalnih dokumenata i mock SQL-a.

## Automatizirane provjere

- Backend `npm test` s uključenim `ADMIN_TEST_DATABASE_URL`: 201 test ukupno, 192 prolaze, 9 postojećih zasebno uključivih DB scenarija preskočeno, bez padova. Novi admin SQL testovi izvršeni su na zasebnoj lokalnoj PostgreSQL instanci.
- Admin HTTP regresije: 36 testova prolazi, uključujući pet pozitivnih callbackova, gosta, kandidata, poslodavca, admina izvan popisa, nenavedene adrese/aliase, neprovjeren Google e-mail, stare sesije, promjenu subjecta/adrese, opoziv popisa/uloge, deaktivaciju, istek, CSRF, odjavu i stari cookie. Testovi prolaze i s točno pet ciljnih adresa privatno proslijeđenih kroz `ADMIN_TEST_EMAILS`; adrese nisu ispisane ni pohranjene u repozitoriju.
- Izolirani admin SQL skup: 11 testova prolazi. Provjereni su nova shema, ponovljiva migracija, upgrade s postojećim korisnicima i FK vezama, rollback kod normaliziranih duplikata, očuvanje identiteta/profila/odluka pri promociji, `NULL` osobni podaci samo adminu, konkurentne prijave, konflikti, deaktivacija te RLS i grants.
- Postojeći `npm run test:db`: jedan test prolazi nad lokalnom bazom, uz privremene tablice. Provjerava običnu candidate/employer registraciju, rollback, dohvat korisnika i PostgreSQL sesijski store.
- Frontend `npm run lint` i `npm run build` prolaze.
- Pregled bundlea ne nalazi privatne administratorske adrese ni konfigurirane backend tajne. `backend/.env` ostaje izvan Gita.

Za ponavljanje admin SQL skupa postaviti `ADMIN_TEST_DATABASE_URL` na lokalni server koji smije stvarati i brisati zasebnu testnu bazu, pa iz `backend` pokrenuti `npm run test:admin:db`. Bez varijable test je izričito preskočen; udaljena adresa se odbija. Za kompletan backend skup uz admin SQL testove postaviti istu varijablu i pokrenuti `npm test`.

## Browser provjera

Playwright CLI koristio je zaseban browser profil, frontend ovog worktreeja na portu 5174 i stvarni Express na portu 3000. Backend je koristio stvarni korisnički SQL model, izoliranu lokalnu bazu i `connect-pg-simple` sesije. Googleov token/profile odgovor bio je mockiran. OAuth početak i callback izvršeni su s pravim Passport state/PKCE mehanizmom; nije korištena stvarna prijava kolega.

Provjereni scenariji:

- Gost otvara `/admin`, vidi učitavanje i ulaz u Google prijavu; admin API vraća `401`.
- Verificirani mockirani Google admin prolazi callback, dobiva račun u lokalnoj bazi i automatski otvara `/admin`, bez onboardinga.
- Refresh obnavlja sesiju iz PostgreSQL-a i ponovno potvrđuje pristup. Odlazak na javnu početnu stranicu ostaje na njoj; browser Back vraća `/admin` uz novu API provjeru.
- Uklanjanje adrese iz efektivne serverske konfiguracije postojeće sesije vraća `403`; sljedeća periodična provjera uklanja panel i prikazuje zabranu.
- Odjava uklanja panel i vraća početnu stranicu; ponovni izravni `/admin` pokazuje prijavu.
- Postojeći kandidat prolazi običnu Google prijavu, ali `/admin?role=admin#admin` i izravni API ostaju zabranjeni. Promjena `localStorage.role` pa refresh ne daje pristup.
- Panel i nakon uspješnog ulaza jasno navodi da koristi testne podatke i da promjene nisu spremljene u bazu.

Odgovori `401` i `403` pojavljuju se kao očekivane odbijene mrežne stavke u browser konzoli; nisu JavaScript iznimke. Produkcijski SPA fallback i stvarna Google prijava svih pet osoba nisu provjereni. Vite lokalni fallback, refresh i povijest jesu.

## Zajednička baza i privatna konfiguracija

Prije migracije SQL provjera potvrdila je aktivnog Google admina ID 49 s jednim kandidatskim profilom i odsutnost ID-a 48. Nije bilo duplikata normaliziranih adresa ni neadmin računa bez obaveznih osobnih podataka.

Supabase connectorom primijenjena je samo migracija `admin_access`. Završni SQL potvrđuje novi CHECK i jedinstveni indeks, nullable osobne podatke, uključen RLS i odsutnost SELECT ovlasti za `anon` odnosno INSERT ovlasti za `authenticated` na `users`. ID 49, njegov Google identitet i jedan profil ostaju sačuvani. ID 48 ne postoji; verifikacije 4 i 5 ostale su `approved` s `reviewed_by = NULL`.

Sigurnosni advisor prije i nakon migracije navodi iste informativne nalaze za RLS bez politika. To nije potvrda javnog pristupa; grants i RLS provjereni su zajedno za izmijenjenu tablicu. Nisu dodavane permisivne politike niti mijenjane nepovezane poslovne tablice. Nije provođen mrežni test Supabase Data API-ja.

Svih pet ciljnih adresa postavljeno je u privatnu lokalnu backend konfiguraciju, uključujući konfiguraciju novog worktreeja. Promjena popisa vrijedi nakon restarta svih backend procesa. Produkcijsko okruženje nije raspoređeno ni konfigurirano ovim PR-om. Četiri nova računa nisu unaprijed stvorena; njihov prvi stvarni verificirani Google ulaz provodi provisioniranje. Nije potvrđeno da se svih pet osoba stvarno prijavilo.

## Preostalo

Panel nema trajne poslovne admin operacije. B1 verifikacija, B2 slanje prijava oglasa, B3 obrada prijava, B4 trajno brisanje i B5 statistika ostaju u [zasebnom backlogu](../../ADMIN_PRISTUP.md#preostali-posao). Prije produkcijskog korištenja još treba rasporediti ovu verziju aplikacije, postaviti privatni popis na svim instancama, konfigurirati SPA fallback i provesti stvarne ovlaštene Google prijave.
