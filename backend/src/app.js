const http = require("http");
const port = process.env.PORT || 10000;

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

const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ status: "healthy" }));
  }

  if (req.method === "GET" && req.url === "/castings") {
    res.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
    });
    return res.end(JSON.stringify(castings));
  }

    if (req.method === "GET" && req.url.startsWith("/castings/")) {
    const id = Number(req.url.slice("/castings/".length));
    const casting = castings.find((poziv) => poziv.id === id);

    res.writeHead(casting ? 200 : 404, {
      "Content-Type": "application/json; charset=utf-8",
    });

    return res.end(
      JSON.stringify(casting || { poruka: "Casting poziv ne postoji." })
    );
  }

  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("API running");
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Server listening on 0.0.0.0:${port}`);
});