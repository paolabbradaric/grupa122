# A. Pregled aktivnosti grupe

Ovaj pregled obuhvaća plan rada i doprinose članova grupe 12.2 do prve predaje, na temelju spojenih promjena u repozitoriju.

## A.1 Evidencija sastanaka

| Datum | Sudionici | Tema i donesene odluke | Poveznica na rezultat |
| --- | --- | --- | --- |
| 15. 10. 2026. | Svi članovi grupe | Prvi sastanak: upoznavanje članova i određivanje početnih uloga u timu. | — |
| 22. 10. 2026. | Svi članovi osim Marija | Dogovorene funkcionalnosti aplikacije i raspodjela razvojnih zadataka prema područjima: računi i profili, oglasi i prijave, verifikacija, audicije, obavijesti te administracija. | [Razvojni plan](RAZVOJNI_PLAN.md) |
| 18. 11. 2026. | Paola, Tin, Mario i Lucija | Pregled do tada implementiranih funkcionalnosti i napretka projekta te povezivanje aplikacije s Vercelom radi javnog pristupa. | [Vercel konfiguracija (PR #49)](https://github.com/paolabbradaric/grupa122/pull/49), [javna aplikacija](https://grupa122.vercel.app/) |

## A.2 Plan rada

Mario je radio na bazi, migracijama, autentifikaciji i provjerama ovlasti. Rea je razvijala sučelja prijave, registracije, profila, kandidatovih prijava i obavijesti. Tin je radio na backendu oglasa, prijava, rezervacija audicija i obavijesti, Nina na javnom prikazu i filtriranju oglasa, Tara na poslodavčevu sučelju i kandidatovu odabiru termina, Lucija na backendu upravljanja terminima audicija i testovima, a Paola na verifikaciji poslodavaca, moderaciji i administratorskim funkcijama.

Redoslijed i ovisnosti zadataka opisani su u [razvojnom planu](RAZVOJNI_PLAN.md). Integracija je napredovala kroz povezivanje korisničkih sučelja s API-jem, dok se cjeloviti korisnički tokovi dodatno provjeravaju.

## A.3 Aktivnosti i doprinosi članova

Pregled doprinosa svih članova temelji se na spojenim Pull Requestovima. Redoslijed je abecedni, od Z prema A.

| Član (GitHub račun) | Glavni doprinosi | Spojeni Pull Requestovi |
| --- | --- | --- |
| Tin (`ts56989`) | Backend oglasa i prijava, obrada statusa, rezervacije audicija, evidencija dolazaka i privatne obavijesti | [#30](https://github.com/paolabbradaric/grupa122/pull/30), [#50](https://github.com/paolabbradaric/grupa122/pull/50), [#58](https://github.com/paolabbradaric/grupa122/pull/58), [#67](https://github.com/paolabbradaric/grupa122/pull/67) |
| Tara (`tf56511`) | Poslodavčevi oglasi i audicije, povezivanje sučelja s API-jem i kandidatov odabir termina | [#42](https://github.com/paolabbradaric/grupa122/pull/42), [#62](https://github.com/paolabbradaric/grupa122/pull/62), [#68](https://github.com/paolabbradaric/grupa122/pull/68), [#69](https://github.com/paolabbradaric/grupa122/pull/69) |
| Rea (`rg56695`) | Registracija, navigacija i profili, prikazi kandidatovih prijava i obavijesti | [#19](https://github.com/paolabbradaric/grupa122/pull/19), [#51](https://github.com/paolabbradaric/grupa122/pull/51), [#60](https://github.com/paolabbradaric/grupa122/pull/60), [#66](https://github.com/paolabbradaric/grupa122/pull/66) |
| Paola (`paolabbradaric`) | Verifikacija poslodavaca, moderacija oglasa, administratorska statistika i Vercel konfiguracija | [#48](https://github.com/paolabbradaric/grupa122/pull/48), [#49](https://github.com/paolabbradaric/grupa122/pull/49) |
| Nina (`nj56590`) | Javni prikaz casting oglasa, detalji i filtri pretraživanja | [#22](https://github.com/paolabbradaric/grupa122/pull/22), [#36](https://github.com/paolabbradaric/grupa122/pull/36), [#59](https://github.com/paolabbradaric/grupa122/pull/59) |
| Mario (`mariohaluzan`) | SQL shema, migracije, autentifikacija i sesije, provjere ovlasti te trajno spremanje profila | [#23](https://github.com/paolabbradaric/grupa122/pull/23), [#25](https://github.com/paolabbradaric/grupa122/pull/25), [#29](https://github.com/paolabbradaric/grupa122/pull/29), [#31](https://github.com/paolabbradaric/grupa122/pull/31), [#44](https://github.com/paolabbradaric/grupa122/pull/44), [#46](https://github.com/paolabbradaric/grupa122/pull/46), [#57](https://github.com/paolabbradaric/grupa122/pull/57) |
| Lucija (`lucaa042`) | Backend dohvaćanja, stvaranja i otkazivanja termina audicija te automatizirani testovi | [#35](https://github.com/paolabbradaric/grupa122/pull/35) |

Utrošeni sati nisu procijenjeni iz broja commitova; po potrebi ih članovi grupe upisuju prema vlastitoj evidenciji.

## A.4 Pregled promjena u repozitoriju

Doprinosi cijelog tima mogu se pratiti kroz [GitHub Contributors](https://github.com/paolabbradaric/grupa122/graphs/contributors), povijest commitova te PR-ove navedene u ovom dodatku. Prve promjene započele su u listopadu, a integracija backenda, korisničkih sučelja i javne aplikacije nastavljena je u studenome. Broj commitova nije mjerilo ukupnih radnih sati.

## A.5 Inženjerski izazovi i rješenja

Jedan od prvih izazova bilo je razdvajanje broja slobodnih mjesta i dopuštenog broja prijava. Zato su uvedena dva polja, positions_count i max_applications. Baza održava njihove vrijednosti i osnovna ograničenja, a poslovni API provjerava broj prijava i konkurentne upise.

Nacrti su zahtijevali drukčija pravila od objavljenih oglasa. Dio NOT NULL uvjeta zamijenjen je provjerom koja dopušta nepotpun nacrt, ali odbija nepotpunu objavu. Testovi provjeravaju novo stvaranje baze i nadogradnju postojeće strukture.

Postojeća baza i Express backend zadržani su tijekom prilagodbe prijave. Umjesto uvođenja novog aplikacijskog okvira pripremljene su migracije i auth moduli koji koriste postojeći pg pool. Zajednička veza osigurana je TLS-om i javnim CA certifikatom, uz privatne pristupne podatke.

Za provjeru prijave bilo je potrebno razlikovati simulirani HTTP tok od stvarnih SQL upisa. Zato su testovi razdvojeni. Početni zapisnik na `bd785d4` nije uključivao stvarni Google tok; naknadni PR #44 potvrđuje lokalni kandidatski tok kroz Google i postojeću bazu. Stvarni poslodavački tok, restart s postojećom prijavom i produkcijska konfiguracija ostaju zasebne neprovedene provjere.

Kod rezervacija audicija trebalo je spriječiti prekoračenje kapaciteta pri istodobnim zahtjevima. Backend koristi zaključavanje i ograničenja baze ([PR #58](https://github.com/paolabbradaric/grupa122/pull/58)), a kandidatovo sučelje za odabir i promjenu termina povezano je naknadno ([PR #68](https://github.com/paolabbradaric/grupa122/pull/68)). Prikazi prijava i obavijesti naknadno su povezani s odgovarajućim API-jem ([PR #66](https://github.com/paolabbradaric/grupa122/pull/66)).

[Status zadatka #12](AUTENTIFIKACIJA.md#status-zadatka-12-i-potreban-završetak) i [kazalo](Home.md) vode na povezane dijelove dokumentacije.
