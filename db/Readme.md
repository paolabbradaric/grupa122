
# Baza podataka

`schema.sql` služi za novu, praznu bazu. Postojeće baze nadograđuju se datotekama iz `migrations/`.

## Ponovljive sigurnosne postavke

Browser pristupa podacima kroz Express `/api`, uz Passport/Google i serversku sesiju.
Nema Supabase Auth JWT-a koji bi odgovarao lokalnom cjelobrojnom `users.id`.
Zato aplikacijske tablice imaju RLS bez browser politika: uz table grantove,
`anon` i `authenticated` ne mogu čitati ni mijenjati retke. Vlasnik tablica i
BYPASSRLS serverska veza i dalje trebaju autorizaciju u Expressu.
RLS ne štiti `TRUNCATE`, `REFERENCES` ni druge operacije nad cijelom tablicom.
Ova migracija ne povlači sve ovlasti na svim domenskim tablicama i ne mijenja
globalne default privilegije ni Data API postavke.

### Nova prazna baza

Provjerite ciljnu vezu i izvršite **cijeli** bootstrap iz korijena repozitorija:

```powershell
psql -v ON_ERROR_STOP=1 -c "SELECT current_database(), current_user, inet_server_addr(), inet_server_port(), version();"
psql -v ON_ERROR_STOP=1 -f db/schema.sql
```

`psql` koristi vlastite PG postavke, ne učitava `backend/.env`. Bootstrap nije
ponovljiv nad postojećom bazom. Dovršena aktualna shema ima 20 javnih i 4 privatne
tablice, sve s RLS-om. Završni sigurnosni blok jednak je novoj migraciji;
regresija provjerava izvorni SQL i stvarni katalog obaju putova. Bootstrap već
sadrži transakciju rate-limit dijela; nemojte ga omatati vanjskim `BEGIN` ili
`--single-transaction`. Sigurnosna nadogradnja ima zaseban transakcijski postupak.

### Postojeća ili već zaštićena baza

Podržani minimum je 17 osnovnih `public` tablica iz početne sheme i
`app_private.sessions` iz auth migracije. Popis obaveznih tablica izričito je
naveden u [sigurnosnoj migraciji](migrations/20261118_application_security.sql).
Ako nedostaju sesije, prvo primijenite `npm run db:migrate:auth`. Nedostajuća
osnovna tablica uzrokuje jasnu pogrešku, bez djelomične zaštite.

1. Provjerite `backend/.env` i cilj koristeći **istu konfiguraciju kao runner**,
   iz `backend/` (ispisuju se samo identitet baze/servera i uloga):

   ```powershell
   node -e "const p=require('./src/config/db');p.query('SELECT current_database(),current_user,inet_server_addr(),inet_server_port(),version()').then(r=>console.log(r.rows)).catch(e=>{console.error(e.code||'CONNECTION_ERROR');process.exitCode=1}).finally(()=>p.end())"
   ```

2. Provjerite katalog upitima ispod i osigurajte povratnu kopiju prema postupku
   održavatelja. Uloga migracije mora moći zaključati i mijenjati sve ciljne
   tablice te povući prava privatne sheme. API uloge ne smiju biti vlasnici niti
   imati superuser/BYPASSRLS ovlasti.
3. Iz `backend/` pokrenite:

   ```powershell
   npm run db:migrate:security
   ```

   [Runner](../backend/scripts/migrate-security.js) jedini upravlja transakcijom:
   `BEGIN`, cijeli SQL, `COMMIT`, odnosno `ROLLBACK` pri pogrešci. SQL ograničava
   čekanje na zaključavanje na 5 sekundi. Kod `55P03` ponovite u mirnijem terminu;
   nemojte uklanjati provjere da biste zaobišli neuspjeh.
4. Ponovite read-only provjere. Ista naredba vrijedi i za već zaštićenu bazu;
   ponavljanje ne mijenja podatke niti dodaje prava. Za ručnu alternativu koristite
   samo ovu migraciju, uz `psql -v ON_ERROR_STOP=1 --single-transaction -f
   db/migrations/20261118_application_security.sql` iz korijena.

