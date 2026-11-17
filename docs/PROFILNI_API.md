# Trajno uređivanje profila

Express i PostgreSQL ostaju izvor istine. Google prijava i lokalni users.id ostaju nepromijenjeni. Oba obrasca učitavaju podatke s API-ja bez demo localStorage podataka. Tekst i slike imaju zasebne gumbe za spremanje i zaseban rezultat. Navigacija odmah preuzima vraćeni korisnički sažetak.

## API za frontend

Sve putanje počinju s /api. Potrebna je dovršena prijava kandidata ili poslodavca. Odgovori imaju Cache-Control: no-store. Svaka mutacija traži postojeći cookie, dopušten Origin i X-CSRF-Token iz auth stanja. Browser sam postavlja multipart boundary.

- GET /profiles/me dohvaća vlastiti profil.
- PATCH /profiles/me djelomično sprema JSON polja profila.
- PUT i DELETE /profiles/me/avatar dodaju, zamjenjuju ili uklanjaju kandidatovu fotografiju.
- POST /profiles/me/portfolio dodaje grupu slika. DELETE /profiles/me/portfolio/:mediaId uklanja pojedinu sliku.
- PUT i DELETE /profiles/me/logo upravljaju logotipom odabrane organizacije.
- GET /profile-media/:mediaId/content vraća sadržaj isključivo vlasniku povezane slike. Content-Type je potvrđeni MIME, uz nosniff. Nema javne galerije niti trajnih potpisanih URL-ova.

Dohvat i uspješne mutacije vraćaju isti oblik:

```json
{
  "user": {"id": 1, "email": "iva@example.test", "firstName": "Iva", "lastName": "Ivić", "birthDate": "2000-04-12", "role": "candidate", "organization": null},
  "profile": {"id": 7, "firstName": "Iva", "lastName": "Ivić", "birthDate": "2000-04-12", "city": "Zagreb", "experience": "Gluma", "heightCm": 175, "weightKg": 65.25, "eyeColor": "smeđa", "hairColor": null, "avatar": null, "portfolio": []}
}
```

Medij ima id, name, mimeType, size i contentUrl oblika /api/profile-media/123/content. storage_key se nikad ne izlaže. Portfolio je sortiran prema ID-u dodavanja. Poslodavčev profile sadrži id, companyName, regNum, contactEmail, phone, location, logo i verificationStatus. Status bez zapisa je null, odvojeno od pending. user.organization zadržava postojeći oblik sa snake_case nazivima.

Primjer PATCH tijela: {"city":"Split","weightKg":70.25}. Odsutna polja ostaju sačuvana; null ili prazan tekst prazni opcionalna kandidatova polja. Ime, prezime, datum i sva polja organizacije koja se šalju ne smiju biti prazni. Telefon pri uređivanju ostaje obavezan kao pri registraciji; povijesni prazni telefon ne blokira izmjenu drugog polja. Autentifikacijski e-mail se ne uređuje.

## Mapiranje i validacija

Kandidatova firstName, lastName i birthDate mijenjaju users.first_name, last_name i birth_date u istoj transakciji s profilom. city, experience, heightCm, weightKg, eyeColor i hairColor odgovaraju candidate_profiles.city, experience, height_cm, weight_kg, eye_color i hair_color. Postojeći bio, country i video_url ostaju sačuvani. Profilni ID se ne mijenja.

companyName, regNum, contactEmail, phone i location mijenjaju organisations.company_name, reg_num, contact_email, phone i location. Odabire se prva organizacija prema ORDER BY id LIMIT 1, kao u postojećim modulima oglasa i autentifikacije. Nikad se ne ažuriraju sve organizacije vlasnika.

Duljine su jednake shemi. Datum je YYYY-MM-DD, mora biti kalendarski valjan, od 1900. godine i 18+ u Europe/Zagreb. OIB je tekst s jedanaest znamenki i kontrolnom znamenkom; vodeće nule ostaju sačuvane. Visina je pozitivan cijeli broj do PostgreSQL INT maksimuma. Težina je pozitivan JSON broj do 9999.99 s najviše dvije decimale, pohranjen kao NUMERIC(6,2). Numerički stringovi se odbijaju; frontend šalje brojeve. To su implementacijske granice, a ne dodatni domenski zahtjevi.

