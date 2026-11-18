# Verifikacija tvrtki i moderacija — Paolin dio (#14)

Poslodavac iz profila šalje podatke tvrtke na provjeru. Administrator u panelu preuzima zahtjev, odobrava ga ili odbija s razlogom. Kandidat ili drugi poslodavac može prijaviti objavljeni oglas. Administrator zatvara neutemeljenu prijavu ili potvrđuje trajno uklanjanje oglasa. Panel prikazuje podatke iz PostgreSQL baze, uključujući statistiku.

Registracija računa/organizacije, Google prijava i uređivanje profila koriste postojeće Mariove module. Nema nove registracije ni alternativnog admin računa.

## Pokretanje

Za postojeću bazu trebaju biti primijenjene prethodne migracije autentifikacije, profila i admin pristupa. Nova baza može koristiti cijeli `db/schema.sql`. Zatim u `backend`:

```bash
npm ci
npm run db:migrate:moderation
npm start
```

Migracijska skripta koristi privatni `backend/.env` i jednu SQL transakciju. Prije pokretanja provjeriti ciljnu vezu. Migracija dodaje snimku poslanih podataka, tablicu prijava, audit i red za čišćenje; čuva stare korisnike, verifikacije i njihove autore. Može se ponoviti. Nije automatski primijenjena na zajedničku bazu.

Frontend iz `frontend` pokrenuti s `npm ci` i `npm run dev`. Koriste se postojeći `useAuth`, CSRF token i Vite proxy; nema novih tajni ni `VITE_*` ključeva.

## API ugovor

Sve putanje počinju s `/api`. Promjene trebaju aktivnu sesiju, dopušten `Origin` i `X-CSRF-Token`. Admin koristi postojeći `requireAdmin` s provjerenim Google identitetom i privatnim `ADMIN_EMAILS`; samo DB uloga nije dovoljna. Backend postavlja `Cache-Control: no-store`.

| Metoda i putanja | Uloga | Tijelo / rezultat |
| --- | --- | --- |
| `GET /employer/verification` | poslodavac | `{ verification: zapis ili null }` vlastite prve organizacije, kao i profil |
| `POST /employer/verification` | poslodavac | `{}`; vraća `201 { verification }` |
| `GET /admin/verifications` | admin | `{ items, hasMore }`, samo posljednji zahtjev po aktivnoj organizaciji |
| `PATCH /admin/verifications/:id` | admin | `{ status: "under_review" }`, `{ status: "approved" }` ili `{ status: "rejected", reason }` |
| `POST /castings/:id/reports` | kandidat / poslodavac | `{ reason }`; `201 { report }` |
| `GET /admin/reports` | admin | `{ items, hasMore }` |
| `PATCH /admin/reports/:id` | admin | `{ status: "dismissed", reason }`; trajno zatvaranje bez brisanja |
| `DELETE /admin/castings/:id` | admin | `{ reason, confirmation: "OBRIŠI 123" }` za ID 123; `{ deleted, castingId, cleanupQueued }` |
| `GET /admin/stats` | admin | stvarni agregati bez osobnih podataka |

Popisi prihvaćaju `status`, `limit` (1–100, zadano 50) i `offset` (zadano 0). Postojeći panel učitava popise u stranicama od 100 zapisa, a zadržava postojeće prikaze zahtjeva, odbijenih zahtjeva i prijavljenih oglasa. Razlozi su obavezni, 1–2000 znakova nakon uklanjanja rubnih razmaka. Nepoznata polja tijela se odbijaju; `orgId`, `reporterId` i `reviewedBy` nikada se ne preuzimaju iz preglednika. Vlasnik, prijavitelj i obrađivač dolaze iz sesije.

`401` znači neprijavljenu sesiju, `403` pogrešnu ulogu/Google dokaz/CSRF, `404` nedostupan zapis, `409` sukob ili već obrađen zahtjev, `429` previše zahtjeva. Poslodavčevo slanje i prijavljivanje dijele ograničenje od 20 pokušaja po računu u 15 minuta po procesu. Za više backend instanci potreban je zajednički rate-limit store.

## Verifikacija i istodobni rad

Redoslijed je `pending → under_review → approved/rejected`. Prijelaz u provjeru bilježi stvarnog administratora; završnu odluku može donijeti taj administrator. Nije dopušteno prepisati tuđu ili završenu odluku. Nakon odbijanja poslodavac šalje novi zapis; povijest ostaje sačuvana. Već odobrena organizacija ne šalje novi zahtjev.

Organizacija se zaključava tijekom slanja i obrade, što sprječava dva aktivna zahtjeva i dvije završne odluke. I uređivanje profila zaključava istu organizaciju. Obrada verifikacije prije organizacije zaključava vlasnikov korisnički zapis, istim redoslijedom kao spremanje profila, kako se istodobni upisi ne bi međusobno blokirali. Spremanje zahtjeva uključuje snimku naziva, OIB-a, kontakta, telefona, weba i sjedišta. Ako su podaci naknadno promijenjeni, odobrenje vraća `409`; administrator odbija zahtjev i traži novo slanje. Stari zahtjev bez snimke može se preuzeti i odbiti, ali za odobrenje treba novi zahtjev. Stare završene odluke ostaju valjane.

Profil i postojeća objava oglasa koriste isti poredak posljednje odluke: `submitted_at DESC, id DESC`. Neverificirani poslodavac može imati nacrt; objava provjerava `approved`. Postojeća ograničenja upisa oglasa u Tinovu modulu ostaju dio njegove konfiguracije.

