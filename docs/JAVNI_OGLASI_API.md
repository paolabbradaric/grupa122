# Javni oglasi i filtri

API za F-008 (prije objedinjavanja zahtjeva: F-011–F-013). Obje rute su javne, bez sesije ili CSRF tokena, i vraćaju
samo `published` oglase. Ne vraćaju podatke kandidata, prijava, kontakte
organizacije ni interne limite prijava. Nema promjene pravila isteka roka:
oglas sa statusom `published` ostaje vidljiv i nakon roka, ali postojeći POST
prijave odbija zakašnjelu prijavu. Automatiku isteka treba dogovoriti zasebno.

`accepted_count` je JSON broj: broj prijava tog oglasa u `ACCEPTED` ili starom
`SELECTED` statusu; bez takvih prijava vraća 0. Vraća se u popisu i detaljima,
bez podataka pojedinih kandidata. `POST /api/castings/:id/applications` ponovno
provjerava rok i popunjenost na backendu nakon zaključavanja oglasa. Ako je rok
istekao (uključujući točan trenutak isteka) ili je broj prihvaćenih dosegnuo
`positions_count`, vraća 409 bez prijave, čak i ako je raniji GET pokazivao mjesto.
Broj prihvaćenih i `max_applications` zasebni su uvjeti. Tijelo `{}` je dopušteno;
`coverLetter` i `videoUrl` ostaju opcionalni.

## Popis

`GET /api/castings`

Odgovor `200` je JSON polje, odnosno `[]` kada nema rezultata. Postojeća polja
`id`, `title`, `description`, `location`, `positions_count` i
`application_deadline` zadržana su. Primjer jednog elementa:

```json
{
  "id": 12,
  "title": "Glavna uloga",
  "description": "Opis uloge",
  "location": "Zagreb",
  "positions_count": 2,
  "accepted_count": 0,
  "application_deadline": "2026-12-01T18:00:00.000Z",
  "status": "published",
  "project_id": 8,
  "project_title": "Projekt Mjesec",
  "project_type": "film",
  "projectTitle": "Projekt Mjesec",
  "roleTitle": "Glavna uloga",
  "projectType": "film",
  "project_description": "Opis projekta",
  "audition_text": "Tekst za audiciju",
  "min_age": 18,
  "max_age": 35,
  "appearance_req": null,
  "exp_req": "Plesno iskustvo"
}
```

`projectTitle`, `roleTitle` i `projectType` su dodatni aliasi za postojeće
frontend potrošače. `title`/`description` i dalje označavaju ulogu, a
`project_title`/`project_description` projekt. Opcionalni tekstovi mogu biti
`null`. Zasebna polja za žanr i scenarij nisu dodana u bazu;
`audition_text` predstavlja postojeći tekst audicije.

| Query parametar | Pravilo |
| --- | --- |
| `location` | Najviše 200 znakova; postojeći PostgreSQL ILIKE uzorak, bez razlikovanja velikih slova. `Zagreb` je cijela lokacija, `Zag%` je prefiks. |
| `search` | Najviše 200 znakova; dio naziva uloge **ili projekta**, bez razlikovanja velikih slova. Postojeći ILIKE znakovi `%` i `_` ostaju podržani. |
| `projectType` | Najviše 20 znakova; točno podudaranje vrste projekta, bez razlikovanja velikih slova. Nije uveden novi popis dopuštenih vrsta. |
| `age` | Cijeli broj 18–2147483647, najviše 10 znakova; tražena dob mora biti unutar uključivog intervala `min_age`–`max_age`. |
| `requirements` | Najviše 1000 znakova; doslovni dio `appearance_req` **ili** `exp_req`, bez razlikovanja velikih slova. `%`, `_` i `\` ovdje su obični znakovi. |

Filtri se kombiniraju s AND. Tekst se obrezuje; prazan filtar se zanemaruje.
Svaki parametar smije imati samo jednu tekstualnu vrijednost. Nepoznati
parametri, ponovljeni ključevi, nizovi/objekti, predugačak tekst ili nevaljana
dob vraćaju `400` s `{ "error": "..." }` prije SQL upita. Svi upiti su
parametrizirani. Redoslijed je `created_at DESC, id DESC`; nema paginacije.

Primjer kombinacije:

```text
/api/castings?search=Mjesec&location=Zagreb&projectType=film&age=25&requirements=ples
```

## Detalji

`GET /api/castings/:id`

Odgovor `200` je jedan objekt istih polja kao element popisa. ID mora biti
pozitivan decimalni cijeli broj do 2147483647; inače `400`.
Nepostojeći oglas i oglas koji nije `published` jednako vraćaju `404`:

```json
{ "error": "Casting oglas nije pronađen." }
```

Greške baze vraćaju `500` s generičnim `error` tekstom, bez SQL poruke.

## Frontend integracija

Na mainu `2ca2602` nalazi se Ninin [PR #59](https://github.com/paolabbradaric/grupa122/pull/59):
`Home` šalje filtre `location`, `age` i `requirements` ovom API-ju. Višestruki
odabir tipova projekta i pretraga iz navigacije filtriraju dohvaćene rezultate
lokalno; ne šalju ponovljene `projectType` parametre. Detalji koriste javni GET
i povezuju predaju prijave s postojećom sesijom i CSRF tokenom. Ovo je potvrda
iz koda; nije nova potvrda cijelog produkcijskog UI tijeka.

Ranija profilna greška `42P01` obrađena je kroz PR #56 i kontroliranu primjenu
profilne/moderacijske sheme. Nije preostala migracijska obveza javnih oglasa.
Aktualne provjere i otvorena pitanja vodi [Tinov status backenda](TIN_BACKEND_STATUS.md).
