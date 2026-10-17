const { randomUUID } = require("crypto");
const pool = require("./config/database");

function sendJson(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  return res.end(JSON.stringify(data));
}

function validate(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { error: "Neispravni podaci." };
  }

  const data = {};
  for (const key of ["first_name", "last_name", "email", "birth_date", "city"]) {
    if (typeof input[key] !== "string" || !input[key].trim()) {
      return { error: "Popuni sva polja." };
    }
    data[key] = input[key].trim();
  }

  if ([data.first_name, data.last_name, data.city].some(value => value.length > 100)) {
    return { error: "Ime, prezime i grad mogu imati najviše 100 znakova." };
  }
  data.email = data.email.toLowerCase();
  if (data.email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    return { error: "Unesi ispravnu e-adresu." };
  }

  // Provjera da je datum ispravan, a ne primjerice 31. veljače.
  const birth = new Date(`${data.birth_date}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.birth_date) ||
      Number.isNaN(birth.getTime()) ||
      birth.toISOString().slice(0, 10) !== data.birth_date) {
    return { error: "Unesi ispravan datum rođenja." };
  }

  // Računa navršene godine prema današnjem datumu u Hrvatskoj.
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Zagreb", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const today = Object.fromEntries(parts.map(part => [part.type, part.value]));
  const birthdayPassed = `${today.month}-${today.day}` >= data.birth_date.slice(5);
  const age = Number(today.year) - birth.getUTCFullYear() - (birthdayPassed ? 0 : 1);
  if (age < 18) return { error: "Kandidat mora imati najmanje 18 godina." };
  return { data };
}

async function registerCandidate(req, res) {
  // Dodatna provjera: ovaj alat ne služi za javnu registraciju.
  if (process.env.DEV_REGISTRATION !== "true" || process.env.NODE_ENV === "production") {
    return sendJson(res, 404, { message: "Adresa ne postoji." });
  }

  let client;
  let inTransaction = false;
  try {
    const port = process.env.PORT || 10000;
    if (req.headers.origin !== `http://localhost:${port}` &&
        req.headers.origin !== `http://127.0.0.1:${port}`) {
      return sendJson(res, 403, { message: "Koristi lokalni obrazac." });
    }
    if ((req.headers["content-type"] || "").split(";")[0].trim() !== "application/json") {
      return sendJson(res, 415, { message: "Podaci moraju biti u JSON obliku." });
    }

    // Prikuplja tijelo zahtjeva, uz ograničenje veličine na 8 KB.
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 8192) return sendJson(res, 413, { message: "Zahtjev je prevelik." });
      chunks.push(chunk);
    }

    let input;
    try {
      input = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      return sendJson(res, 400, { message: "Neispravan JSON." });
    }
    const checked = validate(input);
    if (checked.error) return sendJson(res, 400, { message: checked.error });

    const { first_name, last_name, email, birth_date, city } = checked.data;
    client = await pool.connect();
    await client.query("BEGIN");
    inTransaction = true;

    // Uloga je zadana u backendu; obrazac ne može zatražiti administratorsku ulogu.
    const users = await client.query(
      `INSERT INTO users
        (auth_id, email, first_name, last_name, birth_date, role)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [`local-test:${randomUUID()}`, email, first_name, last_name, birth_date, "candidate"]
    );
    const userId = users.rows[0].id;

    const profiles = await client.query(
      `INSERT INTO candidate_profiles (user_id, city)
       VALUES ($1, $2) RETURNING id`,
      [userId, city]
    );

    // Račun i profil potvrđuju se zajedno.
    await client.query("COMMIT");
    inTransaction = false;
    return sendJson(res, 201, {
      message: "Probni kandidat je spremljen.",
      user_id: userId,
      profile_id: profiles.rows[0].id,
    });
  } catch (error) {
    if (client && inTransaction) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Poništavanje nije uspjelo:", rollbackError.code || rollbackError.name);
      }
    }
    if (error.code === "23505") {
      return sendJson(res, 409, { message: "Korisnik s tom e-adresom već postoji." });
    }
    console.error("Greška probnog upisa:", error.code || error.name);
    return sendJson(res, 500, { message: "Upis nije uspio. Provjeri vezu s bazom." });
  } finally {
    if (client) client.release();
  }
}

module.exports = registerCandidate;
