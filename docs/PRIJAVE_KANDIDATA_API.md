# Kandidatove prijave i povlačenje — API

Za javni popis i detalje oglasa vidi [Javni oglasi API](JAVNI_OGLASI_API.md).
Postojeći POST predaje prijave sada ima zasebno
[ograničenje pokušaja i migraciju brojača](OGRANICENJE_PRIJAVA_API.md).
GET vlastitih prijava i PATCH povlačenja ne troše tu kvotu.

Aktualno stanje implementacije, migracija i otvorenih provjera vodi se u [Tinov status backenda](TIN_BACKEND_STATUS.md), ažurirano 18. 11. 2026. Povijesni rezultati na kraju dokumenta odnose se na označene datume.

Implementacija F-010 iz `2-Analiza-zahtjeva.md` i issuea #16 (prije objedinjavanja: F-016 i F-026). Precizni prijelazi povlačenja nisu bili definirani u specifikaciji; za ovu implementaciju potvrđeno je povlačenje **prije održane audicije**, iz `SUBMITTED`, `UNDER_REVIEW`, `SHORTLISTED` i `INVITED` u `WITHDRAWN`.

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
| `AUDITIONED`, `ACCEPTED`, stari `SELECTED`, `REJECTED`, `WITHDRAWN`, `CANCELLED` i nepoznati statusi | `409`, bez upisa |

Status oglasa i rok nisu dodatni uvjet povlačenja: to nije nova predaja prijave i ne otvara oglas. Oglas se ne mijenja. Prijava i njezina povijest ostaju u bazi; ponovno povlačenje vraća `409`. Postojeća zabrana duple prijave i brojanje ukupnih zapisa za `max_applications` ostaju nepromijenjeni. Povlačenje ne omogućuje novu prijavu na isti oglas. Eventualna promjena tih pravila zaseban je timski dogovor.

Upis `WITHDRAWN`, `updated_at`, retka u `application_status_history` s izvornim statusom i `changed_by` iz sesije te privatne obavijesti kandidatu čini jednu transakciju. Greška poništava cijelu promjenu. Zaključava se prvo oglas, zatim prijava, kao u postojećim poslodavčevim promjenama statusa i konačnom odabiru; vlasništvo se provjerava pri oba čitanja. Povučena prijava više nije podobna za poslodavčeve prijelaze ni konačni odabir.

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

Povlačenje koristi istu konfiguracijsku zaštitu `getApplicationWritesEnabled` kao predaja prijave: ENABLED i CONFIRMED, a za udaljenu bazu dodatno ALLOW_REMOTE i TLS. Produkcijski upisi kontrolirano su aktivirani 18. 11. 2026. nakon migracija; preview nije aktiviran. Uključivanje opt-in DB testova i dalje je dopušteno samo na potvrđenoj izoliranoj lokalnoj testnoj bazi.

## Ovisnost o Lucijinu modulu audicija

Rezervacija je za ovu provjeru aktivna ako joj status nije `cancelled` ili `canceled`, jednako kao u postojećim provjerama audicija. Aktivna rezervacija **blokira povlačenje s 409**; rezervacije, termini i obavijesti pritom se ne mijenjaju. Već otkazana rezervacija ne blokira povlačenje i ostaje nepromijenjena.

Povlačenje samo ne otkazuje aktivnu rezervaciju. Za prethodno otkazivanje vlastite buduće rezervacije postoji `DELETE /api/candidate/applications/:applicationId/booking`; taj API oslobađa mjesto i zapisuje obavijesti u istoj transakciji. Booking rute i model nadograđeni su u PR-u #58; vidi [audicije i obavijesti](AUDICIJE_OBAVIJESTI_API.md). Povlačenje i dalje vraća 409 dok je rezervacija aktivna.

