const { test } = require("node:test");
const assert = require("node:assert/strict");
const sharp = require("sharp");
const express = require("express");
const { once } = require("node:events");
const { validatePatch } = require("../src/profiles/validation");
const { validateImages } = require("../src/profiles/media");
const { createStorage } = require("../src/profiles/storage");
const { createProfileRouter } = require("../src/profiles/routes");
const base = { firstName: "Iva", lastName: "Ivić", birthDate: "2000-04-12" };
test("profile PATCH validates fields, nulls, Croatian colors, dates and strict numbers", () => {
  assert.deepEqual(
    validatePatch(
      { city: " Zagreb ", eyeColor: "smeđa", weightKg: 62.25 },
      "candidate",
      base,
    ),
    { city: "Zagreb", eyeColor: "smeđa", weightKg: 62.25 },
  );
  assert.deepEqual(
    validatePatch({ city: " ", heightCm: "" }, "candidate", base),
    { city: null, heightCm: null },
  );
  for (const body of [
    { role: "admin" },
    { firstName: "" },
    { birthDate: "2008-12-31" },
    { birthDate: "2000-02-30" },
    { city: {} },
    { city: "x".repeat(101) },
    { heightCm: 1.2 },
    { heightCm: "123" },
    { weightKg: Infinity },
    { weightKg: 0 },
    { weightKg: 1.001 },
    { eyeColor: "brown" },
    { storage_key: "x" },
  ])
    assert.throws(
      () => validatePatch(body, "candidate", base),
      (e) => e.status === 400,
    );
  const employer = {
    companyName: "Studio",
    regNum: "33392005961",
    contactEmail: "a@example.test",
    phone: "+385 1 1234567",
    location: "Zagreb",
  };
  assert.equal(
    validatePatch({ contactEmail: " B@example.test " }, "employer", employer)
      .contactEmail,
    "b@example.test",
  );
  for (const body of [
    { regNum: "33392005962" },
    { phone: "" },
    { contactEmail: "bad" },
    { owner_id: 1 },
    { verification: "approved" },
  ])
    assert.throws(
      () => validatePatch(body, "employer", employer),
      (e) => e.status === 400,
    );
});
test("full image decoding accepts real JPG/PNG and rejects spoofed or corrupt images", async () => {
  for (const format of ["jpeg", "png"]) {
    const buffer = await sharp({
      create: { width: 4, height: 4, channels: 3, background: "red" },
    })
      .toFormat(format)
      .toBuffer();
    const file = {
      buffer,
      mimetype: `image/${format}`,
      originalname: "../unsafe.png",
      size: buffer.length,
    };
    const [image] = await validateImages([file]);
    assert.equal(image.type, file.mimetype);
    assert.ok(!image.name.includes("/"));
    assert.ok(image.key.startsWith("profiles/"));
    await assert.rejects(
      validateImages([{ ...file, mimetype: "image/gif" }]),
      (e) => e.status === 415,
    );
    await assert.rejects(
      validateImages([{ ...file, buffer: buffer.subarray(0, 20) }]),
      (e) => e.status === 415,
    );
  }
  await assert.rejects(
    validateImages([
      {
        buffer: Buffer.from("fake"),
        mimetype: "image/png",
        originalname: "x.png",
      },
    ]),
    (e) => e.status === 415,
  );
  await assert.rejects(validateImages([]), (e) => e.status === 400);
  await assert.rejects(
    createStorage({}).put("x", Buffer.from("x"), "image/png"),
    (e) => e.status === 503,
  );
});
test("HTTP guards execute before multipart parsing and storage writes", async (t) => {
  let calls = 0;
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.user = req.get("User") ? { id: 1, role: req.get("User") } : null;
    req.isAuthenticated = () => !!req.user;
    req.session = { csrfToken: "test-token" };
    next();
  });
  const config = { allowedOrigins: new Set(["http://localhost"]) };
  app.use(
    "/api",
    createProfileRouter({
      config,
      pool: {},
      model: { read: async () => ({ profile: {} }) },
      storage: {
        put: async () => {
          calls++;
        },
      },
      maxBytes: 100,
    }),
  );
  app.use((e, req, res, next) =>
    res.status(e.status || 500).json({ code: e.code, error: e.message }),
  );
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((r) => server.close(r)));
  const url = `http://127.0.0.1:${server.address().port}/api/profiles/me`;
  for (const [headers, status] of [
    [{}, 401],
    [{ User: "admin" }, 403],
    [{ User: "candidate" }, 403],
    [
      {
        User: "candidate",
        Origin: "http://evil",
        "X-CSRF-Token": "test-token",
      },
      403,
    ],
  ]) {
    const form = new FormData();
    form.append("file", new Blob(["fake"], { type: "image/png" }), "x.png");
    const response = await fetch(url + "/avatar", {
      method: "PUT",
      headers,
      body: form,
    });
    assert.equal(response.status, status);
  }
  const response = await fetch(url + "/logo", {
    method: "PUT",
    headers: {
      User: "candidate",
      Origin: "http://localhost",
      "X-CSRF-Token": "test-token",
    },
  });
  assert.equal(response.status, 403);
  assert.equal(calls, 0);
  const form = new FormData();
  form.append(
    "file",
    new Blob(["x".repeat(101)], { type: "image/png" }),
    "x.png",
  );
  assert.equal(
    (
      await fetch(url + "/avatar", {
        method: "PUT",
        headers: {
          User: "candidate",
          Origin: "http://localhost",
          "X-CSRF-Token": "test-token",
        },
        body: form,
      })
    ).status,
    413,
  );
  assert.equal(
    (await fetch(url, { headers: { User: "candidate" } })).headers.get(
      "cache-control",
    ),
    "no-store",
  );
});
