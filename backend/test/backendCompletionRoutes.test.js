const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { httpFixture } = require("../test-utils/httpFixture");
const {
  createAuditionController,
} = require("../src/controllers/auditionController");
const mutation = {
  Origin: "http://localhost:5173",
  "X-CSRF-Token": "valid-test-token",
  "Content-Type": "application/json",
};
async function fixture(t, options = {}) {
  const calls = [],
    record =
      (kind, result) =>
      async (...args) => {
        calls.push({ kind, args });
        return result;
      };
  const workflow = {
    list: record("slots", []),
    getBooking: record("booking", null),
    book: record("reserve", { id: 1 }),
    cancelBooking: record("cancel", { id: 1 }),
    listBookings: record("employerBookings", []),
    attendance: record("attendance", { id: 1 }),
  };
  const f = await httpFixture(t, {
    ...options,
    appOptions: {
      auditionWorkflowModel: workflow,
      auditionController: createAuditionController({ model: workflow }),
      notificationModel: {
        listMine: record("notices", []),
        markRead: record("read", { id: 1, isRead: true }),
      },
      adminApplicationsModel: {
        listByCasting: record("admin", {
          outcome: "success",
          casting: { id: 1 },
          applications: [],
        }),
      },
    },
  });
  return { ...f, calls };
}
test("guests and wrong roles cannot reach bookings, notifications or admin applications", async (t) => {
  const f = await fixture(t);
  for (const route of [
    "/api/auditions/1",
    "/api/candidate/applications/1/booking",
    "/api/notifications",
    "/api/admin/castings/1/applications",
  ])
    assert.equal((await f.request(route)).status, 401, route);
  assert.equal(
    (
      await f.request("/api/candidate/applications/1/booking", {
        headers: { Cookie: await f.cookie(3) },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await f.request("/api/admin/castings/1/applications", {
        headers: { Cookie: await f.cookie(4) },
      })
    ).status,
    403,
  );
  assert.equal(f.calls.length, 0);
});
test("employer GET reaches scoped model; notification identity comes only from session", async (t) => {
  const f = await fixture(t);
  assert.equal(
    (
      await f.request("/api/auditions/1", {
        headers: { Cookie: await f.cookie(3) },
      })
    ).status,
    200,
  );
  assert.equal(f.calls[0].args[0].id, 3);
  assert.equal(f.calls[0].args[0].role, "employer");
  const cookie = await f.cookie(1);
  assert.equal(
    (
      await f.request("/api/notifications?unread=true", {
        headers: { Cookie: cookie },
      })
    ).status,
    200,
  );
  assert.equal(f.calls[1].args[0], 1);
  for (const route of [
    "/api/notifications?userId=2",
    "/api/notifications?limit=101",
    "/api/auditions/2147483648",
  ])
    assert.equal(
      (await f.request(route, { headers: { Cookie: cookie } })).status,
      400,
      route,
    );
});
test("booking writes require enabled gates and valid Origin/CSRF before model access", async (t) => {
  const f = await fixture(t),
    cookie = await f.cookie(1),
    url = "/api/candidate/applications/1/booking";
  assert.equal(
    (
      await f.request(url, {
        method: "PUT",
        headers: { Cookie: cookie, ...mutation },
        body: '{"slotId":1}',
      })
    ).status,
    503,
  );
  const enabled = await fixture(t, {
      writesEnabled: true,
      employerWrites: true,
    }),
    session = await enabled.cookie(1);
  for (const headers of [
    { ...mutation, Origin: "https://evil.example" },
    { ...mutation, "X-CSRF-Token": "" },
  ])
    assert.equal(
      (
        await enabled.request(url, {
          method: "PUT",
          headers: { Cookie: session, ...headers },
          body: '{"slotId":1}',
        })
      ).status,
      403,
    );
  assert.equal(enabled.calls.length, 0);
  assert.equal(
    (
      await enabled.request(url, {
        method: "PUT",
        headers: { Cookie: session, ...mutation },
        body: '{"slotId":1}',
      })
    ).status,
    200,
  );
  assert.deepEqual(enabled.calls[0].args, [1, 1, 1]);
  assert.equal(
    (
      await enabled.request(url, {
        method: "PUT",
        headers: { Cookie: session, ...mutation },
        body: '{"slotId":2147483648}',
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await enabled.request("/api/notifications/1/read", {
        method: "PATCH",
        headers: { Cookie: session, ...mutation },
      })
    ).status,
    200,
  );
});
test("admin read requires Google proof and allowlist; it grants no employer mutations", async (t) => {
  const f = await fixture(t, { allowAdmin: true }),
    cookie = await f.cookie(4);
  const response = await f.request("/api/admin/castings/1/applications", {
    headers: { Cookie: cookie },
  });
  assert.equal(response.status, 200);
  assert.deepEqual(f.calls[0].args, [4, 1, { adminRead: true }]);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(
    (
      await f.request("/api/employer/castings/1/applications/1/select", {
        method: "POST",
        headers: { Cookie: cookie, ...mutation },
      })
    ).status,
    403,
  );
});
test("audition creation validates future dates and PostgreSQL INT limits", async () => {
  let called = false;
  const c = createAuditionController({
      model: {
        async create() {
          called = true;
        },
      },
    }),
    res = {
      code: 200,
      status(n) {
        this.code = n;
        return this;
      },
      json() {},
    };
  for (const body of [
    {
      starts_at: "2020-01-01T00:00:00Z",
      ends_at: "2020-01-01T01:00:00Z",
      location: "Zagreb",
      capacity: 1,
    },
    {
      starts_at: "2099-01-01T00:00:00Z",
      ends_at: "2099-01-01T01:00:00Z",
      location: "Zagreb",
      capacity: 2147483648,
    },
  ]) {
    await c.createAuditionSlot({ params: { casting_call_id: "1" }, body }, res);
    assert.equal(res.code, 400);
  }
  assert.equal(called, false);
});
test("casting integer overflow is rejected before database access and remote candidate writes require TLS", () => {
  const {
    validateDraft,
  } = require("../src/controllers/employerCastingController");
  const { getApplicationWritesEnabled } = require("../src/app");
  for (const key of ["positionsCount", "maxApplications", "minAge", "maxAge"])
    assert.ok(
      validateDraft(
        { projectTitle: "Test", projectType: "film", [key]: 2147483648 },
        true,
      ).error,
      key,
    );
  const env = {
    PGHOST: "database.example.invalid",
    PGDATABASE: "postgres",
    PGPORT: "5432",
    APPLICATION_WRITES_ENABLED: "true",
    APPLICATION_WRITES_CONFIRMED: "true",
    APPLICATION_WRITES_ALLOW_REMOTE: "true",
  };
  assert.throws(() => getApplicationWritesEnabled(env), /TLS/);
  assert.equal(getApplicationWritesEnabled({ ...env, PGSSL: "true" }), true);
});
