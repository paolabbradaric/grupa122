# Dovršavanje backenda — 18. 11. 2026.

Grana `codex/backend-completion` temelji se na mainu `4b1b099` i uključuje
Mariov PR #55, head `afba2c5`, bez mijenjanja njegove grane. Korisnik je
odobrio backend popravke, kontrolirane migracije i aktivaciju. Dodatno je
potvrdio pravila REJECTED/CANCELLED pri završetku oglasa. Upload je izričito
odgođen za kasnije; frontend i .env datoteke nisu mijenjani.

## Implementirano

- Dohvat termina poslodavcu sada provjerava vlasništvo; pozvani kandidat vidi
  termine samo svojeg oglasa. Uklonjen je potvrđeni 403 za vlasnika.
- Audicije su objedinjene u jednom modelu, sa zaključavanjem retka oglasa.
  Stvaranje/otkazivanje poštuju poslodavčev write gate. Dodana je valjana
  buduća vremenska zona i granica PostgreSQL INT-a.
- Kandidat može rezervirati, atomski promijeniti i otkazati svoj termin.
  Vlasnik vidi rezervacije i evidentira dolazak/nedolazak. Backend/DB štite
  kapacitet, jednu aktivnu rezervaciju i podudaranje oglasa/prijave/termina.
- SELECT → ACCEPTED i filled ostaju isti poslovni tijek; dopunjeni su obrada
  preostalih prijava, rezervacija, termina, povijesti i privatnih obavijesti.
  Otkazivanje koristi izričito potvrđen CANCELLED. Svi upisi jedne radnje
  ostaju u istoj transakciji; povlačenje s aktivnom rezervacijom ostaje 409.
- Obavijesti imaju vlastiti GET s paginacijom i PATCH za oznaku pročitanosti,
  uz zaštitu od pristupa tuđoj obavijesti.
- Dodan je zaseban admin GET pojedinačnih prijava uz postojeću strogu Google
  provjeru i allowlistu; admin time ne dobiva poslodavčeve mutacije.
- Brojčana polja i ID-jevi odbijaju prekoračenje PostgreSQL INT-a. Udaljeni
  kandidatovi upisi, kao i poslodavčevi, zahtijevaju TLS.
- Uključena je Mariova sigurnosna migracija i CI. Potvrđeni kasni FATAL iz
  profilnog DB testa ispravljen je običnim DROP-om samo vlastite privremene
  baze nakon zatvaranja poola, bez FORCE. Test ne briše postojeće baze.

Ugovori su u `docs/AUDICIJE_OBAVIJESTI_API.md`. E-pošta F-034 nije odabrana
usluga i nije dio ovog backend proširenja; obavijesti su u aplikaciji.

## Lokalni dokazi

Sve provjere su izvedene prije produkcijskih promjena. Novi opsežni skupovi
koriste jednokratne PostgreSQL 17.11 klastere na loopback portovima 55487 i
55488. Sigurnosni fixture potvrđuje naziv klastera, system_identifier i adresu
prije stvaranja/brišenja vlastitih objekata. Stari opt-in testovi koji traže
port 5432 koriste potvrđeni lokalni castme_test i vlastite retke/sheme.

- `npm test` bez opt-in DB zastavica: **248 uspješnih, 0 neuspješnih,
  16 preskočenih DB skupova**.
- `npm test` s uključenim starim DB regresijama povlačenja, odabira i statusa:
  **283 uspješna, 0 neuspješnih, 13 preskočenih**.
- Sigurnosna migracija/bootstrapping: **17 uspješnih**, bez preskakanja.
- Postojeći admin/profil/moderacija DB skupovi: **31 uspješan**, bez preskakanja.
- CI-ekvivalent auth/nacrti/javni API/novi tijek SQL i HTTP: **28 uspješnih**,
  bez preskakanja. Prošireni booking skup zasebno prolazi **11 provjera**.
- Novi HTTP sigurnosni testovi provjeravaju goste, obje poslovne uloge, CSRF,
  Origin, write gate, granice brojeva i Google admin proof/allowlistu.
- Provjeren je puni HTTP tijek sa stvarnim SQL-om: nacrt → objava → prijava →
  UNDER_REVIEW → SHORTLISTED → INVITED → termin → rezervacija → otkaz → povlačenje.
- Konkurentne rezervacije, stari REPEATABLE READ snapshot, direktni SQL,
  rezervacija istodobno s cancel/filled te neuspjeh obavijesti ne narušavaju
  kapacitet niti atomarnost. Puna promjena termina čuva staru rezervaciju.
- `git diff --check` prolazi; u promjenama nema frontend ili .env datoteka.

## Produkcijski plan i preflight

READ ONLY provjera prije primjene potvrdila je: 0 duplih aktivnih rezervacija,
0 termina preko kapaciteta, 0 aktivnih rezervacija uz WITHDRAWN i 0 budućih
aktivnih rezervacija nepozvanih kandidata. Postojeće podatke ne popravljamo
niti brišemo migracijom.

U jednoj kontroliranoj transakciji, uz provjeru ciljne baze preko javnih oglasa,
primjenjuju se: guard povlačenja, brojač predaje, novi booking guard i Mariova
sigurnosna migracija. Ugrađeni BEGIN/COMMIT pojedinih SQL datoteka uklanjaju se
samo u kontroliranom runneru kako COMMIT ne bi prerano završio vanjsku transakciju.
Zatim slijedi provjera triggera, indeksa, RLS-a i invoker atributa prije COMMIT-a.
Aktivacija kandidatovih ENABLED/CONFIRMED/ALLOW_REMOTE potvrda ide samo na
production i nakon toga nova objava; preview ostaje bez upisa.

Ovaj dokument ne tvrdi da je produkcijski poslodavčev UI već provjeren.
Korisnik se treba prijaviti stvarnim poslodavačkim računom; admin uloga se ne
mijenja niti se koristi za zaobilaženje poslovnih ovlasti. Rezultat objave i
produkcijskih provjera bilježi se zasebno nakon izvođenja.
