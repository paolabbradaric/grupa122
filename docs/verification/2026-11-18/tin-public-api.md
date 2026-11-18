# Tin: javni API, ograničenje predaje i regresije

Datum: 18. 11. 2026. Grana: `codex/tin-public-api-final`.
Osnova: `f7b2861bdb116da23cac493566c5f2db4af7bba9`, aktualni `main` s Reininim
spojenim PR-om #51. Prethodni nedovršeni rad na `codex/tin-public-api-limits`
sačuvan je, a njegove backend promjene prenesene su na ovu novu osnovu.

## Rezultat

- Javni popis i detalji vraćaju izričit skup javnih polja projekta i uloge,
  uz očuvanje starih polja i dodatne aliase za Reinu pretragu.
- Parametrizirani filtri vrste projekta, dobi i uvjeta kombiniraju se s
  lokacijom i nazivom. Validacija odbija nevaljane parametre prije SQL-a.
- POST prijave dobiva zajednički PostgreSQL brojač pokušaja po korisniku;
  početni limit je 10 pokušaja u 15 minuta. Auth, Origin/CSRF i postojeće
  blokade upisa ostaju ispred poslovnog upisa.
- Migracija brojača je dodana, bez automatske instalacije u ciljnu bazu.
  Nedostupna tablica/ovlasti daju 503; višak zahtjeva daje 429 bez predaje.
- API ugovori i preduvjeti opisani su u `JAVNI_OGLASI_API.md`,
  `OGRANICENJE_PRIJAVA_API.md` i povezani iz `PRIJAVE_KANDIDATA_API.md`.

## Izvršene provjere

| Provjera | Rezultat |
| --- | --- |
| Tri ciljana testna fajla uz `PUBLIC_CASTING_DB_TESTS=1` | 12 uspješnih, 0 neuspješnih, 0 preskočenih |
| Cijeli backend `npm test`, uz `PUBLIC_CASTING_DB_TESTS=1` i `CANDIDATE_APPLICATIONS_DB_TESTS=1` | 271 ukupno; 260 uspješnih, 0 neuspješnih, 11 opcionalnih DB skupova preskočeno |
| Frontend `npm ci` i `npm run build` na neizmijenjenom frontend sadržaju | Prolazi, Vite 8.3.5, 49 modula |
| `git diff --check` i pregled promijenjenih putanja | Prolazi; backend, DB SQL i dokumentacija |

Prije DB upisa read-only preflight potvrdio je
`castme_test | 127.0.0.1 | tinskarpa`. Integracijski skupovi provjeravaju
cilj ponovo u kodu. Nove DB provjere i kandidatove regresije stvaraju samo
vlastite jednokratne sheme, koje se nakon izvođenja brišu. Migracija
brojača izvršena je samo uz preusmjeravanje imena shema na te testne sheme;
postojeći `public` i `app_private` nisu mijenjani.

Provjereni su uključivi dobni rubovi, sve kombinacije filtara, doslovni
posebni znakovi uvjeta, SQL injekcije, skriveni statusi, izričita javna
polja, RLS/ACL i vanjski ključ brojača. Trideset paralelnih povećanja kroz
dva store objekta vraća točno brojeve 1–30. Dvadeset paralelnih HTTP
predaja istog korisnika na isti oglas kroz dvije aplikacije daje jednu
uspješnu predaju, devet odbijenih duplikata i deset odgovora 429; u bazi
ostaje samo jedna prijava. Drugi kandidat ima vlastitu kvotu. Testira se
i istek/reset prozora te 503 nakon uklanjanja testne tablice brojača.

Prva DB izvođenja otkrila su nevaljane testne podatke: objavljeni oglas
bez dobnog raspona i više oglasa na istom projektu. Podaci su usklađeni
sa stvarnim ograničenjima; poslovna ograničenja nisu ublažena.

## Što ostaje za integraciju

- Mario: pregled početnog limita i kontrolirana migracija brojača prije
  omogućavanja predaje. Za povlačenje je i dalje potrebna zasebna guard
  migracija iz 12. 11. Nijedna nije primijenjena na zajednički Supabase.
- Nina/Tara: povezati strukturirane filtre i postojeće kandidatove API-je,
  uskladiti statusni tijek s `AUDITIONED → ACCEPTED`.
- Lucija: dogovoriti preostale prijave, rezervacije i obavijesti nakon
  popunjavanja/otkazivanja. Ovi moduli nisu preuzeti ovim zadatkom.
- Rea/Mario: u PR-u #51 naveden je profilni problem `42P01`; portfolio i
  stvarni Google/profilni tijek nisu potvrđeni ovim backend provjerama.
- Admin pregled pojedinačnih prijava zahtijeva dogovoreni opseg s Paolom.

Frontend i `.env` datoteke nisu mijenjane. Tajne nisu uključene u promjene.
Produkcijski upisi nisu uključivani, a pravi OAuth tok i poslovne mutacije
na zajedničkoj bazi nisu pokretani. Ovaj izvještaj ne proglašava cijeli
Tinov issue #16 dovršenim.
