const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createAuditionWorkflowModel } = require("../src/models/auditionModels");
function fixture({
  owner = true,
  status = "published",
  slotStatus = "scheduled",
  past = false,
  fail = false,
} = {}) {
  const calls = [];
  let released = false;
  const client = {
    async query(sql, args) {
      calls.push({ sql, args });
      if (sql.includes("FROM casting_calls c"))
        return { rows: owner ? [{ id: 1, status }] : [] };
      if (sql.includes("SELECT id,status,starts_at FROM audition_slots"))
        return {
          rows: [
            {
              id: 2,
              status: slotStatus,
              starts_at: past ? "2000-01-01" : "2099-01-01",
            },
          ],
        };
      if (sql.includes("INSERT INTO audition_slots")) {
        if (fail) throw Error("insert failed");
        return { rows: [{ id: 2, status: "scheduled" }] };
      }
      if (sql.includes("UPDATE audition_bookings"))
        return { rows: [{ id: 3, application_id: 4 }] };
      return { rows: [] };
    },
    release() {
      released = true;
    },
  };
  return {
    calls,
    model: createAuditionWorkflowModel({
      query: client.query,
      connect: async () => client,
    }),
    released: () => released,
  };
}
test("slot creation locks owned casting and accepts published or closed casting", async () => {
  for (const status of ["published", "closed"]) {
    const f = fixture({ status });
    assert.equal(
      (
        await f.model.create(3, 1, {
          starts_at: "2099-01-01",
          ends_at: "2099-01-02",
          location: "Zagreb",
          capacity: 1,
        })
      ).id,
      2,
    );
    assert.ok(f.calls.some((q) => q.sql.includes("FOR UPDATE OF c")));
    assert.equal(f.calls.at(-1).sql, "COMMIT");
    assert.equal(f.released(), true);
  }
});
test("unknown owner and forbidden casting status roll back before slot insert", async () => {
  for (const options of [
    { owner: false },
    { status: "cancelled" },
    { status: "filled" },
    { status: "draft" },
  ]) {
    const f = fixture(options);
    await assert.rejects(f.model.create(3, 1, {}));
    assert.equal(f.calls.at(-1).sql, "ROLLBACK");
    assert.ok(
      !f.calls.some((q) => q.sql.includes("INSERT INTO audition_slots")),
    );
  }
});
test("slot insertion failure rolls back and releases the connection", async () => {
  const f = fixture({ fail: true });
  await assert.rejects(f.model.create(3, 1, {}), /insert failed/);
  assert.equal(f.calls.at(-1).sql, "ROLLBACK");
  assert.equal(f.released(), true);
});
test("future slot cancellation cancels bookings and emits notifications in one transaction", async () => {
  const f = fixture();
  assert.equal((await f.model.cancel(3, 1, 2)).status, "cancelled");
  assert.ok(f.calls.some((q) => q.sql.includes("UPDATE audition_bookings")));
  assert.ok(f.calls.some((q) => q.sql.includes("INSERT INTO notifications")));
  assert.equal(f.calls.at(-1).sql, "COMMIT");
});
test("past or cancelled slots cannot be cancelled again", async () => {
  for (const options of [{ past: true }, { slotStatus: "cancelled" }]) {
    const f = fixture(options);
    await assert.rejects(f.model.cancel(3, 1, 2), {
      code: "INVALID_SLOT_STATUS",
    });
    assert.equal(f.calls.at(-1).sql, "ROLLBACK");
    assert.ok(!f.calls.some((q) => q.sql.includes("UPDATE audition_bookings")));
  }
});
