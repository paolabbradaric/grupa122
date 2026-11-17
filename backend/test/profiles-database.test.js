const { test } = require("node:test");
const assert = require("node:assert/strict");
const { Pool } = require("pg");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { randomUUID } = require("node:crypto");
const sharp = require("sharp");
const express = require("express");
const { once } = require("node:events");
const { createUserModel } = require("../src/auth/userModel");
const { createProfileModel } = require("../src/profiles/model");
const { createMediaService } = require("../src/profiles/media");
const { createProfileRouter } = require("../src/profiles/routes");
const {
  createEmployerApplicationsModel,
} = require("../src/models/employerApplicationsModel");
const connectionString = process.env.PROFILE_TEST_DATABASE_URL;
test(
  "isolated PostgreSQL profiles, durable files, HTTP ownership and compensation",
  {
    skip: !connectionString
      ? "Set PROFILE_TEST_DATABASE_URL to a local disposable PostgreSQL server."
      : false,
  },
  async (t) => {
    const url = new URL(connectionString);
    assert.ok(
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname),
      "Only a local PostgreSQL server is allowed",
    );
    const admin = new Pool({ connectionString });
    const database = "profile_test_" + randomUUID().replaceAll("-", "");
    await admin.query(`CREATE DATABASE ${database}`);
    url.pathname = "/" + database;
    const pool = new Pool({ connectionString: url.href });
    const directory = await fs.mkdtemp(
      path.join(os.tmpdir(), "profile-files-"),
    );
    t.after(async () => {
      await pool.end();
      await admin.query(`DROP DATABASE ${database} WITH (FORCE)`);
      await admin.end();
      await fs.rm(directory, { recursive: true, force: true });
    });
    const migration = await fs.readFile(
      path.resolve(__dirname, "../../db/migrations/profiles.sql"),
      "utf8",
    );
    const schema = await fs.readFile(
      path.resolve(__dirname, "../../db/schema.sql"),
      "utf8",
    );
    await pool.query(schema.split("-- Nullable additions preserve")[0]);
    await t.test(
      "fresh schema includes the same migration and unused rollback is safe",
      async () => {
        const fresh = database + "_fresh";
        await admin.query(`CREATE DATABASE ${fresh}`);
        const freshUrl = new URL(url);
        freshUrl.pathname = "/" + fresh;
        const freshPool = new Pool({ connectionString: freshUrl.href });
        try {
          await freshPool.query(schema);
          await freshPool.query(migration);
          const c = await freshPool.connect();
          try {
            await c.query("BEGIN");
            await c.query(
              await fs.readFile(
                path.resolve(
                  __dirname,
                  "../../db/migrations/profiles_rollback.sql",
                ),
                "utf8",
              ),
            );
            await c.query("ROLLBACK");
          } finally {
            c.release();
          }
        } finally {
          await freshPool.end();
          await admin.query(`DROP DATABASE ${fresh} WITH (FORCE)`);
        }
      },
    );
    const users = createUserModel(pool);
    const details = {
      role: "candidate",
      firstName: "Iva",
      lastName: "Ivić",
      birthDate: "2000-04-12",
    };
    const candidate = await users.register(
      { authId: "google:candidate", email: "candidate@test.example" },
      details,
    );
    const other = await users.register(
      { authId: "google:other", email: "other@test.example" },
      details,
    );
    const employer = await users.register(
      { authId: "google:owner", email: "owner@test.example" },
      {
        ...details,
        role: "employer",
        companyName: "Studio",
        regNum: "33392005961",
        contactEmail: "contact@test.example",
        phone: "+385 1 1234567",
        location: "Zagreb",
      },
    );
    const employer2 = await users.register(
      { authId: "google:owner2", email: "owner2@test.example" },
      {
        ...details,
        role: "employer",
        companyName: "Studio 2",
        regNum: "00000000001",
        contactEmail: "contact2@test.example",
        phone: "+385 1 1234567",
        location: "Split",
      },
    );
    await t.test(
      "migration rolls back, upgrades existing rows and is repeatable",
      async () => {
        const c = await pool.connect();
        await c.query("BEGIN");
        await c.query(migration);
        await c.query("ROLLBACK");
        assert.equal(
          (
            await c.query(
              "SELECT count(*)::int n FROM information_schema.columns WHERE table_name='candidate_profiles' AND column_name='weight_kg'",
            )
          ).rows[0].n,
          0,
        );
        c.release();
        await pool.query(migration);
        await pool.query(migration);
        assert.equal((await users.findById(candidate.id)).firstName, "Iva");
        const before = await pool.query(
          "SELECT id FROM candidate_profiles WHERE user_id=$1",
          [candidate.id],
        );
        assert.ok(before.rows[0].id);
        assert.equal(
          (
            await pool.query(
              "SELECT count(*)::int n FROM pg_tables WHERE schemaname='public' AND tablename IN ('profile_media','profile_storage_objects','media_files') AND rowsecurity",
            )
          ).rows[0].n,
          3,
        );
        await pool.query("CREATE ROLE profile_api_probe");
        await pool.query("GRANT USAGE ON SCHEMA public TO profile_api_probe");
        const probe = await pool.connect();
        try {
          await probe.query("SET ROLE profile_api_probe");
          await assert.rejects(
            probe.query("SELECT * FROM profile_media"),
            (e) => e.code === "42501",
          );
        } finally {
          await probe.query("RESET ROLE");
          probe.release();
          await pool.query("DROP OWNED BY profile_api_probe");
          await pool.query("DROP ROLE profile_api_probe");
        }
      },
    );
    const model = createProfileModel(pool);
    const storage = {
      put: async (key, buffer) =>
        fs.writeFile(path.join(directory, key.replaceAll("/", "_")), buffer),
      get: async (key) =>
        fs.readFile(path.join(directory, key.replaceAll("/", "_"))),
      remove: async (key) =>
        fs.rm(path.join(directory, key.replaceAll("/", "_")), { force: true }),
    };
    const service = createMediaService(pool, storage, model);
    const buffer = await sharp({
      create: { width: 4, height: 4, channels: 3, background: "blue" },
    })
      .png()
      .toBuffer();
    const image = {
      buffer,
      mimetype: "image/png",
      originalname: "test.png",
      size: buffer.length,
    };
    await t.test(
      "candidate and organization persist partial edits and rollback conflicts",
      async () => {
        const result = await model.patch(candidate, {
          firstName: "Novo",
          lastName: "Prezime",
          birthDate: "1999-12-31",
          city: "Zagreb",
          experience: "Gluma",
          heightCm: 180,
          weightKg: 71.25,
          eyeColor: "smeđa",
          hairColor: "crna",
        });
        assert.equal(result.user.firstName, "Novo");
        assert.equal(result.profile.weightKg, 71.25);
        assert.equal(result.profile.birthDate, "1999-12-31");
        await model.patch(candidate, { city: null });
        assert.equal((await model.read(candidate)).profile.experience, "Gluma");
        await model.patch(candidate, { city: "Zagreb" });
        const faultPool = {
          query: (...a) => pool.query(...a),
          connect: async () => {
            const c = await pool.connect();
            return {
              release: () => c.release(),
              query: (sql, args) => {
                if (sql.startsWith("UPDATE candidate_profiles"))
                  throw new Error("injected");
                return c.query(sql, args);
              },
            };
          },
        };
        await assert.rejects(
          createProfileModel(faultPool).patch(candidate, {
            firstName: "Rollback",
            city: "Split",
          }),
        );
        assert.equal((await model.read(candidate)).user.firstName, "Novo");
        await model.patch(employer, { contactEmail: "new@test.example" });
        assert.equal(
          (await users.findById(employer.id)).email,
          "owner@test.example",
        );
        await assert.rejects(
          model.patch(employer, {
            companyName: "Conflict",
            regNum: "00000000001",
          }),
          (e) => e.status === 409,
        );
        assert.equal(
          (await model.read(employer)).profile.companyName,
          "Studio",
        );
        await pool.query(
          "INSERT INTO verification(status,org_id) VALUES('approved',$1)",
          [employer.organization.id],
        );
        await assert.rejects(
          model.patch(employer, { regNum: "12345678903" }),
          (e) => e.status === 409,
        );
        await model.patch(employer, { companyName: "Novo studio" });
      },
    );
    await t.test(
      "durable JPG/PNG, concurrent portfolio limit, replacement and private content",
      async () => {
        await service.upload(candidate, "avatar", [image]);
        await service.upload(candidate, "portfolio", [
          image,
          image,
          image,
          image,
        ]);
        const outcomes = await Promise.allSettled([
          service.upload(candidate, "portfolio", [image]),
          service.upload(candidate, "portfolio", [image]),
        ]);
        assert.equal(
          outcomes.filter((r) => r.status === "fulfilled").length,
          1,
        );
        assert.equal(
          outcomes.find((r) => r.status === "rejected").reason.status,
          409,
        );
        const read = await model.read(candidate);
        assert.equal(read.profile.portfolio.length, 5);
        await assert.rejects(
          model.content(other, read.profile.avatar.id),
          (e) => e.status === 404,
        );
        await assert.rejects(
          model.changeMedia(
            other,
            "portfolio",
            null,
            read.profile.portfolio[0].id,
          ),
          (e) => e.status === 404,
        );
        const oldId = read.profile.avatar.id;
        const jpg = await sharp(buffer).jpeg().toBuffer();
        await service.upload(candidate, "avatar", [
          { ...image, buffer: jpg, mimetype: "image/jpeg", size: jpg.length },
        ]);
        assert.notEqual((await model.read(candidate)).profile.avatar.id, oldId);
        await assert.rejects(
          model.content(candidate, oldId),
          (e) => e.status === 404,
        );
        await service.upload(employer, "logo", [image]);
        const logo = (await model.read(employer)).profile.logo;
        await assert.rejects(
          model.content(employer2, logo.id),
          (e) => e.status === 404,
        );
        const restarted = new Pool({ connectionString: url.href });
        try {
          const persisted = await createProfileModel(restarted).read(candidate);
          assert.equal(persisted.profile.portfolio.length, 5);
          assert.equal(persisted.user.firstName, "Novo");
          const m = await createProfileModel(restarted).content(
            candidate,
            persisted.profile.avatar.id,
          );
          assert.ok((await storage.get(m.storage_key)).length);
        } finally {
          await restarted.end();
        }
      },
    );
    await t.test(
      "storage and DB failures compensate and retry orphan cleanup",
      async () => {
        const before = (await fs.readdir(directory)).length;
        await assert.rejects(
          createMediaService(pool, storage, {
            changeMedia: async () => {
              throw new Error("DB failed");
            },
          }).upload(other, "avatar", [image]),
        );
        assert.equal((await fs.readdir(directory)).length, before);
        const failing = {
          ...storage,
          put: async () => {
            throw new Error("offline");
          },
          remove: async () => {
            throw new Error("offline");
          },
        };
        await assert.rejects(
          createMediaService(pool, failing, model).upload(other, "avatar", [
            image,
          ]),
        );
        assert.ok((await service.cleanup(0)).removed >= 2);
        const uncertain = createMediaService(pool, storage, {
          changeMedia: async (...args) => {
            await model.changeMedia(...args);
            throw new Error("uncertain commit");
          },
        });
        await assert.rejects(uncertain.upload(other, "avatar", [image]));
        const kept = (await model.read(other)).profile.avatar;
        assert.ok(
          (await storage.get((await model.content(other, kept.id)).storage_key))
            .length,
        );
        const remaining = (
          await pool.query(
            "SELECT count(*)::int n FROM profile_storage_objects",
          )
        ).rows[0].n;
        assert.equal(
          remaining,
          (await pool.query("SELECT count(*)::int n FROM media_files")).rows[0]
            .n,
        );
      },
    );
    await t.test(
      "application references survive removal and employer reads updated fields",
      async () => {
        const cp = (
          await pool.query(
            "SELECT id FROM candidate_profiles WHERE user_id=$1",
            [candidate.id],
          )
        ).rows[0].id;
        const project = (
          await pool.query(
            "INSERT INTO projects(title,project_type,org_id) VALUES('Test','film',$1) RETURNING id",
            [employer.organization.id],
          )
        ).rows[0].id;
        const casting = (
          await pool.query(
            "INSERT INTO casting_calls(status,project_id) VALUES('draft',$1) RETURNING id",
            [project],
          )
        ).rows[0].id;
        const application = (
          await pool.query(
            "INSERT INTO applications(status,candidate_id,casting_call_id) VALUES('SUBMITTED',$1,$2) RETURNING id",
            [cp, casting],
          )
        ).rows[0].id;
        const media = (await model.read(candidate)).profile.portfolio[0];
        await pool.query(
          "INSERT INTO application_files(kind,application_id,media_file_id) VALUES('image',$1,$2)",
          [application, media.id],
        );
        const key = (await model.content(candidate, media.id)).storage_key;
        await model.changeMedia(candidate, "portfolio", null, media.id);
        await service.cleanup(0);
        assert.ok((await storage.get(key)).length);
        assert.equal(
          (
            await pool.query("SELECT id FROM media_files WHERE id=$1", [
              media.id,
            ])
          ).rowCount,
          1,
        );
        const applications = await createEmployerApplicationsModel(
          pool,
        ).listByCasting(employer.id, casting);
        assert.equal(applications.applications[0].firstName, "Novo");
        assert.equal(applications.applications[0].city, "Zagreb");
        assert.equal(applications.applications[0].experience, "Gluma");
        assert.equal(
          (
            await createEmployerApplicationsModel(pool).listByCasting(
              employer2.id,
              casting,
            )
          ).outcome,
          "not_found",
        );
      },
    );
    await t.test(
      "HTTP uses real PostgreSQL and durable files for profile and content",
      async () => {
        const app = express();
        app.use(express.json());
        let current = candidate;
        app.use((req, res, next) => {
          req.user = current;
          req.isAuthenticated = () => !!current;
          req.session = { csrfToken: "token" };
          next();
        });
        app.use(
          "/api",
          createProfileRouter({
            config: { allowedOrigins: new Set(["http://localhost"]) },
            pool,
            storage,
          }),
        );
        app.use((e, req, res, next) =>
          res.status(e.status || 500).json({ code: e.code, error: e.message }),
        );
        const server = app.listen(0, "127.0.0.1");
        await once(server, "listening");
        try {
          const base = `http://127.0.0.1:${server.address().port}`;
          const data = await (await fetch(base + "/api/profiles/me")).json();
          const response = await fetch(base + data.profile.avatar.contentUrl);
          assert.equal(response.status, 200);
          assert.equal(response.headers.get("content-type"), "image/jpeg");
          assert.equal(
            response.headers.get("x-content-type-options"),
            "nosniff",
          );
          current = other;
          assert.equal(
            (await fetch(base + data.profile.avatar.contentUrl)).status,
            404,
          );
          current = null;
          assert.equal((await fetch(base + "/api/profiles/me")).status, 401);
          current = candidate;
          const form = new FormData();
          form.append(
            "file",
            new Blob([buffer], { type: "image/png" }),
            "photo.png",
          );
          assert.equal(
            (
              await fetch(base + "/api/profiles/me/avatar", {
                method: "PUT",
                headers: {
                  Origin: "http://localhost",
                  "X-CSRF-Token": "token",
                },
                body: form,
              })
            ).status,
            200,
          );
        } finally {
          await new Promise((r) => server.close(r));
        }
      },
    );
  },
);