Migracija uključuje RLS na osnovnim tablicama i na ovim objektima **ako postoje**:
`profile_media`, `profile_storage_objects`, `casting_reports`,
`app_private.moderation_events`, `app_private.moderation_file_cleanup` i
`app_private.application_submission_limits`. Ne stvara ih niti dodaje njihove
stupce. Sigurnost se zato može primijeniti prije funkcionalnog rollouta.
Za funkcionalnosti zasebno primijenite profiles, zatim moderation, a za dijeljeni
limiter `20261118_application_submission_rate_limit.sql` prema potrebama aplikacije;
nakon njih ponovite `db:migrate:security` i katalog provjere. Nova prazna baza sve
to već uključuje. Ne izvršavajte sve datoteke direktorija: `profiles_rollback.sql`
je povrat, a `casting_call_maxapp.sql` nije ponovljiva migracija.

Postojeći stroži grantovi, vlasnici, funkcije, triggeri i politike ostaju sačuvani.
Migracija ne uvodi FORCE RLS ni SECURITY DEFINER. Povlači postojeći osjetljivi
ACL skup (`users`, `candidate_profiles`, `organisations`, `media_files`,
`verification`, sesije i prisutni opcionalni objekti) od `PUBLIC` i postojećih
API uloga te izričito zatvara `app_private`. Obične poslovne table/sequence
grantove ne proširuje niti općenito ukida.

Restriktivne politike i politike drugih uloga ostaju. API permissive politika
dopuštena je samo kada su odgovarajući `USING`/`WITH CHECK` izrazi doslovno `false`.
To je konzervativna provjera: i složen zatvoren izraz može zahtijevati zaseban
pregled. Potencijalno propusna politika za `PUBLIC`, API ulogu ili njezino
članstvo prekida migraciju prije izmjena. Naslijeđene ili column privilegije koje
ostanu na osjetljivom objektu također uzrokuju rollback; runner ih ne pokušava
ukloniti promjenom tuđih uloga. Dijagnostika navodi problematičan objekt/ulogu.

### Read-only provjere

Tablice bez RLS-a (očekuje se prazan rezultat, i za buduće aplikacijske tablice):

```sql
SELECT n.nspname, c.relname
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname IN ('public','app_private')
  AND c.relkind IN ('r','p') AND NOT c.relrowsecurity
ORDER BY 1,2;
```

RLS, vlasnici, FORCE i politike provjeravaju se odvojeno od grantova:

```sql
SELECT n.nspname, c.relname, c.relrowsecurity, c.relforcerowsecurity,
       pg_get_userbyid(c.relowner) AS owner,
       (SELECT count(*) FROM pg_policy p WHERE p.polrelid=c.oid) AS policies
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname IN ('public','app_private') AND c.relkind IN ('r','p')
ORDER BY 1,2;
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies WHERE schemaname IN ('public','app_private');

SELECT r.rolname, n.nspname, c.relname, p.privilege,
       has_table_privilege(r.oid,c.oid,p.privilege) AS table_granted
FROM pg_roles r CROSS JOIN pg_class c
JOIN pg_namespace n ON n.oid=c.relnamespace
CROSS JOIN (VALUES ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE')) p(privilege)
WHERE r.rolname IN ('anon','authenticated')
  AND n.nspname IN ('public','app_private') AND c.relkind IN ('r','p')
ORDER BY 1,2,3,4;
SELECT rolname,
       has_schema_privilege(oid,'app_private','USAGE') AS private_usage,
       has_schema_privilege(oid,'app_private','CREATE') AS private_create
FROM pg_roles WHERE rolname IN ('anon','authenticated');

-- Zasebno provjerite PUBLIC i eventualne grantove drugim ulogama.
SELECT n.nspname,c.relname,
       CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END AS grantee,
       a.privilege_type
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
CROSS JOIN LATERAL aclexplode(COALESCE(c.relacl,acldefault('r',c.relowner))) a
WHERE n.nspname IN ('public','app_private') AND c.relkind IN ('r','p')
ORDER BY 1,2,3,4;
```

