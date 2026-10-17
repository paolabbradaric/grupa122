# Tin – bilješke za backend

## Što sam zasad napravio

- Pokrenuo PostgreSQL na svom računalu i napravio lokalnu bazu.
- Učitao Mariovu SQL shemu uz par prilagodbi za PostgreSQL.
- Povezao Node.js backend s bazom.
- Dodao /health da možemo provjeriti rade li backend i baza.
- Napravio backend za probni upis kandidata i kompanija.
- Kod kompanije se sprema i zahtjev za provjeru sa statusom pending, odnosno na čekanju.

## Što sam provjerio

- Podaci se stvarno spremaju u bazu.
- Ne može se dvaput upisati ista e-adresa ili registracijski broj kompanije.
- Kandidat i predstavnik kompanije moraju imati barem 18 godina.
- Povezani zapisi spremaju se zajedno; ako nešto ne uspije, upis se poništava.

## Bitno za sad

Svatko ima svoju lokalnu bazu. Ovo je zasad probni upis, prava prijava preko OpenID Connecta još nije napravljena. Stare probne casting pozive iz koda sam maknuo; kasnije ih treba povezati s bazom.

## Što slijedi

Napraviti administratorski račun i backend koji administratoru dopušta vidjeti kompanije na čekanju te ih odobriti ili odbiti. Treba zapisati tko ih je provjerio, kada i razlog ako su odbijene.
