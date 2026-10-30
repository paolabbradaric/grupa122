# Povezivanje backenda s bazom

Backend koristi PostgreSQL, uključujući PostgreSQL bazu na Supabaseu.

1. U direktoriju `backend` pokrenite `npm ci`.
2. Kopirajte `.env.example` u `.env`. Primjer sadrži adresu zajedničke razvojne baze; lozinku baze preuzmite sigurnim kanalom od vlasnika projekta i upišite je u `PGPASSWORD`.
3. Za Supabase ostavite `PGSSL=true` i `PGSSLROOTCERT=certs/supabase-ca.crt`. Certifikat je javni Supabase CA certifikat; provjeru certifikata treba ostaviti uključenu.
4. Pokrenite backend naredbom `node src/app.js`.

`.env` sadrži tajne i ne šalje se u Git. Primjer `.env.example` ne smije sadržavati lozinke. Kod za pristup bazi izvršava se na backendu; database lozinka i privilegirani ključevi ne smiju biti u frontendu.

Za lokalni PostgreSQL bez TLS-a moguće je postaviti `PGSSL=false` i ostaviti `PGSSLROOTCERT` praznim. Promjena lokalnih datoteka ne ažurira automatski bazu u Supabaseu.