Grant na domenskoj tablici uz RLS bez politika ne dopušta čitanje/upis redaka.
Za osjetljivi skup i privatnu shemu očekuje se i povlačenje API prava, ne samo RLS.
Provjerite i eventualne column grantove kroz `information_schema.column_privileges`.
Supabase advisor INFO `rls_enabled_no_policy` odgovara ovom zatvorenom modelu;
ne uklanja se dodavanjem `USING (true)` politika. Migration history nije potpuna
povijest ručno izvršenog SQL-a; mjerodavno stanje provjerava se katalogom.

### Izolirane regresije

`npm test` preskače opt-in DB testove. `npm run test:security:db` bez konfiguracije
**završava pogreškom**, umjesto da prijavi uspjeh preskočene provjere. Potreban je
nov namjenski lokalni klaster s `cluster_name = 'castme_security_test'`, bez
prethodnih `anon`, `authenticated` i `security_observer` uloga. Test provjerava
lokalni konfigurirani host, stvarnu serversku adresu, ime klastera i očekivani
`system_identifier` prije CREATE/DROP DATABASE ili ROLE. Koristite lokalnog
`postgres` superusera samo za taj testni klaster; nikad zajednički Supabase.

Primjer za novi lokalni klaster, iz `backend/`, uz PostgreSQL alate na PATH-u:

