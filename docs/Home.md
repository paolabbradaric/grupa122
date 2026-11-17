# CastMeIfYouCan — projektna dokumentacija

**Kolegij:** Programsko inženjerstvo, FER, Sveučilište u Zagrebu. **Tim:** grupa 12.2. **Dopuna baze i autentifikacije:** 17. 11. 2026.

CastMeIfYouCan povezuje kandidate koji traže casting uloge i poslodavce koji objavljuju oglase, obrađuju prijave i organiziraju audicije. Dokumentacija razlikuje planirane zahtjeve od implementacije i stvarno izvedenih provjera.

## Kazalo

| Stranica | Sadržaj i stanje |
| --- | --- |
| [1. Projekt](1-Projekt.md) | Zajednički opseg; preostali predložak treba dopuniti na razini tima. |
| [2. Analiza zahtjeva](2-Analiza-zahtjeva.md) | Zahtjevi i sljedivost; auth/DB provjere povezane su s konkretnim dokazima. |
| [3. Obrasci uporabe](3-Obrasci-uporabe.md) | UC-001 i UC-002 određuju registraciju, prijavu i odjavu; specifikacija ne znači da je sve izvršeno. |
| [4. Arhitektura i oblikovanje](4-Arhitektura-i-oblikovanje.md) | Implementirani temelji auth/DB, šest pogleda/dijagrama i odluke. |
| [5. Ispitivanje](5-Ispitivanje.md) | Slučajevi auth/DB, rezultati aktualnog main i neizvedene sustavske provjere. |
| [6. Postavljanje i konfiguracija](6-Postavljanje-instalacija-i-konfiguracija.md) | Lokalno pokretanje, PostgreSQL, OAuth, migracije i kontrole upisa. |
| [7. Zaključak i budući rad](7-Zakljucak-i-buduci-rad.md) | Rezultat i preostali rad auth/DB područja; nije proglašenje dovršenosti cijelog projekta. |
| [A. Aktivnosti grupe](A-Pregled-aktivnosti-grupe.md) | Podjela rada i dokazivi Mariovi doprinosi bez izmišljenih sati/sastanaka. |
| [Autentifikacija](AUTENTIFIKACIJA.md) | API ugovor, sesije, validacija, integracija i status zadatka #12. |
| [Baza podataka](BAZA_PODATAKA.md) | Entiteti, ograničenja, migracijski put i TLS/RLS granice. |
| [Razvojni plan](RAZVOJNI_PLAN.md) | Dogovoreni redoslijed i zaduženja tima. |
| [Zapisnik 17. 11. 2026.](verification/2026-11-17/README.md) | Revizija, okruženje i puni ispisi provjera. |

## Tim i praćenje zadataka

Podjela je preuzeta iz razvojnog plana i GitHub zadataka; tablica ne tvrdi da su sva zaduženja dovršena.

