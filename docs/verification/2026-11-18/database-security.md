# Provjera ponovljivih sigurnosnih postavki baze

Datum: 18. 11. 2026. PR: [#55](https://github.com/paolabbradaric/grupa122/pull/55).
Pregledano polazište: `b99357a147fdc1a64ba9952dc1c186be058bed07`.
SQL popravak i regresije: `afba2c56142418cbe90c5e311e74e86a1a834298`.
Popravak čišćenja profilnih fixturea: `0f0928db10167ae6d56714c3d706a0429774d4d7`.
Rad je proveden u zasebnom worktreeu; drugi checkouti nisu mijenjani.

## MAINTAIN: pad prije popravka i prolaz nakon njega

Proširen je stvarni opt-in `security-database.test.js`, uz postojeći
`migrateSecurity(pool)` i zasebne baze iz legacy bootstrapa. Za svaku API ulogu,
`anon` i `authenticated`, postojeća testna grupna uloga `security_observer`
dobiva samo `MAINTAIN` na `public.users`; članstvo se uklanja u `finally`.
Prije migracije SQL potvrđuje efektivni MAINTAIN=true i SELECT=false te da API
uloga nije vlasnik, ne nasljeđuje vlasnika, nije superuser i nema BYPASSRLS.

Prvo je pokrenut novi test bez promjene proizvodnog SQL-a. Rezultat:

```text
inherited MAINTAIN for anon: Missing expected rejection.
inherited MAINTAIN for authenticated: Missing expected rejection.
tests 17; pass 14; fail 3; skipped 0; process exit 1
```

Treći neuspjeh jest roditeljski test zbog dva pala podtesta. Oba izravna MAINTAIN
scenarija već su prolazila. To potvrđuje da postojeći REVOKE ALL uklanja izravni
grant, ali nepotpuna provjera nije odbijala naslijeđeni grant.

Nakon dodavanja MAINTAIN-a u popis `has_table_privilege` u oba stvarna SQL bloka,
ista naredba prolazi: **17 prošlo, 0 neuspješnih, 0 preskočenih, exit 0**.
Stvarna dijagnostika za obje uloge:

```text
P0001: Security migration: API role anon retains inherited or column privileges on public.users; resolve those grants separately.
P0001: Security migration: API role authenticated retains inherited or column privileges on public.users; resolve those grants separately.
```

Legacy fixture sadrži neprazne sintetičke podatke i tablice bez RLS-a. Nakon
odbijanja uspoređuju se svi RLS/FORCE RLS flagovi, vlasnici, tablični i schema ACL,
politike, sekvence, efektivna prava, podaci, ograničenja, funkcije i triggeri.
Sve ostaje jednako; izvorni naslijeđeni MAINTAIN ostaje aktivan nakon rollbacka.
Izravni MAINTAIN za svaku API ulogu zasebno se povlači uspješnom, ponovljivom
migracijom uz očuvanje podataka. Postojeća regresija naslijeđenog SELECT-a ostaje.

Kataloški helper sada za obje API uloge provjerava svih osam table privilegija
PostgreSQL-a 17: SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER i
MAINTAIN. `has_table_privilege` pokriva efektivna, uključujući naslijeđena prava,
na svih 12 prisutnih osjetljivih objekata aktualnog bootstrapa (192 kombinacije),
odnosno na prisutnom podskupu starije sheme. Isti ugovor provjerava bootstrap,
uspješne nadogradnje i strože početne grantove. Poslovnim tablicama izvan tog
skupa nisu povučeni dodatni grantovi.

Sačuvana je jednakost normaliziranog sigurnosnog SQL-a bootstrapa i migracije,
column/schema provjere, postojeća dijagnostika i runnerova transakcija s
`lock_timeout=5s`. Nema nove kopije proizvodnih pravila niti novog frameworka.

## Lokalno okruženje i rezultati

Windows, Node.js **24.14.0**, PostgreSQL **18.6**. Stvoren je novi namjenski klaster
na `127.0.0.1:55447`, s `cluster_name=castme_security_test` i identifikatorom
`7709562927121894344`, bez prethodnih API/testnih uloga. Identitet je potvrđen
prije DDL-a; sigurnosni skup pokrenut je prije admin skupa. Klaster je nakon
provjera uredno zaustavljen. Docker daemon nije dostupan; PostgreSQL 17 provjerava CI.

Iz `backend/`:

| Naredba | Rezultat |
| --- | --- |
| `npm ci` | 124 paketa; audit bez pronađenih ranjivosti; exit 0 |
| `npm test` | 254 testa: **240 prošlo, 14 opt-in DB preskočeno**, 0 neuspješnih; exit 0 |
| `npm run test:security:db` | **17 prošlo, 0 preskočenih**, 0 neuspješnih; exit 0 |
| `node --test --test-concurrency=1 test/admin-database.test.js test/profiles-database.test.js test/moderation-database.test.js` | **31 prošao, 0 preskočenih**, 0 neuspješnih; cijeli proces exit 0 |
| `node --test --test-concurrency=1 test/auth-database.test.js test/casting-drafts-database.test.js test/publicCastingAndRateLimitDatabase.test.js` | **17 prošlo, 0 preskočenih**, 0 neuspješnih; exit 0 |
| Netočan `SECURITY_TEST_SERVER_ADDRESS=192.0.2.1` | Očekivani exit 1 prije DDL-a; puni katalozi baza, uloga i članstava jednaki prije/poslije |
| Netočan `SECURITY_TEST_CLUSTER_ID=1` | Očekivani exit 1 prije DDL-a; isti katalozi nepromijenjeni |
| `node scripts/check-security-database.js` bez konfiguracije | Očekivani exit 1 uz zahtjev za oba testna ulaza |
| `git diff --check` | Prolazi |

Za sva tri DB skupa korišten je samo taj novi lokalni klaster. Admin/profile/
moderation URL-ovi ciljali su njegov `postgres`; za auth/drafts/public-casting
stvoren je `castme_test` iz cijelog `schema.sql`, uz lokalne PG postavke,
`PGSSL=false` i sva tri eksplicitna opt-in ulaza. Zasebni skupovi zajedno imaju
**65 prolaza bez preskakanja**. Brojevi uključuju roditeljske testove prema
`node:test`. Obični npm test jasno odvaja svojih 14 opt-in preskakanja.

Pozitivni scenariji i dalje pokrivaju 20 javnih i 4 privatne tablice, stariji
opseg od 17 javnih tablica i sesija, ponovljivost, očuvanje vlasnika/politika/
strožih prava i nepraznih podataka te stvarne backend registracije, sesije,
javni Express GET, profile, moderaciju i limiter. Nije dodan FORCE RLS ni otvorena
API politika. Naslijeđeni MAINTAIN nalaz nije dokaz čitanja poslovnih redaka.

## Dva prijavljena CI pada

Pregledani su stvarni job logovi i diffovi povijesnih popravaka:

| Run i commit | Nalaz i zadržani popravak |
| --- | --- |
| [44353583889](https://github.com/paolabbradaric/grupa122/actions/runs/44353583889), `126e891` | Sigurnosni test pada na loopback assertionu jer server vidi Dockerovu internu adresu. `3435285` dodaje očekivanu adresu iz inventara vlastitog servisa i potvrdu adrese, cluster_name i system_identifier. |
| [44353955281](https://github.com/paolabbradaric/grupa122/actions/runs/44353955281), `3435285` | Admin assertioni prolaze, ali proces pada sa zakašnjelim `terminating connection due to administrator command` i `uncaughtException`: 31 prolaz, 1 pad. `0d6dd74` zamjenjuje FORCE običnim DROP DATABASE nakon await pool.end(). |
| [44358360515](https://github.com/paolabbradaric/grupa122/actions/runs/44358360515), `afba2c5` | Novi sigurnosni skup prolazi 17/17 na PostgreSQL-u 17, ali profiles fixture nakon uspješnih podtestova daje isti zakašnjeli FATAL: cijeli proces ima 31 prolaz i 1 pad. U njemu su ostala dva FORCE brisanja. `0f0928d` oba zamjenjuje običnim DROP-om. |

Oba popravka ostaju prisutna. Admin paralelni pozivi su awaitani preko Promise.all
ili Promise.allSettled; rezervirani klijenti puštaju se u finally. I migracijski
runner pušta klijenta nakon COMMIT-a ili ROLLBACK-a. Sigurnosni i admin fixture
zatvaraju poolove prije običnog DROP-a. Nisu dodani sleepovi, gutanje pogrešaka,
isključivanje assertiona ili continue-on-error.

Novi profiles pad provjeren je iz loga, a ne odbačen kao povijesni. Podtest
`durable JPG/PNG, concurrent portfolio limit, replacement and private content`
prolazi, ali njegov dodatni `restarted` pool još može zatvarati socket dok roditelj
prisilno briše bazu. U zaključanom pg-poolu `_remove` uklanja klijenta iz `_clients`
prije `client.end` callbacka; `_pulseQueue` može završiti pool čim je popis prazan.
Usporedni uploadi su awaitani preko Promise.allSettled, modelovi transakcijski
klijenti puštaju se u finally, a restarted pool ima await end u finally. Zato su
oba FORCE brisanja u profiles fixtureu zamijenjena običnim DROP-om, koji dopušta
uredno odspajanje i i dalje prijavljuje stvarno zaostale veze. Cijeli lokalni
admin/profiles/moderation proces ponovno je provjeren nakon tog popravka: 31/31,
bez preskakanja, exit 0.

Workflow zadržava lokalni konfigurirani host, očekivanu adresu iz
`docker inspect` točno `job.services.postgres.id`, ime klastera, system_identifier
i opt-in zaštitu. Lokalni put bez eksplicitne serverske adrese i dalje traži
loopback. Public-casting fixture koristi isti očekivani ulaz i potvrdu identiteta.

## Actions i PostgreSQL 17 CI

U DB workflowu promijenjene su samo dvije uses reference, s v4 na v7, prema
postojećem načinu pinanja glavnim tagom. Provjerena službena izdanja:

- [checkout v7.0.1](https://github.com/actions/checkout/releases/tag/v7.0.1),
  v7 i izdani tag na `3d3c42e5aac5ba805825da76410c181273ba90b1`;
  [action.yml](https://github.com/actions/checkout/blob/v7.0.1/action.yml) koristi node24.
- [setup-node v7.1.0](https://github.com/actions/setup-node/releases/tag/v7.1.0),
  v7 i izdani tag na `949feb2413d6458794dcd2491c4babbbce0c15c1`;
  [action.yml](https://github.com/actions/setup-node/blob/v7.1.0/action.yml) koristi node24.

Provjereni README zahtijeva runner najmanje 2.327.1. Workflow koristi GitHubov
ubuntu-latest; ne koristi pull_request_target, Docker container actions niti
registry-url koji bi zahtijevali dodatne kompatibilne inpute. Aplikacijski
`node-version: 22`, npm cache/lockfile putanja, contents: read, postgres:17 servis
i svi DB koraci ostaju isti.

[GitHub Actions run 44358909455](https://github.com/paolabbradaric/grupa122/actions/runs/44358909455)
za HEAD `0f0928db10167ae6d56714c3d706a0429774d4d7` završio je **success**.
Log potvrđuje testni merge `95d1bb7` s aktualnim mainom
`4b1b0992ccc80e854c9b056ec4b573a67f017ee2`, PostgreSQL **17.12**, backend
Node.js **22.23.4**, npm **10.9.9** i Actions runner **2.338.2**.

| CI korak | Prošlo | Preskočeno | Neuspješno |
| --- | ---: | ---: | ---: |
| npm ci | Uspješno; audit bez ranjivosti | — | — |
| npm test | 243 | 15 | 0 |
| npm run test:security:db | 17 | 0 | 0 |
| Existing database regressions | 31 | 0 | 0 |
| Bootstrap and scoped auth, drafts, casting and quota regressions | 17 | 0 | 0 |

CI npm test ima 258 testova zbog dodatnih promjena u mainu iz PR-a #56;
lokalni checkout ove grane ima 254. Brojevi su preuzeti iz stvarnih završnih
sažetaka svakog procesa. Svi DB koraci i post-job cleanup prolaze. Nema loopback
pada, zakašnjelog `terminating connection due to administrator command`,
`uncaughtException` ni Node.js 20 upozorenja za Actions. Preuzeti SHA-ovi obiju
akcija odgovaraju gore provjerenim izdanjima.

Pregledana je i jedina anotacija `postgres-security` checka: **notice** o
preseljenju ubuntu-latest na Ubuntu 26. To je platformska obavijest; nema warning
ili failure anotacije. Zasebni Vercel status i Preview Comments check također
su success, ali ne zamjenjuju rezultate DB procesa.

Završni pregled `git diff --check` prolazi. `git merge-tree --write-tree HEAD
origin/main` ne nalazi konflikte s gore navedenim mainom; GitHub potvrđuje
mergeable=true, bez review threadova. Ovaj zapisnik ažurira samo dokaze provjera;
nakon njegova commita ponovno se provjeravaju svi statusi konačnog remote HEAD-a
u [PR provjerama](https://github.com/paolabbradaric/grupa122/pull/55/checks).

## Udaljena baza i granice

U ovom završnom popravku zajednička Supabase baza nije kontaktirana niti
migrirana. Prethodno dokumentirano read-only očitanje odnosilo se na ranije
stanje i ne predstavlja potvrdu trenutačnog kataloga. Lokalni i CI PostgreSQL
služe samo izoliranim testovima; ne zamjenjuju aplikacijski Supabase projekt.
Primjena migracije na Supabaseu ostaje zaseban operativni korak prema
[uputama](../../../db/Readme.md).

PR ostaje otvoren, bez mergea i bez uključenog auto-mergea. Nema ručnog deploymenta;
Vercelova automatska provjera/deployment nisu dokaz prolaza DB regresije.
Frontend, poslovni tokovi, Google identiteti i aplikacijske ovisnosti nisu mijenjani.

Referentni ugovor privilegija: [PostgreSQL 17 GRANT](https://www.postgresql.org/docs/17/sql-grant.html).
