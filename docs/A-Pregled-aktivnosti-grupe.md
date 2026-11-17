# A. Pregled aktivnosti grupe

**Dopuna:** 17. 11. 2026. Ovdje su potvrđena podjela rada i dokazivi doprinosi baze/autentifikacije. Nisu rekonstruirani radni sati ni sastanci iz broja commitova.

## A.1 Evidencija sastanaka

U pregledanom repozitoriju nema popunjene evidencije sastanaka koja bi potkrijepila datume, sudionike i trajanje rada za ovaj doprinos. Tim treba unijeti stvarne zapise ako ih vodi. Postojanje predloška nije dokaz održanog sastanka. Projektne odluke za ovaj tekst potkrijepljene su [razvojnim planom](RAZVOJNI_PLAN.md), zadacima i PR-ovima.

## A.2 Plan rada

Izvorni redoslijed ostaje u razvojnom planu; dovršenost se provjerava kroz kod, PR i ispitivanje.

| Područje | Odgovornost i ovisnost |
| --- | --- |
| Temelji | Mario: baza, migracije, prijava i middleware; ugovor za Reu i backend kolege. |
| Oglasi i prijave | Tin, Nina i Tara: poslovna pravila i korisničko sučelje na DB/auth temeljima. |
| Audicije i obavijesti | Lucija: povezivanje termina, prijava i rezervacija. |
| Verifikacija i moderacija | Paola uz Tarino sučelje: verifikacija, obrada i integracija. |
| Završna provjera | Integracija i dokazi po područjima; dokumentacija ne zatvara neizvedene sustavske scenarije. |

## A.3 Aktivnosti i doprinosi članova

Tablica bilježi Mariov dio koji je provjeren ovom dopunom; nije potpuna osobna evidencija svih članova. Sati nisu dostavljeni pa nisu procijenjeni.

| Aktivnost | Član | Prijavljeni sati | Dokaz |
| --- | --- | --- | --- |
| Početni ER model i SQL shema, 17. 10. 2026. | Mario Halužan | Nisu evidentirani | [dfc3527](https://github.com/paolabbradaric/grupa122/commit/dfc3527), [2db2a8f](https://github.com/paolabbradaric/grupa122/commit/2db2a8f). |
| Limit prijava, jedinstveni projekt i migracija, 27.–28. 10. | Mario Halužan | Nisu evidentirani | [PR #23](https://github.com/paolabbradaric/grupa122/pull/23). |
| Zajednička PostgreSQL veza i TLS, 29. 10. | Mario Halužan | Nisu evidentirani | [PR #25](https://github.com/paolabbradaric/grupa122/pull/25). |
| Google prijava, registracija, sesije, validacija i ovlasti, 3. 11. | Mario Halužan | Nisu evidentirani | [PR #29](https://github.com/paolabbradaric/grupa122/pull/29). |
| React integracija stvarnog korisnika i API upute | Mario Halužan, nad postojećim frontendom kolegica | Nisu evidentirani | Isti PR #29, [auth ugovor](AUTENTIFIKACIJA.md). |
| Nepotpuni nacrti, zaštita objave, migracija i DB testovi, 4. 11. | Mario Halužan | Nisu evidentirani | [PR #31](https://github.com/paolabbradaric/grupa122/pull/31). |
| Dokumentacijska dopuna i ponavljanje postojećih provjera, 17. 11. | Na Mariov zahtjev, uz Codex pomoć | Nisu evidentirani | [Kazalo i izjava o AI-ju](Home.md), [zapisnik](verification/2026-11-17/README.md). |

Četiri pripadajuća merge commita dokazuju uključivanje u main; nisu četiri dodatne zasebne implementacije. Poslovna logika oglasa, prijava, odabira i audicija ne pripisuje se Mariju zbog uporabe njegova middlewarea.

## A.4 Pregled promjena u repozitoriju

[GitHub Contributors](https://github.com/paolabbradaric/grupa122/graphs/contributors) i [commitovi računa mariohaluzan](https://github.com/paolabbradaric/grupa122/commits/main/?author=mariohaluzan) dodatno potkrepljuju doprinos. Ovaj pregled implementacije obuhvaća 17. 10.–4. 11. 2026., uz dokumentacijsku provjeru od 17. 11. Broj commitova nije mjera sati ili kvalitete i ne prikazuje sav integracijski rad.

## A.5 Inženjerski izazovi i rješenja

| Izazov | Radnja i dokaz | Ishod / preostalo |
| --- | --- | --- |
| Različito značenje mjesta i limita prijava | Odvojeni positions_count i max_applications, zadano 1000; PR #23. | Baza sprema pravila, a brojanje/konkurencija prijava pripada poslovnom API-ju. |
| Nepotpuni nacrt nasuprot potpunoj objavi | Ukinut dio NOT NULL pravila i dodan CHECK za sve nenacrte; PR #31 i DB testovi. | Draft se može postupno uređivati; nepotpuna objava odbija se i izravnim SQL-om. |
| Zadržavanje postojeće baze i aplikacijskog okvira | SQL migracije i prilagodba auth pristupa Expressu/pg-u; PR #29. | Nije uveden NestJS/ORM samo radi prijave; preduvjete migracija treba provjeriti. |
| Pouzdana zajednička veza | TLS uz javni CA i privatne PG varijable; PR #25. | Pristupni podaci nisu u frontendu; manja prava aplikacijskog računa ostaju otvorena. |
| Razlika simulacije i cijelog sustava | Odvojeni HTTP auth i stvarni DB testovi, javno navedena ograničenja. | Automatizirane provjere prolaze, ali stvarni Google tok nije potvrđen njima. |

[Status zadatka #12](AUTENTIFIKACIJA.md#status-zadatka-12-i-potreban-završetak) · [Kazalo](Home.md)
