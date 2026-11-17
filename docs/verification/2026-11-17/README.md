# Zapisnik provjera — 17. 11. 2026.

Kod: [bd785d4265b4a1ed35cfdd254f5f2f9e7c822a4d](https://github.com/paolabbradaric/grupa122/commit/bd785d4265b4a1ed35cfdd254f5f2f9e7c822a4d), aktualni main na početku dokumentacijske dopune. Okruženje: Windows, Node.js 24.14.0, npm 11.9.0. Paketi su instalirani s npm ci u zasebnom radnom stablu.

Naredba npm test izvedena je iz direktorija backend, uz izlazni kod 0. Rezultat je [139 uspješnih, 8 preskočenih, 0 neuspješnih; ukupno 147](backend-tests.txt).

Naredba node --test test/auth.test.js izvedena je iz direktorija backend, uz izlazni kod 0. Rezultat je [11 uspješnih](auth-tests.txt).

Naredba npm run test:db izvedena je iz direktorija backend, uz izlazni kod 0. Rezultat je [1 uspješan DB test](auth-database.txt).

Naredba npm run test:db:casting izvedena je iz direktorija backend, uz izlazni kod 0. Rezultat je [10 uspješnih testova/podtestova](casting-drafts-database.txt).

Naredba npm run lint izvedena je iz direktorija frontend, uz izlazni kod 0. Rezultat je [Bez pogrešaka](frontend-lint.txt).

Naredba npm run build izvedena je iz direktorija frontend, uz izlazni kod 0. Rezultat je [Uspješno](frontend-build.txt).

Za DB provjere učitana je postojeća privatna backend konfiguracija izvornog lokalnog checkouta, bez kopiranja .env u granu. Pozvane su iste skripte koje koriste navedene npm naredbe: Node je učitao dotenv s privatne lokalne putanje i zatim scripts/check-database.js odnosno scripts/check-casting-database.js. Izvorni kod testova ostao je iz navedenog novijeg main. Privatne vrijednosti nisu dio izvještaja.

Auth HTTP testovi simuliraju Googleove mrežne odgovore i korisnički model. DB testovi koriste stvarni konfigurirani PostgreSQL, privremene tablice i odgovarajući rollback; ne dodaju trajne korisnike i ne migriraju zajedničke tablice. Ovo početno izvođenje na `bd785d4` ne potvrđuje stvarnu Google prijavu ili produkcijski tok.

Naknadni [PR #44](https://github.com/paolabbradaric/grupa122/pull/44) i [Google dopuna](../../GOOGLE_PRIJAVA.md) zasebno bilježe 14 auth testova, 142 uspješna i 8 preskočenih redovnih backend testova te stvarnu lokalnu kandidatsku registraciju, ponovnu prijavu, osvježavanje i odjavu. Ti rezultati ne mijenjaju reviziju ni izvorne ispise ovog zapisnika.

Redovni paket uključuje i testove drugih autora. Auth paket zasebno je ponovljen radi jasnog dokaza ovog područja. Dvije preskočene auth/draft DB provjere izvedene su zasebno; ostale preskočene DB integracije ostaju neizvedene. Brojeve ne treba zbrajati kao različite slučajeve ili postotak pokrivenosti.

Ispisi PowerShell procesa pretvoreni su u UTF-8 bez promjene rezultata. Datumi, revizija i naredbe navedeni su ovdje; vremena trajanja u ispisima pripadaju konkretnom izvođenju.

Šest projektnih dijagrama iscrtava se PlantUML-om 1.2025.4, inačicom postojećeg workflowa. Svaki izvor docs/puml/mario-*.puml ima istoimeni SVG u docs/assets/diagrams/. Rendering koristi -charset UTF-8 -tsvg -failonerror, a lokalni validator provjerava poveznice, sidra, strukturu SVG-a i podudaranje ER entiteta s 18 CREATE TABLE definicija.

[Rezultati po zahtjevima i ručni scenariji](../../5-Ispitivanje.md) · [Izjava o uporabi AI-ja](../../Home.md#izjava-o-uporabi-umjetne-inteligencije)
