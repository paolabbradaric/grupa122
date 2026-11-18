# Kandidatove prijave i povlačenje — API

Implementacija F-016 i F-026 iz `2-Analiza-zahtjeva.md` i issuea #16. Precizni prijelazi povlačenja nisu bili definirani u specifikaciji; za ovu implementaciju potvrđeno je povlačenje **prije održane audicije**, iz `SUBMITTED`, `UNDER_REVIEW`, `SHORTLISTED` i `INVITED` u `WITHDRAWN`.

## Dohvat vlastitih prijava

`GET /api/candidate/applications`

Potrebna je autentificirana sesija s ulogom `candidate`. Identitet se uzima iz sesije, bez parametra za odabir drugog kandidata. GET ne zahtijeva uključivanje upisa niti CSRF token.

Odgovor `200`:

```json
{
  "applications": [
    {
      "id": 31,
      "status": "INVITED",
      "coverLetter": "Motivacijsko pismo",
      "videoUrl": null,
      "rejectionReason": null,
      "submittedAt": "2026-11-12T10:00:00.000Z",
      "updatedAt": "2026-11-12T11:00:00.000Z",
      "castingId": 12,
      "roleTitle": "Glavna uloga",
      "castingStatus": "closed",
      "location": "Zagreb",
      "applicationDeadline": "2026-11-11T23:59:59.999Z",
      "projectId": 18,
      "projectTitle": "Primjer projekta",
      "projectType": "film"
    }
  ]
}
```

Prijave se vraćaju od najnovije prema najstarijoj, uz silazni ID za jednak datum. Obuhvaćene su i povučene, odbijene i prihvaćene prijave te oglasi koji više nisu javno objavljeni. Korisnik bez prijava ili profila dobiva `{ "applications": [] }`. Odgovor ne sadrži podatke drugih kandidata.

## Povlačenje vlastite prijave

`PATCH /api/candidate/applications/:applicationId/withdraw`

`applicationId` mora biti pozitivan PostgreSQL `INTEGER` (najviše 2147483647); veće vrijednosti vraćaju `400` prije DB veze.

Potrebni su sesija kandidata, dopušteni `Origin` i valjani `X-CSRF-Token`. JSON tijelo nije potrebno: cilj ove radnje uvijek je `WITHDRAWN`. Identitet, vlasništvo i ciljni status ne određuju se iz tijela zahtjeva.

Odgovor `200`:

```json
{
  "applicationId": 31,
  "oldStatus": "INVITED",
  "status": "WITHDRAWN"
}
```

| Trenutačni status | Povlačenje |
| --- | --- |
| `SUBMITTED`, `UNDER_REVIEW`, `SHORTLISTED`, `INVITED` | Dopušteno ako nema aktivne rezervacije |
| `AUDITIONED`, `ACCEPTED`, stari `SELECTED`, `REJECTED`, `WITHDRAWN` i nepoznati statusi | `409`, bez upisa |

Status oglasa i rok nisu dodatni uvjet povlačenja: to nije nova predaja prijave i ne otvara oglas. Oglas se ne mijenja. Prijava i njezina povijest ostaju u bazi; ponovno povlačenje vraća `409`. Postojeća zabrana duple prijave i brojanje ukupnih zapisa za `max_applications` ostaju nepromijenjeni. Povlačenje ne omogućuje novu prijavu na isti oglas. Eventualna promjena tih pravila zaseban je timski dogovor.

Upis `WITHDRAWN`, `updated_at` i retka u `application_status_history` s izvornim statusom i `changed_by` iz sesije čini jednu transakciju. Greška poništava cijelu promjenu. Zaključava se prvo oglas, zatim prijava, kao u postojećim poslodavčevim promjenama statusa i konačnom odabiru; vlasništvo se provjerava pri oba čitanja. Povučena prijava više nije podobna za poslodavčeve prijelaze ni konačni odabir.

## Odgovori i zaštite

