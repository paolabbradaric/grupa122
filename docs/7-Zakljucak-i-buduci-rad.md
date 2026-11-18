# 7. Zaključak i budući rad

Opseg: rezultat baze i autentifikacije od 17. 11. 2026. Završni zaključak cijelog projekta treba dopuniti nakon zajedničke provjere svih poslovnih tokova.

## 7.1 Rezultati doprinosa

Izrađeni su relacijski model i PostgreSQL shema, migracije limita i nacrta, zajednička TLS veza, Google/Passport prijava, registracija kandidata i poslodavaca, serverske sesije, odjava i middleware ovlasti. Frontend prepoznaje stvarnog korisnika i njegovu serversku ulogu; nema samostalnog odabira administratora.

Kod je uključen kroz PR-ove #23, #25, #29 i #31. Odgovornosti, API ugovor, model, instalacija i dokazi povezani su iz [kazala](Home.md). Na reviziji `bd785d4` dana 17. 11. prošli su 11 auth testova, 1 auth DB test i 10 draft testova/podtestova; tadašnji redovni backend paket imao je 139 uspješnih i 8 preskočenih testova. Frontend lint i build prošli su. [Zapisnik](verification/2026-11-17/README.md) čuva to početno izvođenje i objašnjava simulacije i preklapanje paketa; brojevi nisu dokaz potpune pokrivenosti.

Naknadni [PR #44](https://github.com/paolabbradaric/grupa122/pull/44) potvrđuje konfiguraciju lokalnog Google OAuth klijenta, stvarnu kandidatsku registraciju, osvježavanje, odjavu i ponovnu prijavu u isti račun bez duplikata. U toj dopuni prolazi 14 auth testova, redovni paket ima 142 uspješna i 8 preskočenih testova, a auth DB test te frontend lint/build prolaze. [Google prijava](GOOGLE_PRIJAVA.md) razlikuje te rezultate od početnog zapisnika i navodi točan opseg stvarne provjere.

## 7.2 Izazovi i naučene lekcije

Promjenu zahtjeva za autentifikaciju treba pratiti kroz sve dokumente: stari zadatak za lozinke ne opisuje noviji dogovor o OAuth/OIDC prijavi. Identitet, lokalna uloga i vlasništvo zapisa imaju zasebne provjere. Ograničenja baze štite integritet, ali ne provode cjelokupne ovlasti ili poslovni tok.

Migracije omogućuju očuvanje baze, uz cijenu provjere početnog stanja i redoslijeda. Simulirani HTTP test, stvarni SQL test i stvarna prijava kroz Google pružaju različite dokaze. Prva dva provjeravaju auth ugovor i pohranu, a zasebna provjera iz PR-a #44 potvrđuje opisane lokalne kandidatske scenarije kroz vanjski servis. [Aktivnosti i izazovi](A-Pregled-aktivnosti-grupe.md) povezuju odluke s konkretnim rezultatima.

## 7.3 Preostali rad

Za dovršetak stvarne Google provjere treba izvesti prvi i ponovljeni poslodavački ulazak te ručno otkazivanje na Googleovoj stranici i provjeru predviđenih organizacijskih računa. Kandidatska registracija, ponovna prijava, osvježavanje i odjava već su potvrđeni u lokalnom okruženju. Ponovna uporaba starog cookieja pokrivena je HTTP testom; stvarni restart sustava uz očuvanje postojeće prijave ostaje neprovjeren.

Za profile i portfolio treba dovršiti trajni API izmjene profila i pohrane datoteka; lokalna demonstracijska pohrana nije dovršena funkcionalnost F-004–F-005.

Za demo admin račun treba potvrditi ograničeni demo račun i njegovu namjenu bez tajni u Gitu.

Provjeru vlasništva treba provesti s autorima poslovnih modula provjeriti tuđe podatke, verifikaciju, oglase, prijave i audicije.

Prije produkcijske uporabe treba potvrditi javni URL, HTTPS/proxy, manje privilegiran DB račun, zajednički limiter, povratne kopije i oporavak.

Za provjeru kvalitete treba izvesti planirane provjere preglednika, pristupačnosti, rezolucija i opterećenja prije tvrdnje da su ti zahtjevi ispunjeni.

To su nedovršeni ili neprovjereni dijelovi postojećeg opsega, a ne samo neobavezna buduća poboljšanja. Zadatak #12 i cijeli projekt ne zatvaraju se samom dokumentacijskom dopunom.

[Ispitivanje](5-Ispitivanje.md), [Status auth zadatka](AUTENTIFIKACIJA.md#status-zadatka-12-i-potreban-završetak)
