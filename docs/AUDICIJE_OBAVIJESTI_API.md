# Audicije, rezervacije, obavijesti i administratorski pregled

Backend nadogradnja od 18. 11. 2026. Frontend ovim zadatkom nije mijenjan.
Sve privatne rute zahtijevaju postojeću Passport sesiju. Mutacije zahtijevaju
dopušteni Origin i `X-CSRF-Token`. Identitet i uloga dolaze iz sesije.

## Termini audicije

- `GET /api/auditions/:castingId`: poslodavcu vlasniku vraća njegove termine;
  kandidatu samo za njegovu `INVITED` prijavu na `published`/`closed` oglas.
  Tuđi/nepostojeći oglas vraća 404. Ispravlja se prethodni 403 poslodavcu.
- `POST /api/auditions/:castingId`: vlasnik `published` ili `closed` oglasa;
  tijelo `{ "starts_at": "2099-01-01T10:00:00Z", "ends_at": "2099-01-01T11:00:00Z", "location": "Zagreb", "capacity": 3 }`.
  Datumi moraju imati vremensku zonu i biti valjani, početak u budućnosti,
  završetak nakon početka, lokacija 1–200 znakova, kapacitet pozitivan PostgreSQL INT.
  Odgovor 201 je `{ id, starts_at, ends_at, location, capacity, status: "scheduled" }`.
- `PATCH /api/auditions/:castingId/slots/:slotId/cancel`: vlasnik otkazuje budući
  `scheduled` termin. Otkazuju se i njegove aktivne rezervacije, uz obavijesti.
  Odgovor 200 je `{ id, status: "cancelled", message: "Termin je otkazan." }`.

GET vraća JSON polje objekata `{ id, starts_at, ends_at, location, capacity,
status, availablePlaces }`; nema podataka drugih kandidata. Prazan rezultat je `[]`.
POST/PATCH poštuju poslodavčevu write zastavicu, uz 503 kada je isključena.

## Kandidatova rezervacija

- `GET /api/candidate/applications/:applicationId/booking` vraća
  `{ "booking": null }` ili posljednju vlastitu rezervaciju:
  `{ "booking": { "id": 1, "status": "booked", "attendanceStatus": null,
  "slotId": 7, "startsAt": "2099-01-01T10:00:00.000Z", "endsAt": "2099-01-01T11:00:00.000Z", "location": "Zagreb" } }`.
  Povijesna otkazana rezervacija može biti posljednja.
- `PUT /api/candidate/applications/:applicationId/booking`, tijelo
  `{ "slotId": 7 }`: rezervira slobodan budući termin ili atomski mijenja
  postojeći budući termin. Samo vlasnik prijave u `INVITED`, samo njegov oglas
  u `published`/`closed`, samo `scheduled` termin s kapacitetom.
  Odgovor 200: `{ "booking": { "id": 1, "status": "booked", "slotId": 7 } }`.
  Ponavljanje istog termina vraća istu rezervaciju bez nove obavijesti.
  Ako je novi termin pun, stara rezervacija ostaje sačuvana rollbackom.
- `DELETE /api/candidate/applications/:applicationId/booking` otkazuje aktivnu
  buduću vlastitu rezervaciju. Odgovor 200: `{ "id": 1, "status": "cancelled" }`.

Kandidatove mutacije koriste iste write potvrde kao predaja/povlačenje.
Nepostojeća i tuđa prijava jednako daju 404. Nedopušten status/puni ili započeti
termin daje 409. Nedostajuća/isključena DB zaštita rezervacija daje 503.
Povlačenje prijave i dalje odbija aktivnu rezervaciju s 409: kandidat je prvo
mora otkazati ovim DELETE-om. Povučena prijava ne omogućuje ponovnu predaju.

## Poslodavčev pregled i dolazak

- `GET /api/employer/castings/:castingId/bookings`: vlasniku vraća
  `{ bookings: [{ id, status, attendanceStatus, applicationId, slotId, startsAt,
  firstName, lastName }] }`.
- `PATCH /api/employer/castings/:castingId/bookings/:bookingId/attendance`,
  tijelo `{ "attendanceStatus": "attended" }` ili `"absent"`. Samo vlasnik,
  samo aktivna rezervacija nakon početka audicije. Odgovor
  `{ id, attendanceStatus }`. Ponovljena ista oznaka ne šalje duplu obavijest.

Oznaka dolaska ne preskače zaseban poslovni PATCH statusa prijave: poslodavac
nastavlja postojeći tijek do `AUDITIONED`, pa konačni odabir `ACCEPTED`.

## Potvrđena pravila završetka oglasa

