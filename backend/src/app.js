const http = require("http");

// Učitava vezu s bazom i postavke iz .env.
const pool = require("./config/database");

const port = process.env.PORT || 10000;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");

  // Provjerava rade li backend i veza s bazom.
  if (req.method === "GET" && url.pathname === "/health") {
    try {
      await pool.query("SELECT 1");

      res.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
      });

      return res.end(JSON.stringify({
        status: "healthy",
        database: "connected",
      }));
    } catch (error) {
      console.error("Provjera baze nije uspjela:", error.message);

      res.writeHead(503, {
        "Content-Type": "application/json; charset=utf-8",
      });

      return res.end(JSON.stringify({
        status: "unhealthy",
        database: "unavailable",
      }));
    }
  }

  // Ostale adrese još nisu implementirane.
  res.writeHead(404, {
    "Content-Type": "application/json; charset=utf-8",
  });

  res.end(JSON.stringify({ message: "Adresa ne postoji." }));
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Backend radi na http://localhost:${port}`);
});