Nova DB zaštita serijalizira stvaranje i reaktivaciju aktivne rezervacije preko retka prijave. Trigger na rezervaciji radi verzijski upis `id = id` na prijavi: poslovne vrijednosti, `updated_at` i povijest ostaju nepromijenjeni, ali nastaje nova verzija retka. Zatim odbija aktivnu rezervaciju na `WITHDRAWN` prijavi. Trigger na prijavi odbija povlačenje uz aktivnu rezervaciju. Time se štite oba redoslijeda konkurentnog INSERT-a/UPDATE-a, uključujući zastarjele `REPEATABLE READ` transakcije koje dobivaju grešku serijalizacije. API za povlačenje izričito koristi `READ COMMITTED`.

Obje funkcije su `SECURITY INVOKER`, s fiksnim `search_path=pg_catalog` i kvalificiranjem tablica prema shemi triggera. Ne podižu ovlasti, ne isključuju RLS i ne dodjeljuju nove privilegije. Pozivatelj upisa rezervacija mora imati odgovarajuće postojeće SELECT/UPDATE ovlasti na prijavi; inače se upis odbija.

Booking model sada u transakciji zaključava isti oglas pa prijavu, provjerava vlasništvo, `INVITED`, termin i kapacitet. Dodatni capacity guard i jedinstveni indeks iz PR-a #58 štite rezervacije na razini baze; zaštita povlačenja ostaje aktivna. Samo provjera statusa prije otvaranja transakcije nije dovoljna.

## Obavezna migracija prije omogućavanja povlačenja

Za postojeću bazu uključena je ponovljiva transakcijska migracija `db/migrations/20261112_candidate_withdrawal_booking_guard.sql`. Početni `db/schema.sql` sadrži iste funkcije i triggere za novu bazu. Migracija ne popravlja niti briše postojeće podatke: ako već postoji aktivna rezervacija uz `WITHDRAWN`, prekida se i poništava cijelu instalaciju. Takve zapise treba zasebno razriješiti prema dogovoru tima.

PATCH provjerava jesu li oba očekivana triggera uključena i koriste li funkcije bez podizanja ovlasti te je li sesija u standardnom `origin` režimu. Ako zaštita nedostaje ili je isključena, vraća `503` i radi rollback bez promjene prijave i povijesti. GET nastavlja raditi. Migracija se ne pokreće automatski iz aplikacije.

Migracija je provjerena na izoliranoj lokalnoj bazi i u CI-ju. Dana 18. 11. 2026. primijenjena je i na potvrđeni zajednički Supabase, u jednoj kontroliranoj transakciji s migracijama brojača, booking kapaciteta i sigurnosti, uz korisnikovo izričito odobrenje. Postojeći poslovni retci sačuvani su; provjereni su omogućeni invoker triggeri, indeks i RLS. To ne mijenja zabranu pokretanja integracijskih testova s upisima nad zajedničkom bazom.

## Povezivanje s Nininim frontendom i bilješka za Taru

- Rein PR #66 sada povezuje `CandidateApplications` s ovim GET-om i PATCH-om povlačenja, uz postojeću sesiju, CSRF i prikaz 409. Povezani su i dohvat obavijesti te oznaka pročitanosti. Potvrđeno iz koda maina `c05f46f`; završni produkcijski UI prihvat ostaje otvoren. Frontend ovim backend zadatkom nije mijenjan.
- Tara: PR #62 već povezuje statusni PATCH i konačni odabir `AUDITIONED → ACCEPTED`, prikazuje i završne statuse te koristi JSON helper sa sesijom i CSRF-om. Brojanje odabranih uključuje `ACCEPTED` i stare `SELECTED` zapise. To je potvrđeno iz koda aktualnog maina; cijeli produkcijski UI tijek još treba provjeriti.

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

Ovaj odjeljak opisuje spremanje rada 12. 11. 2026. Naknadna kontrolirana produkcijska primjena i aktivacija 18. 11. evidentirane su u [aktualnom statusu](TIN_BACKEND_STATUS.md). Za novo ciljno okruženje i dalje su obavezni pregled i kontrolirana migracija; bez instalirane DB zaštite PATCH vraća 503.