Korisnik je izričito potvrdio:

- `filled`: preostale nezavršene prijave postaju `REJECTED` s automatskim
  razlogom. `ACCEPTED`, stari `SELECTED`, `WITHDRAWN`, `REJECTED` i `CANCELLED`
  ostaju nepromijenjeni.
- `cancelled`: nepovučene prijave osim već odbijenih/otkazanih postaju
  `CANCELLED`, uključujući ranije prihvaćene. Povijest bilježi prethodni status,
  razlog i korisnika koji je pokrenuo promjenu.
- U oba slučaja budući termini i njihove aktivne rezervacije postaju
  `cancelled`; rezervirani kandidati dobivaju obavijest. Povijesni termini i
  rezervacije održanih audicija ostaju sačuvani.
- Zatvaranje prijava u `closed` i dalje ne otkazuje audicije.
- Odbijanje pojedine prijave također otkazuje njezinu buduću aktivnu rezervaciju.

Promjena oglasa, prijava, povijesti, rezervacija i obavijesti jedna je
transakcija. Greška obavijesti/povijesti poništava sve poslovne promjene.

## Obavijesti

`GET /api/notifications?limit=50&before=123&unread=true`

Vraća `{ notifications: [{ id, type, title, message, isRead, createdAt,
applicationId, castingId, bookingId }] }` samo trenutnom kandidatu/poslodavcu.
`limit` je 1–100 (zadano 50), `before` pozitivan ID, `unread` true/false
(zadano false). Nepoznati i višestruki parametri vraćaju 400. Sljedeća stranica
koristi zadnji ID kao `before`; manje od `limit` redaka znači kraj.

`PATCH /api/notifications/:id/read` vraća `{ id, isRead: true }`; tuđa/nepostojeća
obavijest jednako daje 404. Svaki odgovor ima `Cache-Control: no-store`.
Statusne promjene, povlačenje, prihvaćanje, završetak oglasa te rezervacije i
promjene audicija stvaraju obavijesti u istoj transakciji. E-pošta se ne šalje:
F-034 još nema odabranog pružatelja ni ugovorenih događaja dostave.

## Admin pregled pojedinačnih prijava

`GET /api/admin/castings/:castingId/applications`

Vraća `{ casting: { id, title, status }, applications: [...] }` istog izričitog
skupa kao vlasnikov pregled: id/status, coverLetter/videoUrl/submittedAt,
candidateId, firstName/lastName, city/country/bio/experience. Nema pristupnih
podataka, e-mailova ni internih Google identiteta. Nepostojeći oglas daje 404.
Zahtijeva postojeći provjereni Google admin identitet, DB admin ulogu i
konfiguriranu allowlistu. Ne otvara poslodavčeve mutacije administratoru.

## DB zaštita i aktivacija

Redoslijed zaključavanja je oglas → prijava → termin → rezervacija. SQL
migracija `20261118_audition_booking_capacity.sql` dodaje jedinstven indeks za
jednu aktivnu rezervaciju po prijavi i SECURITY INVOKER trigger kapaciteta,
statusa i pripadnosti istom oglasu. No-op verzijski upis retka oglasa zatvara
utrku i sa zastarjelim REPEATABLE READ snapshotom; takav pisac dobiva 40001.
Ne mijenja poslovne vrijednosti retka. API koristi READ COMMITTED i vraća 409
pri konkurentnom konfliktu. Ne zaobilazi se RLS niti mijenjaju vlasništva.

Migracija odbija postojeće duple aktivne rezervacije ili prekoračene kapacitete
bez njihova automatskog popravljanja/brisanja. Primjena je odvojena od builda.
Prije kandidatove aktivacije potrebni su i
`20261112_candidate_withdrawal_booking_guard.sql` te
`20261118_application_submission_rate_limit.sql`. Produkcijska aktivacija
zahtijeva ENABLED, CONFIRMED, ALLOW_REMOTE i TLS; preview ostaje bez upisa.

## Testovi

`backendCompletionRoutes.test.js` provjerava auth, role, Origin/CSRF, write
zastavice, granice ID-jeva, privatnost obavijesti i admin allowlistu.
`backendCompletionDatabase.test.js` provjerava stvarni SQL i HTTP cijelog
životnog ciklusa, konkurentne kapacitete, direktni SQL, stari snapshot,
promjenu punog termina, povlačenje, povijest, rollback i zatvaranje oglasa.
Opt-in `BACKEND_COMPLETION_DB_TESTS=1` zahtijeva eksplicitni lokalni
`castme_test`; Docker CI dodatno potvrđuje adresu i identitet namjenskog klastera.
