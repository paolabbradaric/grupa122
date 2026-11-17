# A. Pregled aktivnosti grupe

Ovaj pregled opisuje podjelu rada i potvrđene doprinose bazi i autentifikaciji do 17. 11. 2026.

## A.1 Evidencija sastanaka

U pregledanom repozitoriju nema popunjene evidencije sastanaka za ovaj doprinos. Zato nisu navedeni pretpostavljeni datumi, sudionici ni trajanje rada. Odluke su potkrijepljene [razvojnim planom](RAZVOJNI_PLAN.md), GitHub zadacima i PR-ovima.

## A.2 Plan rada

Mario priprema bazu, migracije, prijavu i provjere ovlasti koje koriste ostali dijelovi aplikacije. Rea povezuje prijavu i profile s korisničkim sučeljem. Tin, Nina i Tara rade na oglasima i prijavama, Lucija na audicijama i obavijestima, a Paola na verifikaciji, moderaciji i integraciji.

Redoslijed i ovisnosti tih zadataka opisani su u razvojnom planu. Nakon povezivanja slijedi zajednička provjera cijelih korisničkih tokova.

## A.3 Aktivnosti i doprinosi članova

Mario Halužan dodao je početni ER model i SQL shemu 17. 10. 2026. To je zabilježeno u commitovima [dfc3527](https://github.com/paolabbradaric/grupa122/commit/dfc3527) i [2db2a8f](https://github.com/paolabbradaric/grupa122/commit/2db2a8f).

Tijekom 27. i 28. listopada odvojio je broj traženih kandidata od maksimalnog broja prijava i dodao pravilo da projekt ima najviše jedan oglas. Promjena i migracija spojene su kroz [PR #23](https://github.com/paolabbradaric/grupa122/pull/23). Zatim je 29. listopada pripremio zajedničku PostgreSQL vezu s TLS provjerom i upute za tim, kroz [PR #25](https://github.com/paolabbradaric/grupa122/pull/25).

Google prijava, registracija kandidata i poslodavaca, PostgreSQL sesije, validacija i provjere uloga dodane su 3. studenoga kroz [PR #29](https://github.com/paolabbradaric/grupa122/pull/29). U istom je doprinosu postojeći frontend povezan sa stvarnim korisnikom i njegovom ulogom. Ugovor između klijenta i backenda opisan je u [autentifikaciji](AUTENTIFIKACIJA.md).

Dana 4. studenoga dodana su pravila za nepotpune nacrte i potpunu objavu oglasa, uz migraciju i DB testove. Taj je rad spojen kroz [PR #31](https://github.com/paolabbradaric/grupa122/pull/31).

Na Mariov zahtjev 17. studenoga dopunjena je dokumentacija i ponovljene su postojeće provjere, uz pomoć Codexa. Rezultati su u [zapisniku](verification/2026-11-17/README.md), a uporaba alata opisana je na [početnoj stranici](Home.md).

Istog dana [PR #44](https://github.com/paolabbradaric/grupa122/pull/44) uključuje dovršenu lokalnu Google konfiguraciju, povratak preglednika u aplikaciju pri nedostupnoj prijavi ili ograničenju pokušaja i dodatne auth testove. Stvarnim kandidatskim računom potvrđeni su prvi ulazak, dovršavanje profila, osvježavanje, odjava s uklanjanjem PostgreSQL sesije i ponovna prijava u isti račun bez duplikata. [Google prijava](GOOGLE_PRIJAVA.md) navodi točan opseg i granice tih provjera; OAuth tajne ostaju izvan Gita.

Sati rada nisu dostavljeni pa nisu procijenjeni. Poslovni moduli ostalih članova zadržavaju svoje autorstvo; uporaba zajedničkog middlewarea ne pripisuje njihov rad autoru autentifikacije.

## A.4 Pregled promjena u repozitoriju

Doprinos se može dodatno pratiti kroz [GitHub Contributors](https://github.com/paolabbradaric/grupa122/graphs/contributors) i [commitove računa mariohaluzan](https://github.com/paolabbradaric/grupa122/commits/main/?author=mariohaluzan). Početna implementacija obuhvaća razdoblje od 17. listopada do 4. studenoga, a 17. studenoga slijede dokumentacijska provjera i dopuna stvarne lokalne Google prijave kroz PR #44. Broj commitova ne pokazuje ukupne sate ni sav rad na integraciji.

## A.5 Inženjerski izazovi i rješenja

Jedan od prvih izazova bilo je razdvajanje broja slobodnih mjesta i dopuštenog broja prijava. Zato su uvedena dva polja, positions_count i max_applications. Baza održava njihove vrijednosti i osnovna ograničenja, a poslovni API provjerava broj prijava i konkurentne upise.

Nacrti su zahtijevali drukčija pravila od objavljenih oglasa. Dio NOT NULL uvjeta zamijenjen je provjerom koja dopušta nepotpun nacrt, ali odbija nepotpunu objavu. Testovi provjeravaju novo stvaranje baze i nadogradnju postojeće strukture.

Postojeća baza i Express backend zadržani su tijekom prilagodbe prijave. Umjesto uvođenja novog aplikacijskog okvira pripremljene su migracije i auth moduli koji koriste postojeći pg pool. Zajednička veza osigurana je TLS-om i javnim CA certifikatom, uz privatne pristupne podatke.

Za provjeru prijave bilo je potrebno razlikovati simulirani HTTP tok od stvarnih SQL upisa. Zato su testovi razdvojeni. Početni zapisnik na `bd785d4` nije uključivao stvarni Google tok; naknadni PR #44 potvrđuje lokalni kandidatski tok kroz Google i postojeću bazu. Stvarni poslodavački tok, restart s postojećom prijavom i produkcijska konfiguracija ostaju zasebne neprovedene provjere.

[Status zadatka #12](AUTENTIFIKACIJA.md#status-zadatka-12-i-potreban-završetak) i [kazalo](Home.md) vode na povezane dijelove dokumentacije.
