# Završna lokalna provjera smanjenog ZIP-a — 18. 11. 2026.

Provjerena je konkretna isporuka: main 1b0b44d složen je u novu lokalnu mapu i preko njega su dodane točno 23 datoteke iz zadnjeg ZIP-a. Potvrđeno je da tuđi admin/profilni testovi i zajednička dokumentacija odgovaraju izvornom mainu, a dodani workflow nije prisutan. GitHub, timska baza i stvarna pohrana nisu mijenjani.

| Provjera | Rezultat | Granica |
| --- | --- | --- |
| Redovni npm test bez posebnih DB varijabli | 181 uspješan, 11 preskočenih, 0 neuspješnih | Posebni DB testovi se preskaču |
| Svih 11 DB skupova testova zasebno, svaki na svježoj lokalnoj bazi | Svih 11 prolazi, bez preskočenih testova unutar tih skupova | Izolirani PostgreSQL 18, bez timskih podataka |
| Moderacijski PostgreSQL/HTTP test | 12 uspješnih uključujući nadređeni test | Pohrana i identitet u tom testu pripremljeni testnim kodom |
| Zajednički node --test uz uključene MODERATION, PROFILE i ADMIN DB varijable | 212 uspješnih, 1 neuspješan, 8 preskočenih | admin-database.test.js: asinkrona greška terminating connection due to administrator command nakon uspješnih asercija |
| Isto zajedničko pokretanje uz --test-concurrency=1 | 212 uspješnih, 1 neuspješan, 8 preskočenih | Analogna završna greška u profiles-database.test.js; ne tvrdi se da serijsko pokretanje rješava uzrok |
| Frontend lint i build točno složene isporuke | Prolaze | Statička provjera i produkcijski bundle |
| Cijeli izgrađeni React → produkcijski createApp/Passport → stvarni PostgreSQL | Prolazi opisani lokalni poslovni tok | Google provider zamijenjen testnim odgovorima; stvarni vanjski Google i Supabase nisu potvrđeni |

## Cijeli lokalni poslovni tok

Korištene su stvarne auth rute, OAuth state/PKCE tok kroz Passport, tri odvojena kolačića i tri sesije spremljene u PostgreSQL. Samo odgovori vanjskog Google providera zamijenjeni su sintetičkim identitetima; nije korišten stvarni Google račun niti stvarni token.

Izgrađeni frontend renderiran je u jsdomu i njegovi fetch zahtjevi stvarno su pozivali Express backend. Poslodavac je kroz profil poslao zahtjev, admin ga je preuzeo i odbio uz razlog, poslodavac ga je ponovno poslao, a admin preuzeo i odobrio. Zatim je kroz postojeći backend model stvoren i objavljen oglas odobrene organizacije. Kandidat ga je otvorio i prijavio kroz sučelje; admin je prijavu zatvorio bez brisanja. Nakon nove prijave admin je kroz sučelje potvrdio trajno brisanje. SQL provjere potvrdile su brisanje oglasa, pripadajuće kandidatske prijave, termina i rezervacije, očuvanje korisnika te obavijesti vlasniku i kandidatu. Statistika je prikazala stvarne agregate. Opoziv admin pristupa uklonio je panel nakon odgovora 403.

## Što ostaje izvan potvrde

- Stvarna Google prijava, privatni Supabase objekti i njihovo stvarno uklanjanje.
- Vizualni pregled u pravom pregledniku.
- Migracija i konfiguracija zajedničkog okruženja te prikaz/slanje obavijesti s Lucijinim modulom.
- Popravak izvornog admin/profilnog čišćenja testnih baza. Njihov WITH (FORCE) završetak nije mijenjan jer je izvan dogovorenog opsega. Poslovne asercije prolaze, ali zajednički test proces može završiti neuspješno zbog kasne greške prekida veze.

U ovom dodatnom pregledu funkcionalni kod iz prethodne smanjene verzije nije promijenjen. Dopunjeni su rezultati i ispisi provjera. Zaključak se odnosi na navedenu lokalnu isporuku, a ne na neprovjereno novije stanje GitHuba ili korisničkog računala.