| Član | Područje / zadatak |
| --- | --- |
| Rea Gavranović | Frontend prijave, navigacija i profili — [#9](https://github.com/paolabbradaric/grupa122/issues/9). |
| Nina Jonjić | Javni oglasi i prijave — [#10](https://github.com/paolabbradaric/grupa122/issues/10). |
| Tara Fošnar | Poslodavčevo sučelje i admin panel — [#11](https://github.com/paolabbradaric/grupa122/issues/11). |
| Mario Halužan | Baza, autentifikacija, sesije i ovlasti — [#12](https://github.com/paolabbradaric/grupa122/issues/12). |
| Lucija Šprljan | Audicije i obavijesti — [#13](https://github.com/paolabbradaric/grupa122/issues/13). |
| Paola Bradarić | Verifikacija, moderacija i integracija — [#14](https://github.com/paolabbradaric/grupa122/issues/14). |
| Tin Škarpa | Backend oglasa i prijava — [#16](https://github.com/paolabbradaric/grupa122/issues/16). |

Zadaci se prate kroz [GitHub Issues](https://github.com/paolabbradaric/grupa122/issues), a promjene kroz [pull requestove](https://github.com/paolabbradaric/grupa122/pulls). Ritam sastanaka ili formalna Scrum praksa nisu potvrđeni ovim zapisom. Javni URL, videosnimke demonstracija i povratne informacije asistenta trebaju biti zasebno evidentirani kada ih tim potvrdi.

## Pravila dokumentacije i izvori

Prema README-u repozitorija projektna dokumentacija vodi se u docs/ kao povezani Markdown dokumenti. UML izvori čuvaju se u [puml/](puml/), a čitljive slike u [assets/diagrams/](assets/diagrams/). Nastavni primjeri CrisisMapa nisu rezultati CastMeIfYouCan projekta.

Dopuna od 17. 11. pokriva Mariovo područje iz zadatka #12, spojene PR-ove #23, #25, #29 i #31 i početni SQL/ER model. Ne mijenja poslovni kod, bazu ni tajne. Stari zahtjev iz issuea za vlastite lozinke razjašnjen je prema novijim F-001–F-005 i NF-02: koristi se Google prijava.

Licenca predloška dokumentacije i kodeks ponašanja opisani su u [README-u](../README.md) i [CODE_OF_CONDUCT.md](../CODE_OF_CONDUCT.md). Licenca nastavnog predloška ne određuje automatski licencu studentske aplikacije.

## Izjava o uporabi umjetne inteligencije

Ovaj zapis odnosi se na dokumentacijsku dopunu baze i autentifikacije od 17. 11. 2026. Raniji [PR #29](https://github.com/paolabbradaric/grupa122/pull/29) već navodi AI pomoć pri auth uputama. Povijest uporabe AI-ja u ostalim dijelovima tima nije utvrđena ovim pregledom.

| Alat | Koristio / svrha | Artefakti |
| --- | --- | --- |
| Codex | Na zahtjev Marija Halužana: pregled izvornog koda, zadataka i PR-ova, priprema i usklađivanje dokumentacije te izvođenje postojećih provjera. | Ova stranica, poglavlja 4–7, A, dopune 2/3 i AUTENTIFIKACIJA.md, BAZA_PODATAKA.md i zapisnik. |
| Codex i PlantUML 1.2025.4 | Priprema šest projektnih PlantUML izvora i lokalno iscrtavanje SVG-a; tri izvora koriste raniji lokalni nacrt dokumentacije. | mario-*.puml i istoimeni SVG-ovi povezani iz poglavlja 4 i 6. |

Mario je zadao područje autentifikacije i baze te pregled uputa i otvaranje PR-a. Codex je usporedio tvrdnje s kodom revizije bd785d4, pokrenuo postojeće testove i ispravio zastarjele navode; nije mijenjao implementaciju. Neovisni pregled člana tima ostaje predmet PR pregleda i nije prikazan kao proveden.

| Provjera | Dokaz / granica |
| --- | --- |
| Stvarna implementacija | Poveznice iz poglavlja 4, auth ugovora i baze vode na odgovarajuće module i SQL. |
| Testovi i simulacije | [Puni ispisi](verification/2026-11-17/README.md); Google i korisnički model u HTTP testovima simulirani su, a SQL provjeren zasebno. |
| Dijagrami | PUML izvori i SVG slike iscrtani su i pregledani; ne prikazuju izmišljene ORM razrede ni potvrđenu produkcijsku objavu. |
| Neostvareni dijelovi | Profili, demo admin, stvarni Google tok i produkcija imaju izričit status u auth dokumentaciji, ispitivanju i zaključku. |
| Povjerljivost | .env nije kopiran u granu; dokument sadrži nazive varijabli i sintetičke testne rezultate bez njihovih privatnih vrijednosti. |

Ispravljeni navodi ranijih uputa: „postoje samo javne GET rute”, „simulira se samo Google”, „pružatelja tek treba odabrati” i općenito „testovi nisu provedeni”. Aktualna dokumentacija navodi postojeće poslovne module, simulirani model, odabrani Google i konkretne rezultate. Nema tvrdnje da je sav sadržaj neovisno pregledan niti da su nepopisani dijelovi nastali bez AI pomoći.
