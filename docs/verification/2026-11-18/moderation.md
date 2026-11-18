# Provjera verifikacije i moderacije — 18. 11. 2026.

Provjereno u izoliranom lokalnom PostgreSQL 18.6 okruženju; stvarna timska baza i Supabase objekti nisu mijenjani.

| Provjera | Rezultat | Granica |
| --- | --- | --- |
| Backend `node --test`, uz `MODERATION_TEST_DATABASE_URL` i `PROFILE_TEST_DATABASE_URL` | 200 uspješnih, 9 izričito preskočenih, 0 neuspješnih | Preskočeni testovi zahtijevaju druge zasebne DB zastavice/konfiguracije |
| Novi moderacijski HTTP/DB scenariji | 11 uspješnih uključujući nadređeni test | Stvarni Express, PostgreSQL, SQL transakcije i zaštite; identitet/sesija postavljeni testnom pripremom |
| Dodatni `admin-database.test.js` pojedinačno | 11 uspješnih | Pri paralelnom pokretanju sa svim dopunskim DB testovima zabilježena je postojeća greška završnog zatvaranja veze nakon uspješnih asercija; nije mijenjan Mariov test |
| Frontend ESLint | Prolazi | Statička provjera |
| Frontend Vite build | Prolazi | Produkcijski bundle |
| Renderiranje produkcijskog React panela u jsdomu | Prolazi | API odgovori simulirani, nije stvarna Google prijava |
| `git diff --check` | Prolazi | Razmaci i patch format |

Novi scenariji provjeravaju migraciju, rollback, očuvanje starih odluka i RLS; goste/pogrešne uloge/CSRF/krivotvorena polja; konkurentno slanje i preuzimanje, razloge i novo slanje; promijenjenu snimku podataka, jednu završnu odluku i postojeću objavu oglasa; duple prijave, zatvaranje i rate limit; sve postojeće FK veze pri brisanju, rollback greške usred brisanja, očuvane korisnike i dijeljene/profilne slike; obavijesti i audit; odgođeno čišćenje, nedostupnu pohranu i ponovni pokušaj; stvarne agregate.

Provjera sučelja renderirala je produkcijski bundle i prošla preuzimanje/odobravanje verifikacije, prosljeđivanje CSRF tokena, onemogućeno brisanje uz pogrešnu tekstualnu potvrdu, uspješno potvrđeno brisanje, statistiku i uklanjanje panela nakon `403`. Pokretanje pravog Chromiuma nije dostupno zbog ograničenja Unix socketa ovog okruženja; vizualni pregled u pregledniku ostaje zasebna provjera.

Za zajedničko okruženje ostaju primjena migracije, privatna storage konfiguracija i redovito pokretanje čišćenja, stvarni Google ulazi ovlaštenih članova i ručni prolaz s timskim podacima. Obavijesti su zapisane u postojeću tablicu; prikaz i slanje e-pošte provjeravaju se s Lucijinim modulom. PR ne zatvara cijeli #14 prije zajedničke provjere.
