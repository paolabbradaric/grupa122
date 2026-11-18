const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
const { randomUUID } = require("node:crypto"),
  { Pool } = require("pg");
const { createAuditionWorkflowModel } = require("../src/models/auditionModels");
const {
  createEmployerCastingModel,
} = require("../src/models/employerCastingModel");
const {
  createEmployerCastingStatusModel,
} = require("../src/models/employerCastingStatusModel");
const {
  createEmployerCandidateSelectionModel,
} = require("../src/models/employerCandidateSelectionModel");
const {
  createEmployerApplicationStatusModel,
} = require("../src/models/employerApplicationStatusModel");
const {
  createCandidateApplicationsModel,
} = require("../src/models/candidateApplicationsModel");
const { createNotificationModel } = require("../src/models/notificationModel");
const {
  createEmployerApplicationsModel,
} = require("../src/models/employerApplicationsModel");
test(
  "backend completion: isolated local SQL ownership, races, closure and rollback",
  {
    skip:
      process.env.BACKEND_COMPLETION_DB_TESTS === "1"
        ? false
        : "Set BACKEND_COMPLETION_DB_TESTS=1 on local castme_test.",
  },
  async (t) => {
    assert.equal(process.env.PGHOST, "127.0.0.1");
    assert.equal(process.env.PGDATABASE, "castme_test");
    assert.equal(process.env.PGSSL, "false");
    const port = Number(process.env.PGPORT);
    assert.ok(Number.isInteger(port) && port > 0 && port <= 65535);
    const schema = "completion_" + randomUUID().replaceAll("-", ""),
      privateSchema = schema + "_private";
    const db = new Pool({
      host: "127.0.0.1",
      port,
      database: "castme_test",
      user: process.env.PGUSER,
      password: process.env.PGPASSWORD || undefined,
      ssl: false,
      options: `-c search_path=${schema} -c statement_timeout=5000`,
      connectionTimeoutMillis: 3000,
    });
    let created = false;
    t.after(async () => {
      try {
        if (created) {
          await db.query(`DROP SCHEMA IF EXISTS ${privateSchema} CASCADE`);
          await db.query(`DROP SCHEMA ${schema} CASCADE`);
        }
      } finally {
        await db.end();
      }
    });
    await require("../test-utils/localTestServer").assertLocalTestServer(db);
    await db.query(`CREATE SCHEMA ${schema}`);
    created = true;
    await db.query(
      fs
        .readFileSync(path.resolve(__dirname, "../../db/schema.sql"), "utf8")
        .replaceAll("app_private", privateSchema)
        .replaceAll("public.", schema + "."),
    );
    await db.query(`INSERT INTO users(id,auth_id,email,first_name,last_name,birth_date,role) VALUES
 (1,'c1','c1@example.invalid','One','Candidate','1990-01-01','candidate'),(2,'c2','c2@example.invalid','Two','Candidate','1990-01-01','candidate'),
 (3,'e1','e1@example.invalid','Owner','Employer','1990-01-01','employer'),(4,'e2','e2@example.invalid','Other','Employer','1990-01-01','employer'),
 (5,'c5','c5@example.invalid','Five','Candidate','1990-01-01','candidate'),(6,'a6','a6@example.invalid',NULL,NULL,NULL,'admin');
 INSERT INTO candidate_profiles(id,user_id) VALUES(1,1),(2,2),(5,5);
 INSERT INTO organisations(id,owner_id,company_name,reg_num,contact_email) VALUES(1,3,'Owner','33392005961','owner@example.invalid'),(2,4,'Other','other','other@example.invalid');
 INSERT INTO verification(status,org_id,reviewed_by) VALUES('approved',1,6);`);
    const audition = createAuditionWorkflowModel(db),
      castingModel = createEmployerCastingModel(db),
      closure = createEmployerCastingStatusModel(db),
      selection = createEmployerCandidateSelectionModel(db);
    const apps = createCandidateApplicationsModel(db),
      notices = createNotificationModel(db),
      appStatus = createEmployerApplicationStatusModel(db),
      list = createEmployerApplicationsModel(db);
    const future = (h) => new Date(Date.now() + h * 3600000).toISOString();
    async function casting(positions = 2) {
      const r = await castingModel.createDraft(3, {
        projectTitle: "Local completion",
        projectType: "film",
        projectDescription: "Local only",
        roleTitle: "Role",
        roleDescription: "Local only",
        positionsCount: positions,
        maxApplications: 1000,
        minAge: 18,
        maxAge: 60,
        location: "Zagreb",
        applicationDeadline: future(240),
      });
      assert.equal(
        (await castingModel.publishDraft(3, r.id)).outcome,
        "published",
      );
      return r.id;
    }
    const apply = async (id, u, status = "INVITED") =>
      (
        await db.query(
          "INSERT INTO applications(candidate_id,casting_call_id,status) VALUES($1,$2,$3) RETURNING id",
          [u, id, status],
        )
      ).rows[0].id;
    const slot = (id, capacity = 1) =>
      audition.create(3, id, {
        starts_at: future(24),
        ends_at: future(25),
        location: "Zagreb",
        capacity,
      });
    const status = async (table, id) =>
      (await db.query(`SELECT status FROM ${table} WHERE id=$1`, [id])).rows[0]
        .status;
    await t.test("genre migration preserves data, repeats and rejects a mismatched existing type", async () => {
      const client=await db.connect();
      const sql=fs.readFileSync(path.resolve(__dirname,"../../db/migrations/20261118_casting_role_genre.sql"),"utf8");
      try {
        await client.query("CREATE TEMP TABLE casting_calls(id int PRIMARY KEY,title text)");
        await client.query("INSERT INTO pg_temp.casting_calls VALUES(1,'Existing row')");
        await client.query(sql);
        assert.deepEqual((await client.query("SELECT * FROM pg_temp.casting_calls")).rows,[{id:1,title:'Existing row',role_genre:null}]);
        await client.query("UPDATE pg_temp.casting_calls SET role_genre='drama' WHERE id=1");
        await client.query(sql);
        assert.equal((await client.query("SELECT role_genre FROM pg_temp.casting_calls")).rows[0].role_genre,'drama');
        await client.query("ALTER TABLE pg_temp.casting_calls ALTER COLUMN role_genre TYPE text");
        await assert.rejects(client.query(sql),/Review the existing role_genre column type/);
        await client.query('ROLLBACK');
        assert.equal((await client.query("SELECT format_type(atttypid,atttypmod) AS type FROM pg_attribute WHERE attrelid='pg_temp.casting_calls'::regclass AND attname='role_genre'")).rows[0].type,'text');
        assert.deepEqual((await client.query("SELECT * FROM pg_temp.casting_calls")).rows,[{id:1,title:'Existing row',role_genre:'drama'}]);
      } finally {
        await client.query('ROLLBACK');
        await client.query('DROP TABLE IF EXISTS pg_temp.casting_calls');
        client.release();
      }
    });
    await t.test(
      "only owner/invited candidate reads slots; admin application read is separate",
      async () => {
        const id = await casting(),
          a = await apply(id, 1),
          s = await slot(id);
        assert.equal(
          (await audition.list({ id: 3, role: "employer" }, id))[0].id,
          s.id,
        );
        assert.equal(
          (await audition.list({ id: 1, role: "candidate" }, id))[0]
            .availablePlaces,
          1,
        );
        await assert.rejects(audition.list({ id: 4, role: "employer" }, id), {
          status: 404,
        });
        await assert.rejects(audition.list({ id: 2, role: "candidate" }, id), {
          status: 404,
        });
        await assert.rejects(audition.book(2, a, s.id), { status: 404 });
        const other = await apply(id, 2, "SUBMITTED");
        await assert.rejects(audition.book(2, other, s.id), {
          code: "NOT_INVITED",
        });
        assert.equal((await list.listByCasting(4, id)).outcome, "not_found");
        assert.equal(
          (await list.listByCasting(6, id, { adminRead: true })).applications
            .length,
          2,
        );
      },
    );
    await t.test(
      "capacity race and direct duplicate SQL are rejected; RR cannot use a stale count",
      async () => {
        const id = await casting(),
          a1 = await apply(id, 1),
          a2 = await apply(id, 2),
          s = await slot(id);
        const r = await Promise.allSettled([
          audition.book(1, a1, s.id),
          audition.book(2, a2, s.id),
        ]);
        assert.equal(r.filter((x) => x.status === "fulfilled").length, 1);
        assert.equal(
          r.find((x) => x.status === "rejected").reason.code,
          "SLOT_FULL",
        );
        const winner = (
            await db.query(
              "SELECT application_id FROM audition_bookings WHERE audition_slot_id=$1",
              [s.id],
            )
          ).rows[0].application_id,
          other = await slot(id, 2);
        await assert.rejects(
          db.query(
            "INSERT INTO audition_bookings(application_id,audition_slot_id,status,booked_at) VALUES($1,$2,'booked',NOW())",
            [winner, other.id],
          ),
          { code: "23505" },
        );
        const id2 = await casting(),
          b1 = await apply(id2, 1),
          b2 = await apply(id2, 2),
          s2 = await slot(id2),
          c1 = await db.connect(),
          c2 = await db.connect();
        try {
          await c1.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
          await c2.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
          await c1.query("SELECT count(*) FROM audition_bookings");
          await c2.query("SELECT count(*) FROM audition_bookings");
          await c1.query(
            "INSERT INTO audition_bookings(application_id,audition_slot_id,status,booked_at) VALUES($1,$2,'booked',NOW())",
            [b1, s2.id],
          );
          await c1.query("COMMIT");
          await assert.rejects(
            c2.query(
              "INSERT INTO audition_bookings(application_id,audition_slot_id,status,booked_at) VALUES($1,$2,'booked',NOW())",
              [b2, s2.id],
            ),
            { code: "40001" },
          );
          await c2.query("ROLLBACK");
        } finally {
          c1.release();
          c2.release();
        }
      },
    );
    await t.test(
      "full reschedule preserves old booking, cancellation releases capacity and permits withdrawal",
      async () => {
        const id = await casting(),
          a1 = await apply(id, 1),
          a2 = await apply(id, 2),
          s1 = await slot(id),
          s2 = await slot(id),
          b = await audition.book(1, a1, s1.id);
        await audition.book(2, a2, s2.id);
        await assert.rejects(audition.book(1, a1, s2.id), {
          code: "SLOT_FULL",
        });
        assert.equal((await audition.getBooking(1, a1)).id, b.id);
        assert.equal((await apps.withdraw(1, a1)).outcome, "active_bookings");
        await audition.cancelBooking(2, a2);
        await audition.book(1, a1, s2.id);
        assert.equal((await audition.getBooking(1, a1)).slotId, s2.id);
        await audition.cancelBooking(1, a1);
        assert.equal((await apps.withdraw(1, a1)).status, "WITHDRAWN");
        const own = await notices.listMine(1);
        assert.ok(own.length);
        assert.equal(await notices.markRead(2, own[0].id), null);
        assert.equal((await notices.markRead(1, own[0].id)).isRead, true);
        assert.ok(
          (await notices.listMine(1, { unread: true })).every((n) => !n.isRead),
        );
      },
    );
    await t.test(
      "attendance checks owner/time; cancelled slot cancels bookings",
      async () => {
        const id = await casting(),
          a = await apply(id, 1),
          s = await slot(id),
          b = await audition.book(1, a, s.id);
        await assert.rejects(audition.attendance(4, id, b.id, "attended"), {
          status: 404,
        });
        await assert.rejects(audition.attendance(3, id, b.id, "attended"), {
          code: "INVALID_ATTENDANCE",
        });
        await db.query(
          "UPDATE audition_slots SET starts_at=NOW()-INTERVAL '1 hour',ends_at=NOW()+INTERVAL '1 hour' WHERE id=$1",
          [s.id],
        );
        assert.equal(
          (await audition.attendance(3, id, b.id, "attended")).attendanceStatus,
          "attended",
        );
        await db.query(
          "UPDATE audition_bookings SET status='cancelled' WHERE id=$1",
          [b.id],
        );
        const s2 = await slot(id),
          b2 = await audition.book(1, a, s2.id);
        await audition.cancel(3, id, s2.id);
        assert.equal(await status("audition_bookings", b2.id), "cancelled");
      },
    );
    await t.test(
      "filled rejects remaining open applications and cancels future reservations",
      async () => {
        const id = await casting(1),
          a1 = await apply(id, 1, "AUDITIONED"),
          a2 = await apply(id, 2),
          a3 = await apply(id, 5, "WITHDRAWN"),
          s = await slot(id),
          b = await audition.book(2, a2, s.id);
        assert.equal(
          (await selection.select(3, id, a1)).castingStatus,
          "filled",
        );
        assert.equal(await status("applications", a1), "ACCEPTED");
        assert.equal(await status("applications", a2), "REJECTED");
        assert.equal(await status("applications", a3), "WITHDRAWN");
        assert.equal(await status("audition_bookings", b.id), "cancelled");
        assert.equal(await status("audition_slots", s.id), "cancelled");
        assert.ok(
          (
            await db.query(
              "SELECT reason FROM application_status_history WHERE application_id=$1",
              [a2],
            )
          ).rows[0].reason,
        );
      },
    );
    await t.test(
      "cancel sets CANCELLED, preserves terminal statuses, and notification failure rolls everything back",
      async () => {
        const id = await casting(),
          a1 = await apply(id, 1),
          a2 = await apply(id, 2, "ACCEPTED"),
          a3 = await apply(id, 5, "REJECTED"),
          s = await slot(id),
          b = await audition.book(1, a1, s.id);
        await closure.cancel(3, id);
        assert.equal(await status("applications", a1), "CANCELLED");
        assert.equal(await status("applications", a2), "CANCELLED");
        assert.equal(await status("applications", a3), "REJECTED");
        assert.equal(await status("audition_bookings", b.id), "cancelled");
        const id2 = await casting(),
          a = await apply(id2, 1),
          s2 = await slot(id2),
          b2 = await audition.book(1, a, s2.id);
        const historyBefore = (
          await db.query(
            "SELECT count(*)::int n FROM casting_call_status_history WHERE casting_call_id=$1",
            [id2],
          )
        ).rows[0].n;
        const failing = {
          async connect() {
            const c = await db.connect();
            return {
              query(sql, p) {
                if (sql.includes("INSERT INTO notifications"))
                  throw Error("notification failure");
                return c.query(sql, p);
              },
              release() {
                c.release();
              },
            };
          },
        };
        await assert.rejects(
          createEmployerCastingStatusModel(failing).cancel(3, id2),
          /notification failure/,
        );
        assert.equal(await status("casting_calls", id2), "published");
        assert.equal(await status("applications", a), "INVITED");
        assert.equal(await status("audition_bookings", b2.id), "booked");
        assert.equal(
          (
            await db.query(
              "SELECT count(*)::int n FROM casting_call_status_history WHERE casting_call_id=$1",
              [id2],
            )
          ).rows[0].n,
          historyBefore,
        );
      },
    );
    await t.test(
      "rejection cancels future booking and emits a private notice",
      async () => {
        const id = await casting(),
          a = await apply(id, 1),
          s = await slot(id),
          b = await audition.book(1, a, s.id);
        assert.equal(
          (await appStatus.changeStatus(3, id, a, "REJECTED", "Nije odabran."))
            .outcome,
          "updated",
        );
        assert.equal(await status("audition_bookings", b.id), "cancelled");
        assert.ok(
          (await notices.listMine(1)).some(
            (n) => n.applicationId === a && n.type === "application_status",
          ),
        );
      },
    );
    await t.test(
      "booking concurrent with cancel or last selection cannot survive casting closure",
      async () => {
        for (const kind of ["cancel", "filled"]) {
          const id = await casting(1),
            a = await apply(id, 1),
            s = await slot(id);
          const selected =
            kind === "filled" ? await apply(id, 2, "AUDITIONED") : null;
          const result = await Promise.allSettled([
            audition.book(1, a, s.id),
            kind === "filled"
              ? selection.select(3, id, selected)
              : closure.cancel(3, id),
          ]);
          assert.equal(result[1].status, "fulfilled");
          assert.equal(
            (
              await db.query(
                "SELECT count(*)::int n FROM audition_bookings WHERE application_id=$1 AND status NOT IN ('cancelled','canceled')",
                [a],
              )
            ).rows[0].n,
            0,
          );
          assert.equal(
            await status("applications", a),
            kind === "filled" ? "REJECTED" : "CANCELLED",
          );
        }
      },
    );
    await t.test(
      "real HTTP draft, publish, submission, status transitions, booking and withdrawal",
      async (t) => {
        const { httpFixture } = require("../test-utils/httpFixture");
        const {
          createAuditionController,
        } = require("../src/controllers/auditionController");
        const {
          createApplicationTransaction,
        } = require("../src/models/applicationModel");
        const f = await httpFixture(t, {
          writesEnabled: true,
          employerWrites: true,
          publicModel: require('../src/models/castingModel').createCastingModel(db),
          applicationModel: {
            async getCandidateProfileByUserId(userId) {
              return (
                await db.query(
                  "SELECT id FROM candidate_profiles WHERE user_id=$1",
                  [userId],
                )
              ).rows[0];
            },
            createApplicationTransaction: (...args) =>
              createApplicationTransaction(...args, db),
          },
          appOptions: {
            employerCastingModel: castingModel,
            employerStatusModel: closure,
            employerSelectionModel: selection,
            employerApplicationsModel: list,
            employerApplicationStatusModel: appStatus,
            candidateApplicationsModel: apps,
            auditionController: createAuditionController({ model: audition }),
            auditionWorkflowModel: audition,
            notificationModel: notices,
          },
        });
        const employer = await f.cookie(3),
          candidate = await f.cookie(1);
        async function request(url, method, cookie, body, status = 200) {
          const r = await f.request(url, {
            method,
            headers: {
              Cookie: cookie,
              Origin: "http://localhost:5173",
              "X-CSRF-Token": "valid-test-token",
              "Content-Type": "application/json",
            },
            ...(body ? { body: JSON.stringify(body) } : {}),
          });
          assert.equal(r.status, status, url);
          return r.json();
        }
        const draft = await request(
          "/api/employer/castings",
          "POST",
          employer,
          {
            projectTitle: "HTTP integration",
            projectType: "film",
            roleGenre: "drama",
            auditionText: "Postojeći dio scenarija",
            projectDescription: "Local",
            roleTitle: "Role",
            roleDescription: "Local",
            positionsCount: 1,
            maxApplications: 1000,
            minAge: 18,
            maxAge: 60,
            location: "Zagreb",
            applicationDeadline: future(240),
          },
          201,
        );
        assert.ok(
          (await request("/api/employer/castings", "GET", employer)).some(
            (row) => row.id === draft.id,
          ),
        );
        const ownBefore = await request('/api/employer/castings','GET',employer);
        assert.equal(ownBefore.find(row=>row.id===draft.id).roleGenre,'drama');
        await request(`/api/employer/castings/${draft.id}`,'PATCH',employer,{roleGenre:null});
        assert.equal((await request('/api/employer/castings','GET',employer)).find(row=>row.id===draft.id).roleGenre,null);
        await request(`/api/employer/castings/${draft.id}`,'PATCH',employer,{roleGenre:'komedija'});
        await request(`/api/employer/castings/${draft.id}`,'PATCH',employer,{roleGenre:'x'.repeat(101)},400);
        await request(`/api/employer/castings/${draft.id}`,'PATCH',employer,{applicationDeadline:'2030-02-30T12:00:00Z'},400);
        await request(
          `/api/employer/castings/${draft.id}/publish`,
          "POST",
          employer,
        );
        const publicRow=await request(`/api/castings/${draft.id}`,'GET',employer);
        assert.equal(publicRow.roleGenre,'komedija');
        assert.equal(publicRow.role_genre,'komedija');
        assert.equal(publicRow.audition_text,'Postojeći dio scenarija');
        await request(`/api/employer/castings/${draft.id}`,'PATCH',employer,{roleGenre:'drama'},409);
        const submitted = await request(
          `/api/castings/${draft.id}/applications`,
          "POST",
          candidate,
          {},
          201,
        );
        const applicationId = submitted.application.id;
        for (const state of ["UNDER_REVIEW", "SHORTLISTED", "INVITED"])
          await request(
            `/api/employer/castings/${draft.id}/applications/${applicationId}/status`,
            "PATCH",
            employer,
            { status: state },
          );
        const s = await request(
          `/api/auditions/${draft.id}`,
          "POST",
          employer,
          {
            starts_at: future(24),
            ends_at: future(25),
            location: "Zagreb",
            capacity: 1,
          },
          201,
        );
        assert.equal(
          (await request(`/api/auditions/${draft.id}`, "GET", employer))[0].id,
          s.id,
        );
        await request(
          `/api/candidate/applications/${applicationId}/booking`,
          "PUT",
          candidate,
          { slotId: s.id },
        );
        await request(
          `/api/candidate/applications/${applicationId}/booking`,
          "DELETE",
          candidate,
        );
        await request(
          `/api/candidate/applications/${applicationId}/withdraw`,
          "PATCH",
          candidate,
        );
        assert.equal(
          (
            await request("/api/candidate/applications", "GET", candidate)
          ).applications.find((a) => a.id === applicationId).status,
          "WITHDRAWN",
        );
        assert.ok(
          (
            await request("/api/notifications", "GET", candidate)
          ).notifications.some((n) => n.applicationId === applicationId),
        );
      },
    );
    await t.test("booking migration repeats and missing/disabled guard fails closed", async () => {
      const migration=fs.readFileSync(path.resolve(__dirname,"../../db/migrations/20261118_audition_booking_capacity.sql"),"utf8");
      await db.query(migration); await db.query(migration);
      const id=await casting(),a=await apply(id,1),s=await slot(id);
      await db.query("ALTER TABLE audition_bookings DISABLE TRIGGER audition_bookings_capacity_guard");
      try { await assert.rejects(audition.book(1,a,s.id),{code:"BOOKING_GUARDS_UNAVAILABLE"}); }
      finally { await db.query("ALTER TABLE audition_bookings ENABLE TRIGGER audition_bookings_capacity_guard"); }
      assert.equal((await db.query("SELECT count(*)::int n FROM audition_bookings WHERE application_id=$1",[a])).rows[0].n,0);
      assert.equal((await auditionsFunction()).prosecdef,false);
      async function auditionsFunction(){return(await db.query("SELECT prosecdef,proconfig FROM pg_proc WHERE oid=to_regprocedure('guard_audition_booking_capacity()')")).rows[0];}
      assert.ok((await auditionsFunction()).proconfig.includes("search_path=pg_catalog"));
    });
  },
);