Ako administrator koji je preuzeo zahtjev više ne sudjeluje u obradi, prije opoziva njegova pristupa treba dovršiti ili odbiti preuzete zahtjeve; automatsko preuzimanje tuđih zahtjeva nije uvedeno.

## Prijave i brisanje

Prijavljuje se samo objavljeni tuđi oglas. Sama prijava ne skriva oglas i ne mijenja njegov status. Jedan korisnik može imati najviše jednu otvorenu prijavu po oglasu; djelomični jedinstveni indeks štiti i konkurentne upise. Administrator može zatvoriti prijavu uz razlog, bez brisanja oglasa.

Brisanje zahtijeva razlog i točnu tekstualnu potvrdu s ID-jem oglasa. Jedna transakcija zaključava oglas/projekt, prijave i termine, zatim izričito obrađuje obavijesti povezane sa starim zapisima, rezervacije, termine, povijest prijava, privitke, prijave, vještine i povijest oglasa, sam oglas i njegov projekt ako nema drugih oglasa. Nema slijepog `CASCADE` brisanja.

Korisnici, kandidatski profili, organizacije i vještine ostaju. Prijave neprimjerenog sadržaja zadržavaju naslov, razlog i odluku za audit, ali gube FK na obrisani oglas. Otvorene dobivaju status `removed`; prethodno zatvorene zadržavaju raniju odluku i obrađivača.

Vlasniku oglasa i pogođenim kandidatima sprema se po jedna nova obavijest u postojeću tablicu `notifications`, bez FK na uklonjene zapise. Verifikacijska završna odluka također stvara obavijest. Prikaz obavijesti i slanje e-pošte pripadaju Lucijinu modulu; ovdje se ne tvrdi da je e-pošta poslana (`email_sent_at` ostaje prazan).

Audit bilježi obrađivača, radnju, ID, razlog i vrijeme u privatnoj tablici. Sve SQL promjene, audit i obavijesti poništavaju se ako neki korak ne uspije. Ponovljeno brisanje vraća `404` i ne šalje nove obavijesti.

## Datoteke i oporavak

Nakon uklanjanja privitka brišu se samo metapodaci medija bez drugih `application_files` ili `profile_media` referenci. Dijeljene slike, avatari i portfolio ostaju. Ključ se stavlja u privatni trajni red samo ako više nijedan `media_files` zapis ne koristi taj objekt.

Vanjska pohrana nije dio SQL transakcije. Datoteke se zato uklanjaju tek nakon uspješnog COMMIT-a, zasebnim održavanjem:

```bash
cd backend
npm run media:cleanup:moderation
```

Pokretati redovito na poslužitelju i ponovno nakon oporavka pohrane. Skripta koristi postojeći privatni bucket iz `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` i `PROFILE_STORAGE_BUCKET`. Trenutni privitci koriste isti medijski sustav kao profili. Za buduću podršku drugim bucketima treba proširiti metapodatke i worker.

Worker ponovno provjerava reference, zaključava posao s `SKIP LOCKED`, briše objekt te uklanja posao i eventualni zapis u `profile_storage_objects`. Neuspjeh ostavlja posao i povećava broj pokušaja; ponovljeno uklanjanje već nestalog objekta je sigurno uz postojeći storage adapter. Bez storage konfiguracije SQL brisanje i dalje uspijeva, a datoteke ostaju na čekanju. Odgovor brisanja vraća `cleanupQueued`; posao čišćenja pokreće se zasebno.

## Statistika

Jedan SELECT daje dosljednu snimku: aktivni/deaktivirani korisnici, aktivni po ulozi, samo posljednja verifikacija po organizaciji aktivnog vlasnika (uključujući `not_requested`), svi postojeći oglasi i kandidatske prijave po stvarnom statusu, prijave sadržaja po statusu i broj poslova čišćenja. Obrisani oglasi i njihove kandidatske prijave nisu uključeni; povijest moderacijskih prijava ostaje. Različiti postojeći statusi poput `SELECTED` i `ACCEPTED` ostaju zasebni, bez skrivene pretvorbe.

## Provjere

`npm test` pokreće regresije. Za stvarni PostgreSQL test postaviti `MODERATION_TEST_DATABASE_URL` na lokalni poslužitelj na kojem test smije stvoriti i obrisati zasebnu bazu, zatim pokrenuti `npm run test:moderation:db`. Udaljeni URL se odbija. Test ne dira timske podatke. Bez varijable se DB test izričito preskače.

Pokriti migraciju/rollback/RLS, HTTP ovlasti i CSRF, krivotvorena polja, konkurentno slanje/preuzimanje/odlučivanje, promjene podataka tijekom provjere, ponovno slanje, objavu nakon verifikacije, duple prijave, trajno zatvaranje, kompletan FK graf, rollback greške, očuvanje profilnih/dijeljenih medija, obavijesti, storage neuspjeh i ponovni pokušaj te statistiku i rate limit.

Novi workflow nije dio ovog paketa. Provjere se pokreću lokalno postojećim npm naredbama. Stvarna Google prijava i stvarni Supabase storage nisu dio izoliranih testova; njihova konfiguracija ostaje privatna.

Panel zadržava postojeće Tarine prikaze, CSS klase i obrazac odbijanja; dohvat i odluke povezani su s API-jem. Statistika je zasebna nova komponenta. U postojećim detaljima oglasa dodano je samo povezivanje obrasca prijave oglasa; nepovezani popravci te stranice nisu dio paketa.
