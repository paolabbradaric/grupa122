# Ograničavanje predaje prijava

`POST /api/castings/:id/applications` zadržava postojeći zahtjev
`{ "coverLetter": "...", "videoUrl": "https://..." }`, pri čemu su oba
polja opcionalna. Odgovor uspjeha ostaje `201` s poljima `message` i
`application`. Nisu promijenjeni duplikati, rok, `max_applications`,
transakcija predaje niti kandidatov GET/PATCH povlačenja.

## Redoslijed zaštita

JSON parser → sesija i Passport → uloga `candidate` → dopušteni Origin i
`X-CSRF-Token` → ograničenje zahtjeva → postojeći kontroler i transakcija.
Neispravan JSON, gost, poslodavac/admin ili nevaljani Origin/CSRF ne troše
kvotu predaje. Kontrolerove odbijene prijave, uključujući nevaljane podatke,
duplikate i zatvoren oglas, troše pokušaj kada prođu prethodne zaštite.

Početna postavka je **10 pokušaja tijekom 15 minuta po korisniku** kroz sve
oglase. To je tehnička početna vrijednost za timski pregled s Mariom prije
aktivacije, a ne zamjena za limit od 1000 prijava po oglasu ili cjelovita
zaštita od botova koji imaju više računa. Prozor počinje prvim pokušajem;
sljedeći blokirani pokušaji ne produljuju ga.

Ključ je isključivo `req.user.id`, obnovljen iz poslužiteljske sesije.
Promjena IP adrese, `X-Forwarded-For`, sesije ili API instance ne daje novu
kvotu. PostgreSQL store dijeli brojač među instancama. Atomski UPSERT
serijalizira konkurentne pokušaje; vrijeme prozora određuje baza.

## Odgovori

Nakon desetog pokušaja novi zahtjev vraća `429`:

```json
{
  "code": "APPLICATION_RATE_LIMITED",
  "error": "Previše pokušaja prijave. Pokušaj ponovno kasnije."
}
```

Odgovor sadrži `Retry-After` u sekundama, `RateLimit`, `RateLimit-Policy` i
`Cache-Control: no-store`. Blokirani zahtjev ne dolazi do poslovnog
kontrolera i ne mijenja prijave/povijest. Sam brojač pokušaja ažurira se i
za blokirane zahtjeve.

Ako brojač nije dostupan, uključujući nedostajuću migraciju ili nedovoljne
ovlasti DB korisnika, predaja se zatvara s `503` bez poslovnog upisa:

```json
{
  "code": "APPLICATION_RATE_LIMIT_UNAVAILABLE",
  "error": "Predaja prijava trenutačno nije dostupna."
}
```

Ne postoji automatski fallback na memoriju niti se greška sprema u JSON
odgovor. Javni GET i ostale rute nisu ograničeni ovim limiterom.

## Migracija i aktivacija s Mariom

Nova migracija je
`db/migrations/20261118_application_submission_rate_limit.sql`; isti SQL
dodan je na kraj `db/schema.sql`. Kreira privatnu tablicu
`app_private.application_submission_limits` s jednim retkom po korisniku,
vanjskim ključem na `public.users`, brojačem i istekom prozora. Migracija
je transakcijska i ponovljiva, uključuje RLS i oduzima ovlasti PUBLIC,
`anon` i `authenticated`. Ne uvodi SECURITY DEFINER funkcije ni javne RLS
politike i ne dodjeljuje nove privilegije aplikacijskom računu.

**Prije uključivanja predaje obavezan je dogovor s Mariom o kontroliranoj
migraciji i postojećim ovlastima serverskog DB računa.** Vlasnik tablice
može koristiti store kao i postojeći privatni session store; zaseban
ograničeni runtime račun treba posebno pregledane ovlasti i RLS pravila.
Ne isključivati RLS radi uklanjanja greške. Nema automatskog pokretanja
migracije pri importu, startupu ili prvom zahtjevu.

Postojeće `APPLICATION_WRITES_ENABLED`, `APPLICATION_WRITES_CONFIRMED`
i ograničenje ciljane baze ostaju obavezni. Kada su poslovni upisi
isključeni, limiter ne pristupa brojaču i ne radi ni taj upis; postojeći
kontroler i dalje odbija predaju. Ovim radom upisi nisu uključivani na
Vercelu, `.env` nije mijenjan, a zajednički Supabase nije mijenjan.

Migracija povlačenja
`20261112_candidate_withdrawal_booking_guard.sql` i dalje je zaseban
preduvjet za PATCH povlačenja; nova migracija brojača ne zamjenjuje je.

## Ponovljiva provjera

Iz `backend` pokrenuti ciljane testove, zatim sve testove:

```sh
node --test test/publicCastings.test.js test/applicationRateLimit.test.js test/publicCastingAndRateLimitDatabase.test.js
npm test
```

DB skup je zadano preskočen. Uključuje se samo nakon potvrde izolirane
lokalne baze `castme_test`, odgovarajućim lokalnim računom:

```sh
PGHOST=127.0.0.1 PGPORT=5432 PGDATABASE=castme_test PGSSL=false \
PUBLIC_CASTING_DB_TESTS=1 node --test test/publicCastingAndRateLimitDatabase.test.js
```

Test prije prvog upisa provjerava konfiguraciju te stvarni naziv i adresu
servera. Kreira vlastite sheme `tin_public_<uuid>` i `tin_limits_<uuid>`,
koristi stvarnu početnu poslovnu shemu i migraciju uz zamjenu samo imena
shema te ih nakon testa briše. Ne mijenja postojeće `public`/`app_private`
objekte. Provjerava javna polja i filtre, injekcije, RLS/ACL, ponovljivost
migracije, konkurentne store instance, istek i reset prozora, puni HTTP
tok kroz dvije aplikacije te 503 bez migracije. HTTP testovi bez DB
zastavice koriste mockove i blokiraju pristup stvarnom poolu.

Store slijedi
[službeni ugovor express-rate-limit](https://github.com/express-rate-limit/express-rate-limit/blob/main/docs/guides/creating-a-store.mdx).
