# Tin – bilješke za backend

## Što sam zasad napravio

- Pokrenuo PostgreSQL na svom računalu i napravio lokalnu bazu `cast_me_if_you_can`.
- Učitao  SQL shemu uz nekoliko prilagodbi za PostgreSQL.
- Povezao Node.js backend s bazom pomoću paketa `pg`.
- Postavke povezivanja stavio u `.env`, koji ostaje lokalan. Dodao `.env.example` da ostali mogu složiti svoje postavke.
- Dodao `/health` za provjeru rade li backend i veza s bazom.
- Napravio backend za lokalni probni upis kandidata i kompanija.

Kod kandidata se sprema korisnički račun u `users` i njegov profil u `candidate_profiles`.

Kod kompanije se sprema račun predstavnika, kompanija u `organisations` i zahtjev za provjeru u `verification`. Zahtjev dobiva status `pending`, odnosno na čekanju. Kompanija time još nije odobrena.

## Kako radi upis

Backend prima podatke u JSON obliku, provjerava ih i zatim ih sprema u bazu.

Provjeravaju se obvezna polja, duljine teksta, oblik e-adrese, datum rođenja i dobna granica 18+. Ulogu korisnika i početni status verifikacije postavlja backend.

Povezani zapisi spremaju se u jednoj transakciji. Ako, primjerice, spremanje kompanije ne uspije, poništava se i upis njezina predstavnika kako ne bi ostali djelomično spremljeni podaci.

## Što sam provjerio

- Backend se uspješno spaja na PostgreSQL.
- `/health` vraća potvrdu da backend i baza rade.
- Kandidat i njegov profil stvarno se spremaju u bazu.
- Kompanija se sprema zajedno s predstavnikom i zahtjevom na čekanju.
- Ne može se dvaput upisati ista e-adresa ili registracijski broj kompanije.
- Kandidat i predstavnik kompanije moraju imati barem 18 godina.

Provjere sam zasad radio ručno. Pravi automatski testovi još nisu dodani; postojeći `npm test` samo ispisuje poruku o uspjehu.

## Bitno za sad

Svatko ima svoju lokalnu bazu. Preko Gita dijelimo kod i SQL shemu, ali ne i podatke koje smo unijeli u svoje baze.

Ovo je zasad probni upis podataka, a ne prava registracija i prijava. OpenID Connect još nije povezan. Probni upis uključuje se postavkom `DEV_REGISTRATION=true` i tada backend sluša samo na lokalnom računalu.

Stare probne casting pozive iz koda sam maknuo. Dohvat poziva, detalje, pretraživanje i filtriranje kasnije treba ponovno napraviti nad bazom.

## Što slijedi

Napraviti administratorski račun i provjeru njegovih ovlasti na backendu.

Administrator treba moći:
- Vidjeti kompanije koje čekaju provjeru.
- Odobriti kompaniju.
- Odbiti zahtjev uz razlog.

Uz odluku treba spremiti tko je pregledao zahtjev i kada. Treba provjeriti i da obični korisnik ne može pristupiti tim funkcionalnostima.

Kad krenemo raditi objavljivanje casting poziva, backend treba dopustiti objavu samo odobrenim kompanijama.