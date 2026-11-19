# A. Pregled aktivnosti grupe

Ovaj pregled obuhvaća plan rada i doprinose članova grupe 12.2 do prve predaje, na temelju spojenih promjena u repozitoriju.

## A.1 Evidencija sastanaka

| Datum | Sudionici | Tema i donesene odluke | Poveznica na rezultat |
| --- | --- | --- | --- |

Evidenciju održanih sastanaka i prisutnosti članovi grupe dopunjuju potvrđenim podacima.

## A.2 Plan rada

Mario je radio na bazi, migracijama, autentifikaciji i provjerama ovlasti. Rea je razvijala sučelja prijave, registracije, profila, kandidatovih prijava i obavijesti. Tin je radio na backendu oglasa, prijava, rezervacija audicija i obavijesti, Nina na javnom prikazu i filtriranju oglasa, Tara na poslodavčevu sučelju i kandidatovu odabiru termina, Lucija na backendu upravljanja terminima audicija i testovima, a Paola na verifikaciji poslodavaca, moderaciji i administratorskim funkcijama.

Redoslijed i ovisnosti tih zadataka opisani su u razvojnom planu. Nakon povezivanja slijedi zajednička provjera cijelih korisničkih tokova.

## A.3 Aktivnosti i doprinosi članova

Mario Halužan dodao je početni ER model i SQL shemu 17. 10. 2026. To je zabilježeno u commitovima [dfc3527](https://github.com/paolabbradaric/grupa122/commit/dfc3527) i [2db2a8f](https://github.com/paolabbradaric/grupa122/commit/2db2a8f).

Tijekom 27. i 28. listopada odvojio je broj traženih kandidata od maksimalnog broja prijava i dodao pravilo da projekt ima najviše jedan oglas. Promjena i migracija spojene su kroz [PR #23](https://github.com/paolabbradaric/grupa122/pull/23). Zatim je 29. listopada pripremio zajedničku PostgreSQL vezu s TLS provjerom i upute za tim, kroz [PR #25](https://github.com/paolabbradaric/grupa122/pull/25).

Google prijava, registracija kandidata i poslodavaca, PostgreSQL sesije, validacija i provjere uloga dodane su 3. studenoga kroz [PR #29](https://github.com/paolabbradaric/grupa122/pull/29). U istom je doprinosu postojeći frontend povezan sa stvarnim korisnikom i njegovom ulogom. Ugovor između klijenta i backenda opisan je u [autentifikaciji](AUTENTIFIKACIJA.md).

Dana 4. studenoga dodana su pravila za nepotpune nacrte i potpunu objavu oglasa, uz migraciju i DB testove. Taj je rad spojen kroz [PR #31](https://github.com/paolabbradaric/grupa122/pull/31).

Na Mariov zahtjev 17. studenoga dopunjena je dokumentacija i ponovljene su postojeće provjere, uz pomoć Codexa. Rezultati su u [zapisniku](verification/2026-11-17/README.md), a uporaba alata opisana je na [početnoj stranici](Home.md).

Istog dana [PR #44](https://github.com/paolabbradaric/grupa122/pull/44) uključuje dovršenu lokalnu Google konfiguraciju, povratak preglednika u aplikaciju pri nedostupnoj prijavi ili ograničenju pokušaja i dodatne auth testove. Stvarnim kandidatskim računom potvrđeni su prvi ulazak, dovršavanje profila, osvježavanje, odjava s uklanjanjem PostgreSQL sesije i ponovna prijava u isti račun bez duplikata. [Google prijava](GOOGLE_PRIJAVA.md) navodi točan opseg i granice tih provjera; OAuth tajne ostaju izvan Gita.

### Doprinosi ostalih članova grupe

| Član (GitHub račun) | Glavni doprinosi | Spojeni Pull Requestovi |
| --- | --- | --- |
| Tin (`ts56989`) | Backend oglasa i prijava, statusi, rezervacije audicija, evidencija dolazaka i obavijesti | [#30](https://github.com/paolabbradaric/grupa122/pull/30), [#50](https://github.com/paolabbradaric/grupa122/pull/50), [#58](https://github.com/paolabbradaric/grupa122/pull/58), [#67](https://github.com/paolabbradaric/grupa122/pull/67) |
| Tara (`tf56511`) | Poslodavčevi oglasi i audicije te kandidatovo sučelje za rezervacije | [#42](https://github.com/paolabbradaric/grupa122/pull/42), [#62](https://github.com/paolabbradaric/grupa122/pull/62), [#68](https://github.com/paolabbradaric/grupa122/pull/68), [#69](https://github.com/paolabbradaric/grupa122/pull/69) |
| Rea (`rg56695`) | Registracija, profil i navigacija, prikazi kandidatovih prijava i obavijesti | [#51](https://github.com/paolabbradaric/grupa122/pull/51), [#60](https://github.com/paolabbradaric/grupa122/pull/60), [#66](https://github.com/paolabbradaric/grupa122/pull/66) |
| Paola (`paolabbradaric`) | Verifikacija poslodavaca, moderacija oglasa, administratorska statistika i postavljanje aplikacije | [#48](https://github.com/paolabbradaric/grupa122/pull/48), [#49](https://github.com/paolabbradaric/grupa122/pull/49) |
| Nina (`nj56590`) | Javni prikaz, detalji i filtri casting oglasa | [#36](https://github.com/paolabbradaric/grupa122/pull/36), [#59](https://github.com/paolabbradaric/grupa122/pull/59) |
| Lucija (`lucaa042`) | Backend dohvaćanja, stvaranja i otkazivanja termina audicija te automatizirani testovi | [#35](https://github.com/paolabbradaric/grupa122/pull/35) |

Utrošene sate članovi upisuju na temelju vlastite evidencije; sati nisu procijenjeni iz broja commitova.

## A.4 Pregled promjena u repozitoriju

Doprinosi cijelog tima mogu se pratiti kroz [GitHub Contributors](https://github.com/paolabbradaric/grupa122/graphs/contributors), povijest commitova te PR-ove navedene u ovom dodatku. Prve promjene započele su u listopadu, a integracija backenda, korisničkih sučelja i javne aplikacije nastavljena je u studenome. Broj commitova nije mjerilo ukupnih radnih sati.

## A.5 Inženjerski izazovi i rješenja

Jedan od prvih izazova bilo je razdvajanje broja slobodnih mjesta i dopuštenog broja prijava. Zato su uvedena dva polja, positions_count i max_applications. Baza održava njihove vrijednosti i osnovna ograničenja, a poslovni API provjerava broj prijava i konkurentne upise.

Nacrti su zahtijevali drukčija pravila od objavljenih oglasa. Dio NOT NULL uvjeta zamijenjen je provjerom koja dopušta nepotpun nacrt, ali odbija nepotpunu objavu. Testovi provjeravaju novo stvaranje baze i nadogradnju postojeće strukture.

Postojeća baza i Express backend zadržani su tijekom prilagodbe prijave. Umjesto uvođenja novog aplikacijskog okvira pripremljene su migracije i auth moduli koji koriste postojeći pg pool. Zajednička veza osigurana je TLS-om i javnim CA certifikatom, uz privatne pristupne podatke.

Za provjeru prijave bilo je potrebno razlikovati simulirani HTTP tok od stvarnih SQL upisa. Zato su testovi razdvojeni. Početni zapisnik na `bd785d4` nije uključivao stvarni Google tok; naknadni PR #44 potvrđuje lokalni kandidatski tok kroz Google i postojeću bazu. Stvarni poslodavački tok, restart s postojećom prijavom i produkcijska konfiguracija ostaju zasebne neprovedene provjere.

Kod rezervacija audicija trebalo je spriječiti prekoračenje kapaciteta pri istodobnim zahtjevima. Backend koristi zaključavanje i ograničenja baze ([PR #58](https://github.com/paolabbradaric/grupa122/pull/58)), a kandidatovo sučelje za odabir i promjenu termina povezano je naknadno ([PR #68](https://github.com/paolabbradaric/grupa122/pull/68)). Prikazi prijava i obavijesti naknadno su povezani s odgovarajućim API-jem ([PR #66](https://github.com/paolabbradaric/grupa122/pull/66)).

[Status zadatka #12](AUTENTIFIKACIJA.md#status-zadatka-12-i-potreban-završetak) i [kazalo](Home.md) vode na povezane dijelove dokumentacije.