```powershell
$securityData = Join-Path $env:TEMP ('castme-security-' + [guid]::NewGuid().ToString('N'))
initdb -D $securityData -U postgres -A trust --encoding=UTF8 --locale=C
Add-Content (Join-Path $securityData 'postgresql.conf') "`nlisten_addresses='127.0.0.1'`nport=55437`ncluster_name='castme_security_test'"
pg_ctl -D $securityData -l (Join-Path $securityData 'server.log') -w start
$env:SECURITY_TEST_DATABASE_URL = 'postgresql://postgres@127.0.0.1:55437/postgres'
$env:SECURITY_TEST_CLUSTER_ID = (psql -h 127.0.0.1 -p 55437 -U postgres -d postgres -Atc 'SELECT system_identifier FROM pg_control_system()').Trim()
npm run test:security:db
pg_ctl -D $securityData -w stop
```

Port mora biti slobodan. Lokalni `trust` primjer koristite samo u namjenskom
okruženju s pouzdanim lokalnim korisnicima; klaster nije za aplikacijske podatke.
Test uklanja samo baze i uloge koje je sam stvorio. Prvo provjerava instalaciju
bez API uloga; zatim uz široke default grantove u testnim bazama i izravne
privatne grantove uspoređuje bootstrap, nadogradnju i stariji opseg. Koristi
neprazne retke, stvarni SET ROLE i SELECT/INSERT/UPDATE/DELETE, rollback,
ponovljivost, politike i serverske operacije. Dodatak nezaštićene tablice također
mora biti otkriven. [CI](../.github/workflows/database-security.yml) koristi
zaseban PostgreSQL 17 servis, bez produkcijskih tajni.

Izvršene naredbe, verzija i ograničenja navedeni su u
[zapisniku sigurnosne provjere](../docs/verification/2026-11-18/database-security.md).

## Nepotpuni nacrti casting oglasa

Migracija `migrations/20261104205039_casting_call_drafts.sql` omogućuje spremanje nepotpunog oglasa isključivo uz `status = 'draft'`.

| Polja | Nacrt (`draft`) | Svaki drugi status, uključujući `published` |
| --- | --- | --- |
| `title`, `description`, `location` | Mogu biti `NULL` ili prazna | Obavezna; sam razmak, tabulator ili novi red nije sadržaj |
| `positions_count` | Može biti `NULL`; unesena vrijednost mora biti pozitivna | Obavezan pozitivan cijeli broj |
| `min_age`, `max_age` | Mogu nedostajati neovisno; unesena dob mora biti barem 18 | Oba obavezna; `max_age >= min_age` |
| `application_deadline` | Može biti `NULL` | Obavezan |
| `max_applications` | Obavezan i pozitivan; zadano 1000 | Isto |
| `project_id`, `status` | Obavezni; projekt mora postojati | Isto |

Jedan oglas po projektu (`project_unique`) ostaje pravilo. Povezani projekt i dalje zahtijeva `title`, `project_type` i `org_id`; ova migracija mijenja samo `casting_calls`.

### Primjena na postojeću bazu

Preduvjet je ranije primijenjena migracija `casting_call_maxapp.sql` (ograničenja `age_range`, `positions_positive`, `max_applications_positive` i `project_unique`). Na bazi napravljenoj iz aktualnog `schema.sql` taj je preduvjet već zadovoljen; stare migracije ne treba ponovno izvršavati.

1. Provjerite da `backend/.env` pokazuje na namjeravanu bazu.
2. Prije migracije provjerite postojeće oglase koji nisu nacrti:

   ```sql
   SELECT id, status
   FROM casting_calls
   WHERE status <> 'draft' AND (
     title IS NULL OR title !~ '[^[:space:]]'
     OR description IS NULL OR description !~ '[^[:space:]]'
     OR positions_count IS NULL OR min_age IS NULL OR max_age IS NULL
     OR location IS NULL OR location !~ '[^[:space:]]'
     OR application_deadline IS NULL
   );
   ```

   Ako upit vrati retke, ispravite podatke prije primjene. Migracija neće izmišljati sadržaj niti mijenjati statuse oglasa.
3. Iz `backend/` pokrenite `npm run db:migrate:casting-drafts`. Alternativno izvršite cijelu SQL datoteku u SQL editoru, u shemi koja sadrži tablicu `casting_calls` (uobičajeno `public`).

Migracija je transakcijska, provjerava i postojeće retke te se može ponovno pokrenuti. Ako podaci krše novo ograničenje, sve se izmjene vraćaju. Čekanje na zaključavanje ograničeno je na 5 sekundi; ako migracija zbog toga ne uspije, ponovite je kada se smanji promet.

### Dogovor za backend koji sprema oglase

- U bazu šaljite engleske statuse `draft` i `published`; UI oznake `nacrt` i `objavljen` prevedite na granici API-ja.
- Nedostajuće brojeve i datum šaljite kao `NULL`, a ne kao `''`, `0` ili izmišljeni datum.
- Pri objavi provjerite sva obavezna polja i spremite podatke sa statusom u jednoj transakciji. Baza odbija i izravni `INSERT` nepotpunog objavljenog oglasa i `UPDATE` kojim se nepotpun nacrt objavljuje.
- Kršenje pravila potpunosti vraća PostgreSQL kod `23514` i ime ograničenja `casting_calls_complete_unless_draft`. API ga treba pretvoriti u razumljivu validacijsku poruku.
- Rok u budućnosti provjerava se u backendu u trenutku objave; nije dio trajnog `CHECK` ograničenja jer objavljeni oglasi s vremenom prirodno isteknu. Verifikacija poslodavca i dopušteni prijelazi statusa također ostaju odgovornost backenda.
- Trenutne casting rute sadrže dohvat oglasa; ova promjena priprema bazu za kolegin backend za spremanje i objavu.

### Provjera

Iz `backend/` pokrenite `npm run test:db:casting`. Test koristi PostgreSQL iz `backend/.env`, ali stvara i mijenja samo privremene tablice svoje veze; ne migrira zajedničke tablice i ne mijenja postojeće podatke. Pokriva početnu shemu i migraciju, objavu i uređivanje, pojedinačno nedostajuća polja, prazni tekst, ograničenja dobi/brojeva, veze i jedinstvenost, očuvanje postojećih podataka, ponovno pokretanje te povrat neuspjele migracije.