Boje očiju: smeđa, plava, zelena, siva, ostalo. Boje kose: smeđa, plava, crna, crvena, sijeda, ostalo. Prazan odabir je null. Nepoznata polja, vlasnik, uloga, identitet i verifikacija se odbijaju. Nedostajući povijesni profil ili organizacija daju 409 PROFILE_MISSING i poruku za podršku; ne izmišljaju se novi podaci.

Greške zadržavaju {code,error}: 400 validacija ili neispravan multipart, 401 nedovršena ili istekla prijava, 403 uloga/Origin/CSRF, 404 nepostojeći ili tuđi medij, 409 konflikt OIB-a, poslovnog stanja ili portfolio limita, 413 prevelik upload, 415 neispravna slika, 503 nedostupna ili pogrešno konfigurirana pohrana. Nepredviđene DB greške idu kroz postojeći generički 500 handler.

## Slike i trajna pohrana

Odabran je privatni Supabase Storage bucket. Provjera infrastrukture 17. 11. 2026. pronašla je projekt CastMeIfYouCan, ali storage.buckets nije sadržavao nijedan bucket. Produkcijski upload nije provjeren niti je bucket automatski stvoren. Serverski adapter prije operacije provjerava da bucket postoji i nije javan. Serverski privilegirani ključ zaobilazi Storage RLS; Express zato uvijek provjerava vlasništvo. Passport cookie nije Supabase JWT.

Upload koristi multipart polje file za avatar/logo i files za portfolio. Implementacijski zadani limit je 5 MiB po ulaznoj datoteci, konfigurabilan preko PROFILE_IMAGE_MAX_BYTES do najviše 20 MiB. Najviše 20 milijuna piksela i samo statički JPG/PNG. Sharp potpuno dekodira i ponovno kodira sliku, uklanja EXIF i odbija oštećen sadržaj i lažni MIME. Spremljena veličina može se razlikovati od ulazne. Naziv je ograničen i očišćen; objekt dobiva nasumični UUID ključ.

Jedan avatar, jedan logo i pet portfolio slika ukupno. Cijela nova grupa se validira prije pohrane. Zaključavanje korisnika i profila u transakciji serijalizira paralelne upise i štiti limit. Složeni strani ključevi provjeravaju da vlasnik medija odgovara vlasniku profila/organizacije, a parcijalni jedinstveni indeksi štite avatar/logo. Nove relacije ne mijenjaju application_files.

Pohrana i SQL nisu jedna transakcija. Trajni profile_storage_objects ledger bilježi ključ prije vanjskog uploada. Nakon DB neuspjeha novi objekti se uklanjaju; neuspjelo uklanjanje ostaje za ponovni pokušaj. Kod zamjene stara veza ostaje dok nova slika nije učitana, a zamjena veze je jedna SQL transakcija. Brisanje prvo uklanja profilnu vezu i samo nereferencirane metapodatke. Slike koje koristi application_files ostaju u pohrani.

Pokretati npm run media:cleanup redovito, primjerice svakih sat vremena na backendu s istom konfiguracijom. Jedan prolaz obrađuje do 100 objekata bez media_files reference, starijih od sat vremena. Neuspjesi ostaju u ledgeru i naredba vraća neuspješan izlazni status. Ponavljati dok backlog nije prazan. Sat vremena je zaštitni prozor za upload; povezani objekti se nikad ne brišu. Odvajanje uklanjanja veze i fizičkog čišćenja znači da objekt može još kratko postojati, ali više nije dostupan profilnom rutom.

## Postavljanje i migracija

1. U backendu pokrenuti npm ci. Postaviti PG varijable prema postojećim uputama.
2. Najprije na izoliranoj testnoj bazi pokrenuti npm run db:migrate:profiles. Migracija je transakcijska i ponovljiva. db/schema.sql sadrži iste dodatke za novu bazu.
3. U Supabase Storage stvoriti privatni bucket bez javnih read pravila. Postaviti backend SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY i PROFILE_STORAGE_BUCKET. Ključ nikad ne staviti u VITE varijable. Opcionalno postaviti PROFILE_IMAGE_MAX_BYTES. Bez konfiguracije tekst i dalje radi, a operacije sadržaja vraćaju 503.
4. Primijeniti istu migraciju na zajedničku bazu tek nakon pregleda. Nove i postojeće osjetljive tablice koriste RLS bez browser politika i povučena prava PUBLIC/anon/authenticated. Express koristi vlasnika tablica ili BYPASSRLS. Provjeriti prava vlastitih dodatnih API uloga zasebno.
5. Dogovoriti redovito pokretanje naredbe za čišćenje i pratiti njezin izlazni status.

