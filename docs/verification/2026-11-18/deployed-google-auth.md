# Google prijava na javnoj domeni — 18. 11. 2026.

## Okruženje i uzrok

- Javna domena: `https://grupa122.vercel.app`.
- Pregled i testovi temelje se na `main` / `origin/main` reviziji `7295939`.
- GitHub za tu reviziju bilježi uspješan Vercel status s
  [deploymentom](https://vercel.com/grupa122/grupa122/5J4TpZ3XtSVpot4okLV23BSYgGXz).
  Taj status sam ne dokazuje da javni alias trenutačno pokazuje na taj deployment.
  Aktivni deployment ID, SHA i Vercel target Production/Preview nisu neovisno
  potvrđeni: konektor vraća 403 za tim `grupa122`. Deployment održava kolega.
- Dokumentirani preview `https://grupa122-tin-preview-grupa122.vercel.app`
  preusmjerava na Vercel Authentication. Nije korišten za provjeru Google prijave.

Prije popravka javni `GET /api/auth/google` vraćao je 302 na Google uz
`redirect_uri=https://grupa122.vercel.app/api/auth/google/callback`.
Google je taj zahtjev odbijao s `redirect_uri_mismatch`. Korišteni client ID
uspoređen je s privatnom lokalnom konfiguracijom i jednak je; tajne nisu ispisane.
Postojeći callback nije trebalo mijenjati u aplikaciji.

Održavatelj je u istom Google OAuth web-klijentu spremio dodatni **Authorized
redirect URI** `https://grupa122.vercel.app/api/auth/google/callback` uz sačuvan
`http://localhost:3000/api/auth/google/callback`. Ponovljeni stvarni Google zahtjev
otvara stranicu za prijavu (`/v3/signin/identifier`), bez `redirect_uri_mismatch`.
Nije bilo promjena runtime konfiguracije, tajni, baze ni novog deploymenta.

## Mrežne provjere javne aplikacije

| Provjera | Rezultat |
| --- | --- |
| `GET /` | 200, frontend HTML. |
| Anonimni `GET /api/auth/me` | 401 `AUTH_REQUIRED`, `Cache-Control: no-store`, bez novog cookieja. |
| `GET /api/auth/google` | 302 na Google, točan javni callback, `openid email profile`, state prisutan i PKCE S256. |
| Cookie početka prijave | `Secure; HttpOnly; SameSite=Lax; Path=/`. Vrijednost cookieja nije zabilježena. |
| Callback s `error=access_denied` | 302 na javnu domenu s `authError=access_denied`. Simuliran otkazni odgovor, bez klikanja Cancel kod Googlea. |
| Callback s nevaljanim kodom i pogrešnim stateom | 302 na javnu domenu s `authError=oauth_failed`. |
| Callback s nevaljanim kodom bez statea | 302 na javnu domenu s `authError=oauth_failed`. |
| Registracija lokalnog callbacka kod istog Google klijenta | Google prihvaća `http://localhost:3000/api/auth/google/callback` i otvara stranicu za prijavu, bez `redirect_uri_mismatch`. Ovo ne provjerava lokalnu sesiju. |

State, cookieji, kodovi i tokeni iz stvarne autorizacije nisu pohranjeni u ovom
zapisniku. Privatni `NODE_ENV`, `SESSION_SECRET`, `FRONTEND_URL` i
`TRUST_PROXY_HOPS` nisu čitani iz Vercela; opaženo ponašanje nije dokaz njihovih
pojedinačnih vrijednosti. Runtime callback i povratna domena potvrđeni su odgovorima.

## Stvarni korisnički tok

Korisnik je nakon spremanja callbacka u svojem pregledniku potvrdio:

- Prijavu na javnoj domeni svojim postojećim administratorskim računom.
- Otvaranje `/admin`.
- Očuvanje prijave nakon osvježavanja stranice.
- Odjavu i ponovnu prijavu istim računom.

Ovo je korisnička potvrda stvarnog toka, odvojena od automatiziranih provjera.
Prijavljeni `/api/auth/me`, stvarni onboarding novog kandidata/poslodavca i SQL
provjera identiteta i izostanka duplikata nisu zasebno izvedeni na deploymentu.
Nisu izvršeni nepovezani upisi, migracije, cleanup ni promjene RLS-a ili write zastavica.

## Automatske provjere

- `npm ci` u oba paketa: prolazi. Prvi pokušaj ciljanih testova prije instalacije
  ovisnosti nije se mogao pokrenuti jer je u lokalnom `node_modules` nedostajao
  `multer`; nakon instalacije prema postojećem lockfileu testovi prolaze.
- Backend `node --test test/auth.test.js test/admin.test.js test/vercel-entrypoint.test.js`:
  **55 prolazi, bez pada**.
- Backend `npm test`: **240 prolazi, 13 opt-in DB testova preskočeno, bez pada**.
- Frontend `npm run build`: **prolazi**. Frontend nije mijenjan.

Nove auth provjere koriste stvarni Express, Passport, state i PKCE, uz simulirani
Google HTTP odgovor, korisnički model i memorijski session store. Provjeravaju
HTTPS callback i povratnu domenu čak i uz podmetnut Host, sigurne host-only
cookieje iza pouzdanog proxyja, onboarding novog kandidata, očuvanje uloge
postojećeg poslodavca, obnovu sesije, odjavu, odbijanje starog cookieja i ponovnu
prijavu bez dodatne registracije. Bez HTTPS-a ili povjerenja u proxy ne šalje se
Secure cookie i callback ne otvara prijavljenu sesiju. Postojeći testovi i dalje
provjeravaju lokalni tok, state/PKCE, CSRF i administratorske ovlasti.

## Preostale provjere održavatelja

Na koleginu Vercel računu potvrditi koji deployment i commit poslužuju javni alias
i pripada li on targetu Production. Za javnu domenu održavati:

```text
NODE_ENV=production
FRONTEND_URL=https://grupa122.vercel.app
GOOGLE_CALLBACK_URL=https://grupa122.vercel.app/api/auth/google/callback
```

Sačuvati postojeće valjane `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` i
`SESSION_SECRET`. Dokumentirani izravni Vercel proxy koristi `TRUST_PROXY_HOPS=1`;
potvrditi stvarnu topologiju, bez proširivanja povjerenja napamet. Svaka buduća env
promjena zahtijeva novi deployment odgovarajućeg okruženja. Preview konfiguraciju
održavati zasebno i provjeravati na njegovu stabilnom aliasu. Lokalni tok u ovom
krugu pokriven je automatskim testovima; stvarna lokalna prijava nije ponovljena.

Službeni izvori: [Google OAuth callback pravila](https://developers.google.com/identity/protocols/oauth2/web-server#redirect-uri-validation),
[Vercel Services routing](https://vercel.com/docs/services/routing).
