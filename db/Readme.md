
# Baza podataka

`schema.sql` služi za novu, praznu bazu. Postojeće baze nadograđuju se datotekama iz `migrations/`.

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