| HTTP | Značenje |
| --- | --- |
| `400` | Neispravan ID; neispravan JSON ako se šalje |
| `401` | Nema autentificirane sesije |
| `403` | Korisnik nije kandidat ili Origin/CSRF provjera nije prošla |
| `404` | Prijava ne postoji ili pripada drugom kandidatu; isti odgovor u oba slučaja |
| `409` | Nedopušten status ili aktivna rezervacija audicije |
| `413` | Preveliko tijelo zahtjeva prema postojećoj aplikacijskoj zaštiti |
| `503` | Upisi su blokirani konfiguracijom ili potrebna DB zaštita nije spremna |
| `500` | Interna pogreška; odgovor ne otkriva podatke baze |

Povlačenje koristi istu konfiguracijsku zaštitu `getApplicationWritesEnabled` kao postojeća predaja prijave. Nisu uvedene nove zastavice za omogućavanje upisa niti je ublažena postojeća provjera baze i potvrde. `.env` se ne mijenja. Za spajanje frontenda ne uključivati upise u zajednički Supabase.

## Ovisnost o Lucijinu modulu audicija

Rezervacija je za ovu provjeru aktivna ako joj status nije `cancelled` ili `canceled`, jednako kao u postojećim provjerama audicija. Aktivna rezervacija **blokira povlačenje s 409**; rezervacije, termini i obavijesti pritom se ne mijenjaju. Već otkazana rezervacija ne blokira povlačenje i ostaje nepromijenjena.

Automatsko otkazivanje rezervacije, oslobađanje mjesta i slanje obavijesti nisu implementirani ovim zadatkom. Lucijine rute i modeli nisu mijenjani; nova DB zaštita provjerava i njegove buduće upise rezervacija. Dok ne postoji API za otkazivanje rezervacije, korisnik s aktivnom rezervacijom ne može dovršiti povlačenje ovom rutom.

Nova DB zaštita serijalizira stvaranje i reaktivaciju aktivne rezervacije preko retka prijave. Trigger na rezervaciji radi verzijski upis `id = id` na prijavi: poslovne vrijednosti, `updated_at` i povijest ostaju nepromijenjeni, ali nastaje nova verzija retka. Zatim odbija aktivnu rezervaciju na `WITHDRAWN` prijavi. Trigger na prijavi odbija povlačenje uz aktivnu rezervaciju. Time se štite oba redoslijeda konkurentnog INSERT-a/UPDATE-a, uključujući zastarjele `REPEATABLE READ` transakcije koje dobivaju grešku serijalizacije. API za povlačenje izričito koristi `READ COMMITTED`.

Obje funkcije su `SECURITY INVOKER`, s fiksnim `search_path=pg_catalog` i kvalificiranjem tablica prema shemi triggera. Ne podižu ovlasti, ne isključuju RLS i ne dodjeljuju nove privilegije. Pozivatelj upisa rezervacija mora imati odgovarajuće postojeće SELECT/UPDATE ovlasti na prijavi; inače se upis odbija.

Buduća rezervacija i dalje treba u transakciji zaključati isti oglas pa prijavu, provjeriti vlasništvo, `INVITED`, termin i kapacitet. Nova zaštita rješava sukob s povlačenjem; ne zamjenjuje Lucijina pravila rezervacije i obavijesti. Samo provjera statusa prije otvaranja transakcije nije dovoljna.

## Obavezna migracija prije omogućavanja povlačenja

Za postojeću bazu uključena je ponovljiva transakcijska migracija `db/migrations/20261112_candidate_withdrawal_booking_guard.sql`. Početni `db/schema.sql` sadrži iste funkcije i triggere za novu bazu. Migracija ne popravlja niti briše postojeće podatke: ako već postoji aktivna rezervacija uz `WITHDRAWN`, prekida se i poništava cijelu instalaciju. Takve zapise treba zasebno razriješiti prema dogovoru tima.

PATCH provjerava jesu li oba očekivana triggera uključena i koriste li funkcije bez podizanja ovlasti te je li sesija u standardnom `origin` režimu. Ako zaštita nedostaje ili je isključena, vraća `503` i radi rollback bez promjene prijave i povijesti. GET nastavlja raditi. Migracija se ne pokreće automatski iz aplikacije.

