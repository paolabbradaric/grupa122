# Provjera ponovljivih sigurnosnih postavki baze

Datum: 18. 11. 2026. Podloga: `0577906ca716d4065be3ab17d82ce4002c594d68`.
Provjera je obavljena u zasebnom worktreeu. Promjene autentifikacijskih testova i
deployment dokumentacije iz PR-a #54 dio su podloge, a ne ovog sigurnosnog patcha.

## Lokalno okruženje i rezultati

Windows, PostgreSQL **18.6**, nova dva namjenska lokalna klastera na
`127.0.0.1:55436` i `127.0.0.1:55437`. Sigurnosni test prije stvaranja baza i
uloga provjerava stvarnu lokalnu adresu, `cluster_name=castme_security_test` i
očekivani `system_identifier` iz `pg_control_system()`. Scenarij bez API uloga
izvršen je prije njihova stvaranja. Test nije brisao prethodno postojeće uloge.

Iz `backend/`:

| Naredba | Rezultat |
| --- | --- |
| `npm ci` | Uspješno, 124 paketa, audit bez pronađenih ranjivosti |
| `npm test` | 254 testa: 240 prošlo, 0 neuspješnih, **14 preskočenih opt-in DB testova** |
| `npm run test:security:db` | **13 prošlo**, 0 neuspješnih, **0 preskočenih** |
| `node --test --test-concurrency=1 test/admin-database.test.js test/profiles-database.test.js test/moderation-database.test.js` | **31 prošao**, 0 neuspješnih, **0 preskočenih** |
| `node --test --test-concurrency=1 test/auth-database.test.js test/casting-drafts-database.test.js test/publicCastingAndRateLimitDatabase.test.js` | **17 prošlo**, 0 neuspješnih, **0 preskočenih** |
| `npm run db:migrate:security`, dvaput na lokalnom `castme_test` | Oba pokretanja uspješna |
| `node scripts/check-security-database.js`, bez konfiguracije | Očekivani exit 1 i zahtjev za oba testna ulaza |
| `git diff --check` | Bez grešaka razmaka |

Za sigurnosni test postavljeni su `SECURITY_TEST_DATABASE_URL` lokalnog klastera
na portu 55437 i `SECURITY_TEST_CLUSTER_ID` očitan pri njegovu stvaranju.
Admin/profile/moderation ulazi pokazivali su na namjenski klaster na portu 55436.
Za preostale tri DB provjere stvoren je lokalni `castme_test` iz cijelog
`schema.sql`; postavljeni su `PGHOST=127.0.0.1`, `PGPORT=55436`,
`PGDATABASE=castme_test`, `PGUSER=postgres`, `PGSSL=false`,
`AUTH_DATABASE_TESTS=1`, `CASTING_DATABASE_TESTS=1` i `PUBLIC_CASTING_DB_TESTS=1`.

Brojevi uključuju roditeljske testove i njihove podtestove prema ispisu `node:test`.
Zasebne DB naredbe zajedno imaju 61 uspješnu provjeru bez preskakanja. Obični npm
test ne izvršava tih 14 opt-in DB ulaza automatski; sedam ostalih DB ulaza koji
nisu obuhvaćeni gore navedenim naredbama nije ovom provjerom izvršeno.

## Što sigurnosna regresija dokazuje

- Cijeli bootstrap stvara 20 javnih i 4 privatne tablice s RLS-om, bez FORCE RLS-a
  i bez promjene vlasnika. Katalog obuhvaća sve tablice obiju aplikacijskih shema;
  dodatna nezaštićena tablica uzrokuje neuspjeh provjere.
- Fixture prethodne sheme izvršava stvarni bootstrap prije novog završnog bloka.
  Ima **12 tablica bez RLS-a** i ne zadovoljava sigurnosni ugovor. Stvarna uloga
  `anon` čita sintetičku privatnu obavijest te uspješno izvršava INSERT, UPDATE i
  DELETE nad vještinama; probni upisi vraćeni su rollbackom.
- Nakon migracije obje stvarne API uloge uz široke grantove ne vide niti mijenjaju
  retke poslovnih/veznih tablica. INSERT daje `42501`, a SELECT/UPDATE/DELETE
  vraćaju 0 redaka; osjetljivi objekti dodatno odbijaju pristup ACL-om.
- Normalizirani RLS/ACL/policy/owner/sequence katalog bootstrapa i ponovljene
  nadogradnje jednak je uz iste početne grantove i skup objekata. Izravni grantovi
  privatne sheme i sesija povučeni su na oba puta.
- Nadogradnja čuva neprazne retke, ID-eve, strane ključeve, ograničenja, definicije
  invoker funkcija i poslovnih triggera. Odbijanje povlačenja prijave s aktivnom
  rezervacijom i FK/UNIQUE pogreške provjereni su stvarnim SQL-om.
- Stariji opseg od 17 javnih tablica i sesija dobiva isti ugovor na zajedničkim
  objektima, bez stvaranja šest opcionalnih tablica ili novih funkcionalnih stupaca.
- Nedostajuća obavezna tablica, potencijalno otvorena izravna/PUBLIC/naslijeđena
  API politika i naslijeđene privilegije na osjetljivom objektu izazivaju pogrešku
  bez djelomičnih promjena. Dodatno je provjeren rollback nakon izvršenja SQL-a.
- Stroža prava i kompatibilne politike ostaju sačuvani; prava se ne dodaju.
- Registracija preko stvarnog modela, stvarni PostgreSQL sesijski store, javni
  Express GET za gosta, profilni/moderacijski upisi i dijeljeni limiter rade kao
  vlasnik. Postojeće profile/moderation regresije zasebno pokrivaju njihove
  modele, HTTP ovlasti i rollback scenarije.

## Udaljena baza i granice

Povezani Supabase profil MarioFER korišten je **samo za read-only** popis projekta
i katalog `CastMeIfYouCan` (`lboaendcihxzwkkjfgio`). Novo očitanje potvrđuje
PostgreSQL 17.11, 17 javnih tablica i `app_private.sessions`: sve imaju RLS,
nemaju FORCE RLS i nemaju politike; vlasnik je `postgres`.
API SELECT grantovi povučeni su na users/candidate_profiles/organisations/sesijama,
a ostalih 14 javnih tablica ima SELECT grantove uz zatvoren RLS. Nove profilne,
moderacijske i rate-limit tablice još nisu prisutne.

**Udaljena baza ostala je nepromijenjena.** Nisu primijenjeni DDL, funkcionalne
migracije, Storage promjene, deployment ni merge. Sigurnosna migracija na tom
projektu ostaje zaseban operativni korak prema [uputama](../../../db/Readme.md).
Migration history nije korišten kao dokaz potpunog stanja ručno primijenjenog SQL-a.

Lokalno nije bio dostupan pokrenut PostgreSQL 17 servis. Docker klijent je
instaliran, ali njegov daemon nije radio. Novi GitHub workflow zato eksplicitno
koristi izolirani `postgres:17` servis. Lokalni rezultati na 18.6 sami po sebi
ne dokazuju prolaz na 17; rezultat CI-ja treba provjeriti uz PR. Mrežni Supabase
Data API probe i stvarni Google OAuth nisu dio ove regresije. Frontend nije
mijenjan niti su pokretane njegove provjere.

Semantika je provjerena prema [PostgreSQL RLS dokumentaciji](https://www.postgresql.org/docs/17/ddl-rowsecurity.html),
[Supabase RLS dokumentaciji](https://supabase.com/docs/guides/database/postgres/row-level-security)
i [advisor opisu](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).
