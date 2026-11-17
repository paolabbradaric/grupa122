# 7. Zaključak i budući rad

Opseg: rezultat baze i autentifikacije od 17. 11. 2026. Završni zaključak cijelog projekta treba dopuniti nakon zajedničke provjere svih poslovnih tokova.

## 7.1 Rezultati doprinosa

Izrađeni su relacijski model i PostgreSQL shema, migracije limita i nacrta, zajednička TLS veza, Google/Passport prijava, registracija kandidata i poslodavaca, serverske sesije, odjava i middleware ovlasti. Frontend prepoznaje stvarnog korisnika i njegovu serversku ulogu; nema samostalnog odabira administratora.

Kod je uključen kroz PR-ove #23, #25, #29 i #31. Odgovornosti, API ugovor, model, instalacija i dokazi sada su povezani iz [kazala](Home.md). Dana 17. 11. prošli su 11 auth testova, 1 auth DB test i 10 draft testova/podtestova; aktualni redovni backend paket imao je 139 uspješnih i 8 preskočenih testova. Frontend lint i build prošli su. [Zapisnik](verification/2026-11-17/README.md) objašnjava simulacije i preklapanje paketa; brojevi nisu dokaz potpune pokrivenosti.

## 7.2 Izazovi i naučene lekcije

Promjenu zahtjeva za autentifikaciju treba pratiti kroz sve dokumente: stari zadatak za lozinke ne opisuje noviji dogovor o OAuth/OIDC prijavi. Identitet, lokalna uloga i vlasništvo zapisa imaju zasebne provjere. Ograničenja baze štite integritet, ali ne provode cjelokupne ovlasti ili poslovni tok.

Migracije omogućuju očuvanje baze, uz cijenu provjere početnog stanja i redoslijeda. Razlikovanje simuliranog HTTP testa i stvarnog SQL testa sprječava zaključak da je vanjska Google integracija već potvrđena. [Aktivnosti i izazovi](A-Pregled-aktivnosti-grupe.md) povezuju odluke s konkretnim rezultatima.

## 7.3 Preostali rad

Za stvarnu Google prijavu treba konfigurirati ili potvrditi OAuth klijent i izvesti prvi/ponovljeni ulazak obiju uloga, osvježavanje i odjavu kroz preglednik.

Za profile i portfolio treba dovršiti trajni API izmjene profila i pohrane datoteka; lokalna demonstracijska pohrana nije dovršena funkcionalnost F-006–F-008.

Za demo admin račun treba potvrditi ograničeni demo račun i njegovu namjenu bez tajni u Gitu.

Provjeru vlasništva treba provesti s autorima poslovnih modula provjeriti tuđe podatke, verifikaciju, oglase, prijave i audicije.

Prije produkcijske uporabe treba potvrditi javni URL, HTTPS/proxy, manje privilegiran DB račun, zajednički limiter, povratne kopije i oporavak.

Za provjeru kvalitete treba izvesti planirane provjere preglednika, pristupačnosti, rezolucija i opterećenja prije tvrdnje da su ti zahtjevi ispunjeni.

To su nedovršeni ili neprovjereni dijelovi postojećeg opsega, a ne samo neobavezna buduća poboljšanja. Zadatak #12 i cijeli projekt ne zatvaraju se samom dokumentacijskom dopunom.

[Ispitivanje](5-Ispitivanje.md), [Status auth zadatka](AUTENTIFIKACIJA.md#status-zadatka-12-i-potreban-završetak)