Migracija je testirana samo u jednokratnoj vlastitoj shemi lokalnog `castme_test`, koja se briše nakon testa. Nije primijenjena na zajednički Supabase niti na postojeće lokalne poslovne tablice. Kontrolirana primjena migracije u ciljnom okruženju obavezna je prije uključivanja upisa; ovaj pregled to ne izvršava.

## Povezivanje s Nininim frontendom i bilješka za Taru

- Nina: `CandidateApplications` treba dohvatiti ovaj GET, koristiti podatke iz `applications` i osvježiti prijavu nakon uspješnog PATCH-a. Ne skrivati završene/povučene prijave. Za radnju slati postojeću sesiju i CSRF; prikazati 409 za aktivnu rezervaciju. Frontend ovim zadatkom nije mijenjan.
- Tara: poslodavčev pregled još koristi stari odabir `SUBMITTED → SELECTED`; stvarni odabir je `AUDITIONED → ACCEPTED`. Treba prikazati i `WITHDRAWN` te ga izuzeti iz radnji. Brojanje odabranih uključuje `ACCEPTED` i stare `SELECTED` zapise. Poslodavčev PATCH statusa i dalje koristi `{ status, rejectionReason? }` te zasebnu rutu; helper mora podržati JSON tijelo i `Content-Type`. Bilješka nije poslana članovima tima.

## Testiranje

Relevantni testovi: `node --test test/candidateApplications.test.js test/candidateApplicationsRoute.test.js test/candidateApplicationsDatabase.test.js`, zatim `npm test` iz `backend`.

DB integracija zadano je preskočena. Uključuje se samo uz `CANDIDATE_APPLICATIONS_DB_TESTS=1`, `PGHOST=127.0.0.1`, `PGPORT=5432`, `PGDATABASE=castme_test`, `PGSSL=false` i odgovarajući lokalni račun. Prije prvog upisa provjeravaju se i stvarni naziv baze i loopback adresa servera. Test stvara vlastitu jednokratnu shemu s početnim tablicama i migracijom te na kraju briše samo tu shemu i vlastite testne podatke. HTTP testovi s mockovima ne koriste stvarnu bazu.

## Rezultat završnog pregleda

Pregled 12. 11. 2026. na branchu `codex/tin-moje-prijave`, izvedenom iz čistog commita `59dc9ee`.

- Potvrđena i ispravljena utrka: konkurentna reaktivacija rezervacije mogla je ostaviti aktivnu rezervaciju uz `WITHDRAWN`. Regresijski test prije ispravka padao je upravo na tom stanju.
- Dodana je DB zaštita oba smjera upisa, provjera dostupnosti migracije te validacija granice PostgreSQL ID-ja.
- Ciljani testovi: **66 uspješnih, 0 neuspješnih, 0 preskočenih**.
- Cijeli backend (`npm test`): **213 ukupno, 205 uspješnih, 0 neuspješnih, 8 preskočenih** postojećih opcionalnih DB integracija.
- Provjeravaju se oba redoslijeda konkurentnog upisa, INSERT, reaktivacija, zastarjeli REPEATABLE READ snapshot, izravni SQL, isključena zaštita, ponovljivost i neuspjeh migracije, vlasništvo, rollback i HTTP zaštite.
- Frontend, `.env`, Lucijine rute/modeli i zajednička baza nisu mijenjani. Nema commita, pusha, mergea ni PR-a.

## Završno spremanje rada

Pri završnom spremanju 12. 11. 2026. migracija nije izvršavana, a sve DB integracijske zastavice bile su isključene. Ciljani testovi: **48 uspješnih, 0 neuspješnih, 1 DB test preskočen**. Cijeli backend: **196 ukupno, 187 uspješnih, 0 neuspješnih, 9 DB integracija preskočeno**. `git diff --check` prolazi. Raniji rezultati lokalne DB provjere iz prethodnog odjeljka ostaju zasebno evidentirani.

Prije aktivacije u ciljnom okruženju obavezni su pregled i dogovor s Mariom o kontroliranoj migraciji. Bez instalirane DB zaštite PATCH vraća 503.
