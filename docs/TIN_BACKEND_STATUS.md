# Tin Škarpa — stanje backenda

Ažurirano 18. 11. 2026., prema mainu `996b965` i dokazima produkcijske
objave `dc88406`. Prati [Issue #16](https://github.com/paolabbradaric/grupa122/issues/16).
Označena backend implementacija ne znači da je cijeli korisnički tijek već
provjeren kroz produkcijsko sučelje. Issue ostaje otvoren do završetka integracije
te razrješenja preostalih stavki specifikacije.

## Završeno i potkrijepljeno kodom/testovima

| Područje | Provjereno stanje |
| --- | --- |
| Projekt i oglas | Novi nacrt stvara zaseban projekt i jednu ulogu; DB `project_unique` štiti odnos. `positions_count` i `max_applications` zasebni su, zadani limit prijava je 1000. |
| Poslodavčevi oglasi | Stvaranje/uređivanje vlastitog nacrta, objava verificiranog poslodavca, vlastiti popis, zatvaranje prijava i otkazivanje. Uređivanje trenutačno dopušta samo `draft`. |
| Javni oglasi | Javni popis i detalji samo `published` oglasa, validirani filtri i pretraga. Istek roka blokira predaju, ali sam ne mijenja status oglasa. |
| Predaja prijave | Sesijski identitet kandidata, objavljen oglas, rok, limit, jedna prijava po kandidatu/oglasu uz UNIQUE i transakciju; PostgreSQL limiter 10 pokušaja/15 minuta po korisniku. |
| Vlastite prijave | GET samo prijavljenog kandidata; povlačenje samo iz SUBMITTED, UNDER_REVIEW, SHORTLISTED i INVITED. Aktivna rezervacija daje 409 dok se zasebno ne otkaže. Povlačenje, povijest i obavijest jedna su transakcija. |
| Pregled i statusi | Poslodavac čita/mijenja samo prijave svojih oglasa. Poseban admin GET traži postojeći Google dokaz, DB ulogu i allowlistu. Prijelazi statusa i odbijanje s razlogom su zaštićeni. |
| Konačni odabir | `AUDITIONED → ACCEPTED`; poslovni ishod ostaje `selected`. Dosezanje `positions_count` daje `filled`, preostale nezavršene prijave REJECTED. |
| Otkazivanje | Oglas `cancelled` daje CANCELLED nepovučenim prijavama osim već odbijenih/otkazanih. Završetak oglasa obrađuje buduće termine i aktivne rezervacije, povijest i privatne obavijesti u istoj transakciji. |
| Audicije | Rezervacija, atomska promjena i otkazivanje vlastitog termina; poslodavčev pregled i evidencija dolaska. DB guard i indeks štite kapacitet i jednu aktivnu rezervaciju, uključujući konkurentne upise. |
| Ovlasti | Postojeća autentifikacija, Origin/CSRF, ograničenja uloga, RLS i izričite write potvrde/TLS ostaju aktivni; nema proširenja admin ovlasti na poslodavčeve mutacije. |

Dokumenti API-ja: [javni oglasi](JAVNI_OGLASI_API.md),
[limiter predaje](OGRANICENJE_PRIJAVA_API.md),
[kandidatove prijave](PRIJAVE_KANDIDATA_API.md),
[audicije i obavijesti](AUDICIJE_OBAVIJESTI_API.md),
[profili i pohrana](PROFILNI_API.md).

## Integracija i stvarno preostali posao

- [x] Tarin PR #62 povezuje statusni PATCH, konačni odabir `AUDITIONED → ACCEPTED`
  i poslodavčev rad s audicijama. Potvrđeno iz koda; produkcijski UI prihvat
  i dalje ostaje zasebna otvorena provjera.
- [ ] Povezati kandidatove vlastite prijave/povlačenje i obavijesti s API-jem
  te provjeriti rezervacije kroz sučelje. Rein PR #63 uređuje izgled, ali
  `CandidateApplications` još ima prazni lokalni popis, a `CandidateNotifications`
  lokalno stanje bez API dohvata/spremanja.
- [ ] Dogovoriti traži li specifikacija zasebna polja za žanr/scenarij ili
  postojeći `audition_text` pokriva dogovoreni sadržaj; zasebnih polja sada nema.
- [ ] Potvrditi smiju li se uređivati i objavljeni oglasi te treba li istek
  roka automatski mijenjati status. Implementirana ograničenja opisana su gore;
  automatska promjena statusa i šire uređivanje nisu potvrđeni zahtjevi.
- [ ] Proći cijeli produkcijski demo stvarnim poslodavčevim i kandidatovim
  računom te potvrditi upload kroz prijavljeno sučelje. Puni lokalni HTTP/SQL
  tijek i izolirani Storage adapter probe nisu zamjena za tu provjeru.
- [ ] Potvrditi završni timski pregled i tek potom zatvoriti Issue #16.

Hitni [PR #64](https://github.com/paolabbradaric/grupa122/pull/64) spojen je kao
`996b965`: javni GET vraća numerički `accepted_count` (ACCEPTED + SELECTED,
0 bez prihvaćenih); predaja nakon zaključavanja ponovno provjerava rok i oba
limita. Prazno tijelo `{}` ostaje dopušteno.

Ninin [PR #59](https://github.com/paolabbradaric/grupa122/pull/59) već je spojen:
Home šalje location/age/requirements filtre API-ju, a tipove projekta i tekst
iz navigacije filtrira lokalno. Detalji povezuju predaju prijave. To je potvrđeno
iz koda; ne vodi se kao nedostajuća backend funkcionalnost.

Prema [podjeli rada](RAZVOJNI_PLAN.md), vanjsko slanje e-pošte F-023 (ranije F-034) pripada
Lucijinu području: provider i događaji dostave još nisu odabrani. Trenutačne
obavijesti su privatni zapisi dostupni API-jem. Tin sudjeluje u povezivanju
casting/application događaja. Operativni raspored čišćenja profilne pohrane
još treba potvrditi s odgovornima za profile/objavu; nije potvrđen ovim radom.

## Merge, migracije i produkcijska provjera

Relevantni spojeni PR-ovi:
[#50](https://github.com/paolabbradaric/grupa122/pull/50) — vlastite prijave,
[#53](https://github.com/paolabbradaric/grupa122/pull/53) — javni API/limiter,
[#56](https://github.com/paolabbradaric/grupa122/pull/56) — produkcijska shema/TLS,
[#57](https://github.com/paolabbradaric/grupa122/pull/57) — sigurnost baze,
[#58](https://github.com/paolabbradaric/grupa122/pull/58) — završetak booking/closure tijeka.

Profilna i moderacijska shema kontrolirano su primijenjene kroz rad PR-a #56.
Nakon odobrenja ciljanih migracija i upisa, 18. 11. u jednoj transakciji
primijenjeni su guard povlačenja, brojač predaje, guard booking kapaciteta te
sigurnosna migracija iz PR-a #57. Potvrđeni su očuvanje postojećih poslovnih
redaka, sva tri invoker guarda, jedinstveni indeks i RLS. To nije odobrenje
za pokretanje testnih skupova s upisima nad zajedničkom bazom.

Kandidatovi i poslodavčevi write flagovi uključeni su za Production uz potvrde
i TLS; preview nije aktiviran. Privatni bucket `profiles` i stvarni adapter
upload/download/remove provjereni su vlastitim privremenim objektom koji je
uklonjen; javni pristup odbijen je. Serverski ključ na Vercelu je Sensitive,
nijedna njegova vrijednost nije dio dokumentacije.

Objava [dpl_EMwGSxgTXsyCDMi3tCNZCACUB52x](https://vercel.com/grupa122/grupa122/EMwGSxgTXsyCDMi3tCNZCACUB52x)
commita `dc88406` potvrđena je READY na [produkcijskoj adresi](https://grupa122.vercel.app).
HTML/JS/CSS i javni API vraćali su 200; nove privatne rute bez sesije 401/no-store.
Sintetički probe stvarnim modelima na produkcijskoj shemi prošao je i svi su
probni retci vraćeni rollbackom. Safari UI provjera nije potvrđena zbog
pogreške snimanja zaslona. Ovi rezultati odnose se na navedenu objavu, a ne
na nepotvrđene kasnije objave, uključujući Ninin frontend merge.

## Dokazi testiranja

[CI za konačni HEAD PR-a #58](https://github.com/paolabbradaric/grupa122/actions/runs/44367655216):

| Zasebni proces | Prošlo | Neuspješno | Preskočeno |
| --- | ---: | ---: | ---: |
| npm test | 248 | 0 | 16 opt-in DB |
| Sigurnosni DB | 17 | 0 | 0 |
| Admin/profili/moderacija DB | 31 | 0 | 0 |
| Auth/nacrti/javni API/limiter/novi puni HTTP+SQL tijek | 28 | 0 | 0 |

Dodatni lokalni npm test sa starim status/selection/withdrawal DB skupovima:
283 prolaza, 0 padova, 13 opt-in preskakanja. Brojevi uključuju roditeljske
testove node:test u zasebnim procesima; nisu zbroj jedinstvenih scenarija.
Detalji su u [zapisniku PR-a #58](verification/2026-11-18/backend-completion.md).
Ovo dokumentacijsko ažuriranje ne predstavlja novo pokretanje tih testova.


## Dodatni dokazi hitnog popravka #64

[CI commita `6ed3ef4`](https://github.com/paolabbradaric/grupa122/actions/runs/44401656706)
prošao je sve korake. Lokalno: 45 ciljanih provjera; npm test 250 prolaza,
0 padova i 16 opt-in preskakanja; novi SQL/HTTP skup 8 prolaza te postojeći
application DB/HTTP skupovi 13 prolaza bez preskakanja. Stara lokalna testna
baza dobila je već postojeću migraciju limitera prije uspješnog ponavljanja
HTTP regresije; produkcijska migracija za ovaj hotfix nije potrebna.


Objava [dpl_7C8ZAwE2h3hm9kk7mCp9utngVPmq](https://vercel.com/grupa122/grupa122/7C8ZAwE2h3hm9kk7mCp9utngVPmq)
commita `996b965` potvrđena je READY. Javni produkcijski popis i detalji svih
9 tada objavljenih oglasa vraćali su numerički `accepted_count` (0 u tadašnjim
podacima). POST gosta vraćao je 401 bez poslovnog upisa. CI #64 potvrđuje
250 standardnih prolaza uz 16 opt-in preskakanja te DB procese 17 + 31 + 30
prolaza bez padova ili preskakanja. Stvarni prijavljeni produkcijski UI tijek
ostaje zasebna otvorena provjera.
