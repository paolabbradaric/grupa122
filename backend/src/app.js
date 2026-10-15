// Ugrađeni Node.js alat za web-poslužitelj.
const http = require("http");

// Koristi zadani port ili 10000 ako nije postavljen.
const port = process.env.PORT || 10000;

// Probni podaci; kasnije ih dohvaćamo iz baze.
const castings = [
  {
    id: 1,
    naziv: "Glavna uloga u studentskom filmu",
    opis: "Tražimo glumca ili glumicu za studentski kratki film.",
    lokacija: "Zagreb",
  },
  {
    id: 2,
    naziv: "Statisti za reklamu",
    opis: "Tražimo punoljetne statiste za snimanje reklame.",
    lokacija: "Split",
  },
];

// Ova funkcija obrađuje svaki dolazni zahtjev.
const server = http.createServer((req, res) => {
  // Razdvaja putanju i parametre iz adrese.
  const url = new URL(req.url, "http://localhost");

  // Provjera radi li poslužitelj.
  if (url.pathname === "/health") {
    res.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
    });

    return res.end(JSON.stringify({ status: "healthy" }));
  }

  // Dohvat popisa poziva uz opcionalne filtre.
  if (req.method === "GET" && url.pathname === "/castings") {
    // Čita lokaciju, uklanja rubne razmake i smanjuje slova.
    const lokacija = (url.searchParams.get("lokacija") || "")
      .trim()
      .toLocaleLowerCase("hr");

    // Na isti način priprema tekst za pretraživanje.
    const pretraga = (url.searchParams.get("pretraga") || "")
      .trim()
      .toLocaleLowerCase("hr");

    // Stvara novi popis samo od odgovarajućih poziva.
    const rezultati = castings.filter((poziv) => {
      // Bez filtra lokacije prihvaća svaki grad.
      const odgovaraLokacija =
        !lokacija ||
        poziv.lokacija.toLocaleLowerCase("hr") === lokacija;

      // Spaja naziv i opis za zajedničku pretragu.
      const tekst = `${poziv.naziv} ${poziv.opis}`
        .toLocaleLowerCase("hr");

      // Provjerava sadrži li tekst traženi niz znakova.
      const odgovaraPretraga =
        !pretraga || tekst.includes(pretraga);

      // Poziv mora zadovoljiti oba uvjeta.
      return odgovaraLokacija && odgovaraPretraga;
    });

    // Status 200 označava uspješan odgovor u JSON obliku.
    res.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
    });

    // Pretvara rezultate u JSON tekst i šalje odgovor.
    return res.end(JSON.stringify(rezultati));
  }

  // Dohvat pojedinog poziva, primjerice /castings/1.
  if (req.method === "GET" && url.pathname.startsWith("/castings/")) {
    // Izdvaja ID iz putanje i pretvara ga u broj.
    const id = Number(url.pathname.slice("/castings/".length));

    // Traži poziv s odgovarajućim ID-em.
    const casting = castings.find((poziv) => poziv.id === id);

    // Vraća 200 ako postoji, inače 404.
    res.writeHead(casting ? 200 : 404, {
      "Content-Type": "application/json; charset=utf-8",
    });

    // Šalje pronađeni poziv ili poruku da ne postoji.
    return res.end(
      JSON.stringify(
        casting || { poruka: "Casting poziv ne postoji." }
      )
    );
  }

  // Trenutačni zadani odgovor za ostale putanje.
  res.writeHead(200, {
    "Content-Type": "text/plain; charset=utf-8",
  });

  res.end("API running");
});

// Pokreće slušanje zahtjeva na odabranom portu.
server.listen(port, "0.0.0.0", () => {
  console.log(`Server listening on 0.0.0.0:${port}`);
});