Za povrat neupotrijebljene migracije koristiti db/migrations/profiles_rollback.sql u transakciji. Skripta odbija povrat ako postoje novi podaci ili ledger zapisi; nakon početka korištenja vratiti samo aplikacijski kod i zadržati aditivnu shemu. Postojeća RLS zaštita ostaje uključena.

## Granica verifikacije

Profil ne stvara zahtjeve za verifikaciju i ne mijenja status. Privremeno se odbija promjena OIB-a ako je posljednji status approved. To sprječava prijenos postojećeg odobrenja na drugi pravni identitet. Konačno pravilo i ponovna verifikacija ostaju otvoreni za zadatak 14. Ostali podaci organizacije mogu se uređivati.

## Provjere

npm test u backendu pokreće HTTP, sigurnosne i slikovne testove uz postojeće testove. npm run lint i npm run build pokreću se u frontend direktoriju.

Za ciljanu DB provjeru postaviti PROFILE_TEST_DATABASE_URL na lokalni PostgreSQL server, primjerice postgresql://postgres@localhost:55439/postgres, pa pokrenuti npm run test:profiles:db. Korisnik mora moći stvarati testnu bazu i privremenu probnu ulogu. Skripta prihvaća samo lokalni host, stvara vlastitu nasumično imenovanu bazu i na kraju je uklanja. Ne koristi zajedničku bazu. Testni adapter koristi stvarne datoteke u zasebnom privremenom direktoriju i novu vezu s bazom za provjeru trajnosti. To nije dokaz produkcijskog Supabase uploada.

Provjeravaju se nadogradnja i rollback migracije, ponovljivost, sigurnost prava, sva polja i transakcijski rollback, OIB konflikt, granica od pet uz paralelne zahtjeve, privatni HTTP dohvat, zamjena, kompenzacija i ponovljivo čišćenje, čuvanje referenci prijava te prikaz izmijenjenih kandidatovih podataka poslodavcu.

Službeni izvori provjereni prije implementacije: https://supabase.com/changelog.md, https://supabase.com/docs/guides/storage/buckets/fundamentals i https://supabase.com/docs/reference/javascript/storage-from-upload. Instalirane verzije SDK-a, parsera i dekodera zaključane su u backend/package.json i package-lock.json.

## Rezultat lokalne provjere 17. 11. 2026.

Backend npm test: 145 prolaznih testova i 9 zasebno uvjetovanih DB testova preskočeno. Zasebno npm run test:profiles:db na PostgreSQL-u 16 u WSL-u, port 55439: 8 prolaznih provjera bez preskakanja. Postojeći npm run test:db: 1 prolazna provjera registracije i sesija. npm run test:db:casting: 10 prolaznih provjera. Frontend npm run lint i npm run build prolaze.

Playwright je uz izoliranu testnu prijavu i stvarni API, PostgreSQL i datoteke provjerio oba profila na širinama 390 i 1440 piksela, spremanje teksta i slika, odmah osvježeno ime u navigaciji, ponovno učitavanje podataka te očuvanje unosa uz hrvatsku grešku nakon prekida mreže. Nema vodoravnog prelijevanja na 390 piksela. Testni UI server nema javnu casting rutu pa početna stranica bilježi očekivani 404 za oglase; profilne rute prolaze. Google prijava nije ponovno ručno izvršena; njezin postojeći automatizirani tok prolazi u backend testovima.

Supabase produkcijski upload, restart objavljenog backenda i pristup Data API-ju stvarnim anon ključem nisu izvršeni. Udaljeni read-only pregled potvrdio je da nema bucketa i da postojeće osjetljive tablice imaju RLS. Migracija nije primijenjena na zajedničku bazu. npm ci je prijavio 8 postojećih frontend dependency ranjivosti; frontend dependency datoteke nisu mijenjane. Backend audit nakon dodavanja paketa nema prijavljenih ranjivosti.
