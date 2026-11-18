# Cast me if you can — razvojni plan grupe 12.2

Implementacija Google prijave, sesija i registracije opisana je u [Autentifikaciji](AUTENTIFIKACIJA.md), zajedno s API ugovorom, razlozima prilagodbe i koracima za konfiguriranje Google ključeva.

## Potvrđene odluke
- Prijava putem OAuth 2.0 / OpenID Connect pružatelja identiteta; vlastite korisničke lozinke ne pohranjujemo.
- Uloge: kandidat, poslodavac, admin. Pet administratora koristi individualne Google račune s privatnog serverskog popisa. Demo koristi Mariov postojeći Google račun; nema zasebne zajedničke admin prijave.
- Gosti vide javne oglase; prijavljeni poslodavac vidi samo svoje oglase.
- Svaki oglas je zaseban projekt s jednom ulogom.
- Svaki oglas ima `positions_count` (broj traženih kandidata) i `max_applications` (najviše prijava; početna vrijednost 1000 po oglasu). Prijave su moguće do roka, dok je oglas objavljen i limit nije dosegnut; kandidat se može prijaviti jednom na isti oglas. Dodatno su potrebne zaštite od automatiziranih prijava (npr. rate limiting).
- Verificirani poslodavci objavljuju; neverificirani spremaju nacrte.
- Pozvani kandidat odabire slobodan termin audicije.
- Admin nepovratno briše neprimjeren oglas i povezane podatke uz potvrdu i provjere.
- Obavijesti u aplikaciji; važnije i e-poštom. Google Calendar je opcionalan.

## Redoslijed razvoja
1. Temelji: pregled SQL-a, migracije, autentifikacija, ovlasti i API dogovor.
2. Poslodavci i oglasi: verifikacija, nacrti, objava, javni oglasi i filteri.
3. Kandidati i prijave: profili, portfolio, prijave i uži izbor.
4. Audicije i moderacija: termini, rezervacije, obavijesti i prijavljivanje oglasa.
5. Integracija: admin statistika, testovi, dokumentacija i demo.

## Zaduženja (GitHub Issues)
- Rea: #9 — prijava, navigacija, profili.
- Nina: #10 — oglasi, filtriranje, prijave.
- Tara: #11 — poslodavac i admin panel.
- Mario: #12 — baza, autentifikacija, sesije, ovlasti.
- Tin: #16 — backend casting oglasa i prijava (novi plan; prethodni #4 zatvoren kao zamijenjen).
- Lucija: #13 — audicije, rezervacije, obavijesti.
- Paola: #14 — verifikacija, moderacija, integracijski testovi.

## API područja (prijedlog)
- Mario: auth, users, profiles.
- Tin: castings, applications.
- Lucija: auditions, reservations, notifications.
- Paola: verifications, reports, admin/stats.

## Važne smjernice
- Postojeći db/schema.sql ima users.auth_id i odvojene projekte/casting pozive: uskladiti migracijom, ne prepisivati bez pregleda.
- Autorizacija se provjerava na backendu; vlastiti podaci dostupni su samo ovlaštenima.
- Lozinke i privatni admin popis nikada ne stavljati u Git. Demo koristi postojeći ovlašteni Google račun.
- Trajno brisanje zahtijeva obradu povezanih SQL zapisa, datoteka, aktivnih audicija, obavijesti i grešaka; demo s testnim podacima.
- Git rad: zasebne grane, testovi i PR-ovi; main mora ostati pokretljiv.
- Status zadatka je gotov tek nakon integracije i provjere s bazom.

## Cilj završnog demoa
Gost pregledava oglas, kandidat se registrira, poslodavac traži verifikaciju, admin odobrava, poslodavac objavljuje, kandidat se prijavljuje, poslodavac ga poziva na audiciju, kandidat rezervira termin, a zatim poslodavac evidentira ishod.

## Stanje admin modula

Sigurna Google prijava i serverska zaštita `/api/admin` nadopunjene su poslovnim API-jem za verifikaciju, prijave sadržaja, trajno brisanje i statistiku. Profil poslodavca šalje zahtjev, detalji oglasa omogućuju prijavu, a panel koristi stvarne API podatke. Za postojeću bazu potrebna je migracija `moderation.sql`; čišćenje vanjskih datoteka ima zaseban trajni red i skriptu. Ugovor, provjere i granice opisani su u [API-ju moderacije](MODERACIJA_API.md). Zajednička baza nije automatski nadograđena.
