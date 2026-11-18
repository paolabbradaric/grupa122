# Popravak produkcijske sheme i aktivacija oglasa — 18. 11. 2026.

Osnova grane `codex/deployed-casting-profile-fix` je `0577906` (main nakon
Mariova PR-a #54). Korisnik je izričito odobrio ciljane migracije, aktivaciju
i probno spremanje, uz očuvanje postojećih podataka i sigurnosnih provjera.

## Potvrđen uzrok

Produkcijski Vercel zapisnici pokazali su `42P01` za `GET /api/profiles/me`,
`POST /api/castings/:id/reports` i admin pregled prijava, a `42703` za
admin verifikacije. Read-only provjera sheme potvrdila je odsutnost
`profile_media`, `profile_storage_objects`, `casting_reports`, privatnih
moderacijskih tablica i `verification.submitted_data`.

Za stvaranje oglasa nedostajale su konfiguracijske potvrde upisa. Dosadašnja
funkcija dopuštala je upise samo na lokalni `castme_test`; frontendovi gumbi
za nacrt i objavu već pozivaju stvarni API.

## Izvedene migracije

Postojeći, neizmijenjeni `db/migrations/profiles.sql` i
`db/migrations/moderation.sql` prvo su dvaput testirani na jednokratnim
shemama lokalnog `127.0.0.1:5432/castme_test`. Potom su nakon odobrenja
primijenjeni u **jednoj transakciji** na zajedničkoj bazi. Prije upisa
uspoređeni su javni ID-jevi i nazivi oglasa s aktivnim produkcijskim GET-om.
Veza koristi TLS s provjerom CA certifikata. Zbog transakcijskog poolera
read-only preflight koristi izričitu `BEGIN READ ONLY`, bez oslanjanja samo
na startup `options`.

Nove tablice provjerene su prije COMMIT-a: RLS uključen, bez PUBLIC ovlasti.
Nisu brisani postojeći podaci niti su dodijeljene nove javne privilegije.
Migracije povlačenja i brojača predaje nisu izvršene ovim popravkom;
kandidatovi upisi ostaju zasebna, isključena aktivacija.

## Promjena aplikacije

Poslodavčevi upisi ostaju zadano isključeni. Sada postoji zasebna potvrda
udaljene baze `EMPLOYER_CASTING_WRITES_ALLOW_REMOTE=true`, uz obavezne
`EMPLOYER_CASTING_WRITES_ENABLED=true`,
`EMPLOYER_CASTING_WRITES_CONFIRMED=true` i `PGSSL=true`. Te postavke
primjenjuju se samo na odobrenu produkciju; preview ostaje bez upisa.
Nije uklonjena autentifikacija, uloga, vlasništvo, Origin/CSRF, provjera
verificiranog poslodavca, transakcija ili DB zaštita. Ispravljeni su i
pokvareni hrvatski znakovi u generičnim backend porukama.

## Testovi

- Ciljani testovi: **28 uspješnih, 0 neuspješnih**.
- Cijeli backend: **283 ukupno, 272 uspješna, 0 neuspješnih, 11 preskočenih**.
  Uključeni su `DEPLOYED_SCHEMA_DB_TESTS`, `PUBLIC_CASTING_DB_TESTS` i
  `CANDIDATE_APPLICATIONS_DB_TESTS`, samo na lokalnom `castme_test`.
- Novi SQL regresijski test prvo reproducira tri produkcijske greške,
  zatim provjerava nadogradnju, ponovljivost, dohvat/uređivanje profila,
  admin dohvat, nacrt, objavu, vlastite oglase i prijavu neprimjerenog oglasa.
  Provjerava i odbijanje vlastitog/duplog reporta te RLS/ACL novih tablica.
- Frontend datoteke i `.env` nisu mijenjani. CSS nije predmet ovog popravka.

Upload slika i portfolio ovise i o privatnom Storage bucketu te serverskoj
konfiguraciji; uspješan tekstualni profil ne potvrđuje spremnost uploada.
