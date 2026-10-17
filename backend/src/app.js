const http = require("http");
const fs = require("fs");
const path = require("path");
const pool = require("./config/database");
const registerCandidate = require("./candidate-registration");

const port = process.env.PORT || 10000;
const devRegistration = process.env.DEV_REGISTRATION === "true" &&
  process.env.NODE_ENV !== "production";

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");

  // Probni obrazac dostupan je samo kada je uključen lokalni način rada.
  if (devRegistration && req.method === "GET" && url.pathname === "/") {
    const filePath = path.join(__dirname, "../../frontend/public/registration.html");
    return fs.readFile(filePath, (error, html) => {
      if (error) {
        res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
        return res.end("Obrazac nije moguće učitati.");
      }
      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      });
      return res.end(html);
    });
  }

  // POST šalje unesene podatke funkciji za provjeru i spremanje.
  if (devRegistration && req.method === "POST" && url.pathname === "/dev/candidates") {
    return registerCandidate(req, res);
  }

  if (req.method === "GET" && url.pathname === "/health") {
    try {
      await pool.query("SELECT 1");
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      return res.end(JSON.stringify({ status: "healthy", database: "connected" }));
    } catch (error) {
      console.error("Provjera baze nije uspjela:", error.code || error.name);
      res.writeHead(503, { "Content-Type": "application/json; charset=utf-8" });
      return res.end(JSON.stringify({ status: "unhealthy", database: "unavailable" }));
    }
  }

  res.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
  return res.end(JSON.stringify({ message: "Adresa ne postoji." }));
});

// Kada je probni upis uključen, poslužitelj sluša samo na ovom računalu.
server.listen(port, devRegistration ? "127.0.0.1" : "0.0.0.0", () => {
  console.log(`Backend radi na http://localhost:${port}`);
});
server.on("error", error => {
  console.error("Pokretanje nije uspjelo:", error.message);
  process.exitCode = 1;
  pool.end();
});
